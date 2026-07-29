import {
  Component, input, output, signal, computed, effect,
  ChangeDetectionStrategy, AfterViewInit, viewChild, ElementRef,
} from '@angular/core';
import { GraphNode, HandleSide } from '../../models/node';
import { HandleComponent } from '../handle/handle';

export type GripCorner = 'nw' | 'ne' | 'sw' | 'se';

const DEFAULT_NODE_BACKGROUND = '#f0f0f5';
// 30% alpha suffix so Group fills stay see-through over children
const GROUP_FILL_ALPHA = '4D';

@Component({
  selector: 'app-node',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HandleComponent],
  template: `
    <div
      class="node-card"
      [class.group-card]="isGroup()"
      [class.selected]="isSelected()"
      [style.left.px]="node().x"
      [style.top.px]="node().y"
      [style.width.px]="node().width"
      [style.height.px]="node().height"
      [style.background]="cardBackground()"
      (mousedown)="onMouseDown($event)"
      (dblclick)="onDoubleClick($event)"
    >
      @if (isGroup()) {
        <div class="group-label-strip" (dblclick)="onLabelStripDoubleClick($event)">
          @if (isEditing()) {
            <input
              #editInput
              class="node-label-input group-label-input"
              [value]="node().label"
              (blur)="finishEdit($event)"
              (keydown.enter)="finishEdit($event)"
              (keydown.escape)="cancelEdit()"
              (mousedown)="$event.stopPropagation()"
            />
          } @else {
            <span class="group-label">{{ node().label }}</span>
          }
        </div>
      } @else {
        @if (isEditing()) {
          <input
            #editInput
            class="node-label-input"
            [value]="node().label"
            (blur)="finishEdit($event)"
            (keydown.enter)="finishEdit($event)"
            (keydown.escape)="cancelEdit()"
            (mousedown)="$event.stopPropagation()"
          />
        } @else {
          <span #labelRef class="node-label">{{ node().label }}</span>
        }
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

      @if (isSelected() && !isEditing()) {
        @for (corner of gripCorners; track corner) {
          <div
            class="grip"
            [class.grip-nw]="corner === 'nw'"
            [class.grip-ne]="corner === 'ne'"
            [class.grip-sw]="corner === 'sw'"
            [class.grip-se]="corner === 'se'"
            (mousedown)="onGripMouseDown(corner, $event)"
          ></div>
        }
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
      border: 1px solid rgba(15, 15, 18, 0.15);
      border-radius: 10px;
      padding: 8px 16px;
      cursor: grab;
      user-select: none;
      display: flex;
      align-items: center;
      justify-content: center;
      min-width: 120px;
      min-height: 48px;
      box-sizing: border-box;
      overflow: visible;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.45);
      transition: border-color 0.15s ease, box-shadow 0.15s ease;
    }
    .node-card:hover {
      box-shadow: 0 6px 20px rgba(124, 92, 255, 0.28);
    }
    .node-card.selected {
      border-color: #7c5cff;
      box-shadow: 0 0 0 2px rgba(124, 92, 255, 0.4), 0 6px 20px rgba(124, 92, 255, 0.25);
    }
    .group-card {
      padding: 0;
      align-items: flex-start;
      justify-content: flex-start;
      border-style: dashed;
      border-width: 2px;
      border-color: rgba(255, 255, 255, 0.22);
      box-shadow: none;
    }
    .group-label-strip {
      width: 100%;
      height: 28px;
      display: flex;
      align-items: center;
      padding: 0 12px;
      box-sizing: border-box;
      border-radius: 6px 6px 0 0;
      background: rgba(58, 58, 92, 0.35);
    }
    .group-label {
      color: #f0f0f5;
      font-size: 12px;
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
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
      border-bottom: 2px solid #7c5cff;
      color: #1a1a2e;
      font-size: 14px;
      font-weight: 500;
      outline: none;
      width: 100%;
      min-width: 80px;
      text-align: center;
    }
    .group-label-input {
      color: #f0f0f5;
      font-size: 12px;
      font-weight: 600;
      text-align: left;
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
    .grip {
      position: absolute;
      width: 10px;
      height: 10px;
      border-radius: 2px;
      background: #7c5cff;
      border: 2px solid #0e0e11;
      z-index: 11;
    }
    .grip-nw { top: -5px; left: -5px; cursor: nwse-resize; }
    .grip-ne { top: -5px; right: -5px; cursor: nesw-resize; }
    .grip-sw { bottom: -5px; left: -5px; cursor: nesw-resize; }
    .grip-se { bottom: -5px; right: -5px; cursor: nwse-resize; }
  `],
})
export class NodeComponent implements AfterViewInit {
  node = input.required<GraphNode>();
  isSelected = input(false);
  snapTarget = input<{ nodeId: string; handle: HandleSide } | null>(null);

