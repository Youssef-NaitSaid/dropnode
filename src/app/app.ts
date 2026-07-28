import { Component } from '@angular/core';
import { AppShellComponent } from './components/app-shell/app-shell';
import { KeyboardShortcuts } from './directives/keyboard-shortcuts';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [AppShellComponent, KeyboardShortcuts],
  template: `
    <div appKeyboardShortcuts>
      <app-shell />
    </div>
  `,
})
export class App {
  title = 'dropnode';
}
