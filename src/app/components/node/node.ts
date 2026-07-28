import {
  Component, input, output, signal,
  ChangeDetectionStrategy, AfterViewInit, viewChild, ElementRef,
} from '@angular/core';
import { GraphNode, HandleSide } from '../../models/node';
import { HandleComponent } from '../handle/handle';

@Component({
  selector: 'app-node',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HandleComponent],
  template: `
    <div
      class="node-card"
      [class.selected]="isSelected()"
      [style.left.px]="node().x"
      [style.top.px]="node().y"
      [style.min-width.px]="120"
      (mousedown)="onMouseDown($event)"
      (dblclick)="onDoubleClick($event)"
    >
      @if (isEditing()) {
        <input
          class="node-label-input"
          [value]="node().label"
          (blur)="finishEdit($event)"
          (keydown.enter)="finishEdit($event)"
          (keydown.escape)="cancelEdit()"
          (mousedown)="$event.stopPropagation()"
          autofocus
        />
      } @else {
        <span #labelRef class="node-label">{{ node().label }}</span>
      }

      @for (side of handleSides; track side) {
        <app-handle
          [side]="side"
          [nodeId]="node().id"
          [isHighlighted]="isHandleSnapped(side)"
          [class.handle-top]="side === 'top'"
          [class.handle-right]="side === 'right'"
          [class.handle-bottom]="side === 'bottom'"
          [class.handle-left]="side === 'left'"
          (startDrag)="onHandleDragStart($event)"
        />
      }
    </div>
  `,
  styles: [`
    :host {
      position: absolute;
    }
    .node-card {
      position: absolute;
      background: #f0f0f5;
      border: 2px solid #3a3a5c;
      border-radius: 8px;
      padding: 8px 16px;
      cursor: grab;
      user-select: none;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 48px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      transition: border-color 0.15s ease, box-shadow 0.15s ease;
    }
    .node-card:hover {
      box-shadow: 0 4px 16px rgba(108,99,255,0.2);
    }
    .node-card.selected {
      border-color: #6c63ff;
      box-shadow: 0 0 0 2px rgba(108,99,255,0.3), 0 4px 16px rgba(108,99,255,0.2);
    }
    .node-label {
      color: #1a1a2e;
      font-size: 14px;
      font-weight: 500;
      white-space: nowrap;
    }
    .node-label-input {
      background: transparent;
      border: none;
      border-bottom: 2px solid #6c63ff;
      color: #1a1a2e;
      font-size: 14px;
      font-weight: 500;
      outline: none;
      width: 100%;
      min-width: 80px;
      text-align: center;
    }
    .handle-top {
      position: absolute;
      top: -6px;
      left: 50%;
      transform: translateX(-50%);
    }
    .handle-right {
      position: absolute;
      right: -6px;
      top: 50%;
      transform: translateY(-50%);
    }
    .handle-bottom {
      position: absolute;
      bottom: -6px;
      left: 50%;
      transform: translateX(-50%);
    }
    .handle-left {
      position: absolute;
      left: -6px;
      top: 50%;
      transform: translateY(-50%);
    }
  `],
})
export class NodeComponent {
  node = input.required<GraphNode>();
  isSelected = input(false);
  snapTarget = input<{ nodeId: string; handle: HandleSide } | null>(null);

  startMove = output<{ nodeId: string; event: MouseEvent }>();
  rename = output<{ nodeId: string; newLabel: string }>();
  handleDragStart = output<{ nodeId: string; handle: HandleSide; event: MouseEvent }>();
  private labelRef = viewChild<ElementRef<HTMLSpanElement>>('labelRef');
  sizeChanged = output<{ nodeId: string; width: number; height: number }>();

  isEditing = signal(false);
  handleSides: HandleSide[] = ['top', 'right', 'bottom', 'left'];

  isHandleSnapped(side: HandleSide): boolean {
    const target = this.snapTarget();
    return target !== null && target.nodeId === this.node().id && target.handle === side;
  }

  onMouseDown(event: MouseEvent): void {
    if (this.isEditing()) return;
    event.stopPropagation();
    this.startMove.emit({ nodeId: this.node().id, event });
  }

  onDoubleClick(event: MouseEvent): void {
    event.stopPropagation();
    this.isEditing.set(true);
  }

  finishEdit(event: Event): void {
    const input = event.target as HTMLInputElement;
    const newLabel = input.value.trim();
    if (newLabel && newLabel !== this.node().label) {
      this.rename.emit({ nodeId: this.node().id, newLabel });
    }
    this.isEditing.set(false);
    setTimeout(() => this.measureAndEmitSize(), 0);
  }

  cancelEdit(): void {
    this.isEditing.set(false);
  }

  onHandleDragStart(event: { nodeId: string; handle: HandleSide; event: MouseEvent }): void {
    this.handleDragStart.emit(event);
  }

  private measureAndEmitSize(): void {
    const el = this.labelRef()?.nativeElement;
    if (!el) return;
    const parent = el.parentElement;
    if (!parent) return;
    const cs = getComputedStyle(parent);
    const padL = parseFloat(cs.paddingLeft) || 0;
    const padR = parseFloat(cs.paddingRight) || 0;
    const bordL = parseFloat(cs.borderLeftWidth) || 0;
    const bordR = parseFloat(cs.borderRightWidth) || 0;
    const measuredWidth = Math.max(120, el.scrollWidth + padL + padR + bordL + bordR);
    if (Math.abs(measuredWidth - this.node().width) > 1) {
      this.sizeChanged.emit({ nodeId: this.node().id, width: measuredWidth, height: 48 });
    }
  }

  ngAfterViewInit(): void {
    requestAnimationFrame(() => this.measureAndEmitSize());
  }
}