  startMove = output<{ nodeId: string; event: MouseEvent }>();
  rename = output<{ nodeId: string; newLabel: string }>();
  handleDragStart = output<{ nodeId: string; handle: HandleSide; event: MouseEvent }>();
  startResize = output<{ nodeId: string; corner: GripCorner; minWidth: number; minHeight: number; event: MouseEvent }>();
  createChild = output<{ parentId: string; clientX: number; clientY: number }>();
  private labelRef = viewChild<ElementRef<HTMLSpanElement>>('labelRef');
  sizeChanged = output<{ nodeId: string; width: number; height: number }>();

  private editInput = viewChild<ElementRef<HTMLInputElement>>('editInput');

  constructor() {
    // autofocus doesn't fire for dynamically inserted inputs; focus and
    // select the text once the editor renders
    effect(() => {
      const input = this.editInput()?.nativeElement;
      if (input) {
        input.focus();
        input.select();
      }
    });
  }

  isEditing = signal(false);
  handleSides: HandleSide[] = ['top', 'right', 'bottom', 'left'];
  gripCorners: GripCorner[] = ['nw', 'ne', 'sw', 'se'];

  isGroup = computed(() => this.node().kind === 'group');

  cardBackground = computed(() => {
    const base = this.node().color ?? DEFAULT_NODE_BACKGROUND;
    return this.isGroup() ? base + GROUP_FILL_ALPHA : base;
  });

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
    if (this.isGroup()) {
      // Group body: create a child node at the cursor (label strip edits instead)
      this.createChild.emit({
        parentId: this.node().id,
        clientX: event.clientX,
        clientY: event.clientY,
      });
      return;
    }
    this.isEditing.set(true);
  }

  onLabelStripDoubleClick(event: MouseEvent): void {
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

  onGripMouseDown(corner: GripCorner, event: MouseEvent): void {
    event.stopPropagation();
    event.preventDefault();
    this.startResize.emit({
      nodeId: this.node().id,
      corner,
      minWidth: this.minLabelWidth(),
      minHeight: 48,
      event,
    });
  }

  // The label-derived auto-size acts as the minimum width when resizing
  private minLabelWidth(): number {
    return Math.max(120, this.measureLabelWidth() ?? 0);
  }

  private measureLabelWidth(): number | null {
    const el = this.labelRef()?.nativeElement;
    if (!el) return null;
    const parent = el.parentElement;
    if (!parent) return null;
    const cs = getComputedStyle(parent);
    const padL = parseFloat(cs.paddingLeft) || 0;
    const padR = parseFloat(cs.paddingRight) || 0;
    const bordL = parseFloat(cs.borderLeftWidth) || 0;
    const bordR = parseFloat(cs.borderRightWidth) || 0;
    return el.scrollWidth + padL + padR + bordL + bordR;
  }

  // Grow-only: the measured label width raises the node's width floor but
  // never shrinks a manually grown node
  private measureAndEmitSize(): void {
    if (this.isGroup()) return;
    const measured = this.measureLabelWidth();
    if (measured === null) return;
    const measuredWidth = Math.max(120, measured);
    if (measuredWidth > this.node().width + 1) {
      this.sizeChanged.emit({ nodeId: this.node().id, width: measuredWidth, height: this.node().height });
    }
  }

  ngAfterViewInit(): void {
    requestAnimationFrame(() => this.measureAndEmitSize());
  }
}
