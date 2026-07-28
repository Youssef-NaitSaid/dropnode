import { Component, signal, inject, Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly message = signal<string | null>(null);
  readonly type = signal<'error' | 'info' | 'success'>('info');
  private timeoutId: any = null;

  show(msg: string, toastType: 'error' | 'info' | 'success' = 'info', duration = 4000): void {
    this.message.set(msg);
    this.type.set(toastType);
    if (this.timeoutId) clearTimeout(this.timeoutId);
    this.timeoutId = setTimeout(() => this.dismiss(), duration);
  }

  dismiss(): void {
    this.message.set(null);
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }
}

@Component({
  selector: 'app-toast',
  standalone: true,
  template: `
    @if (toastService.message(); as msg) {
      <div class="toast" [class]="'toast-' + toastService.type()">
        <span>{{ msg }}</span>
        <button class="toast-close" (click)="toastService.dismiss()">×</button>
      </div>
    }
  `,
  styles: [`
    :host {
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 1000;
    }
    .toast {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 20px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      animation: slideIn 0.3s ease;
      max-width: 400px;
    }
    .toast-error {
      background: #ff4757;
      color: white;
    }
    .toast-info {
      background: #6c63ff;
      color: white;
    }
    .toast-success {
      background: #2ed573;
      color: #1a1a2e;
    }
    .toast-close {
      background: none;
      border: none;
      color: inherit;
      font-size: 18px;
      cursor: pointer;
      opacity: 0.7;
      padding: 0;
      line-height: 1;
    }
    .toast-close:hover {
      opacity: 1;
    }
    @keyframes slideIn {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
  `],
})
export class ToastComponent {
  toastService = inject(ToastService);
}
