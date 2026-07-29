import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideWaypoints,
  lucidePanelLeftClose,
  lucidePanelLeftOpen,
  lucideLibrary,
} from '@ng-icons/lucide';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmTooltip } from '@spartan-ng/helm/tooltip';
import { HlmSeparator } from '@spartan-ng/helm/separator';
import {
  HlmEmpty,
  HlmEmptyHeader,
  HlmEmptyMedia,
  HlmEmptyTitle,
  HlmEmptyDescription,
} from '@spartan-ng/helm/empty';
import { SidebarService } from '../../services/sidebar.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgIcon,
    HlmButton,
    HlmTooltip,
    HlmSeparator,
    HlmEmpty,
    HlmEmptyHeader,
    HlmEmptyMedia,
    HlmEmptyTitle,
    HlmEmptyDescription,
  ],
  providers: [
    provideIcons({ lucideWaypoints, lucidePanelLeftClose, lucidePanelLeftOpen, lucideLibrary }),
  ],
  template: `
    <aside
      class="flex h-full flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border transition-[width] duration-200 ease-linear overflow-hidden"
      [style.width.px]="sidebar.collapsed() ? 52 : 250"
      aria-label="Primary"
    >
      <!-- Header: brand + collapse toggle -->
      @if (sidebar.collapsed()) {
        <div class="flex flex-col items-center gap-1 py-2 shrink-0">
          <span
            class="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground text-[length:--spacing(4.5)]"
          >
            <ng-icon name="lucideWaypoints" />
          </span>
          <button
            hlmBtn
            size="icon"
            variant="ghost"
            (click)="sidebar.toggle()"
            [hlmTooltip]="'Expand sidebar (Ctrl+B)'"
            position="right"
            aria-label="Expand sidebar"
          >
            <ng-icon name="lucidePanelLeftOpen" />
          </button>
        </div>
      } @else {
        <div class="flex items-center gap-2 h-14 px-2.5 shrink-0">
          <span
            class="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground text-[length:--spacing(4.5)]"
          >
            <ng-icon name="lucideWaypoints" />
          </span>
          <span class="text-base font-bold tracking-tight truncate">dropnode</span>
          <button
            hlmBtn
            size="icon"
            variant="ghost"
            class="ml-auto"
            (click)="sidebar.toggle()"
            aria-label="Collapse sidebar"
            title="Collapse sidebar (Ctrl+B)"
          >
            <ng-icon name="lucidePanelLeftClose" />
          </button>
        </div>
      }

      <hlm-separator orientation="horizontal" />

      <!-- Body: Collections -->
      <nav class="flex-1 min-h-0 overflow-y-auto" aria-label="Collections">
        @if (sidebar.collapsed()) {
          <div class="flex flex-col items-center gap-1 py-2">
            <div
              class="flex size-9 items-center justify-center rounded-md text-muted-foreground"
              [hlmTooltip]="'Collections'"
              position="right"
            >
              <ng-icon name="lucideLibrary" />
            </div>
          </div>
        } @else {
          <div class="px-2 py-2">
            <div class="px-2 py-1.5 text-xs font-medium text-muted-foreground">Collections</div>
            <div hlmEmpty class="border !p-6 mt-1 gap-2">
              <div hlmEmptyHeader>
                <div hlmEmptyMedia variant="icon">
                  <ng-icon name="lucideLibrary" />
                </div>
                <div hlmEmptyTitle class="!text-sm">No collections yet</div>
                <div hlmEmptyDescription class="!text-xs">
                  Collections and projects will appear here.
                </div>
              </div>
            </div>
          </div>
        }
      </nav>
    </aside>
  `,
})
export class SidebarComponent {
  protected readonly sidebar = inject(SidebarService);
}
