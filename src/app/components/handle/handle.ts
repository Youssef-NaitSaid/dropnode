import { Component, input, output, ChangeDetectionStrategy } from '@angular/core';
import { HandleSide } from '../../models/node';

@Component({
  selector: 'app-handle',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="handle"
      [class.snap-highlight]="isHighlighted()"
      [class.side-top]="side() === 'top'"
      [class.side-right]="side() === 'right'"
      [class.side-bottom]="side() === 'bottom'"
      [class.side-left]="side() === 'left'"
      (mousedown)="$event.stopPropagation(); onStartDrag($event)"
    ></div>
  `,
  styles: [`
    :host {
      position: absolute;
      z-index: 10;
    }
    .handle {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: #7c5cff;
      border: 2px solid #0e0e11;
      cursor: crosshair;
      transition: transform 0.15s ease, background 0.15s ease;
    }
    .handle:hover, .handle.snap-highlight {
      background: #ff6b6b;
      transform: scale(1.4);
    }
    .side-top { }
    .side-right { }
    .side-bottom { }
    .side-left { }
  `],
})
export class HandleComponent {
  side = input.required<HandleSide>();
  nodeId = input.required<string>();
  isHighlighted = input(false);
  startDrag = output<{ nodeId: string; handle: HandleSide; event: MouseEvent }>();

  onStartDrag(event: MouseEvent): void {
    this.startDrag.emit({
      nodeId: this.nodeId(),
      handle: this.side(),
      event,
    });
  }
}
