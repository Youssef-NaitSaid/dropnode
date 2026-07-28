import { Component, signal, inject, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { GraphService } from '../../services/graph.service';
import { ToastService } from '../toast/toast';

@Component({
  selector: 'app-import-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  template: `
    @if (isOpen()) {
      <div class="dialog-overlay" (click)="close()">
        <div class="dialog-content" (click)="$event.stopPropagation()">
          <h2 class="dialog-title">Import Graph</h2>

          <div class="dialog-tabs">
            <button
              class="tab-btn"
              [class.active]="activeTab() === 'file'"
              (click)="activeTab.set('file')"
            >File Upload</button>
            <button
              class="tab-btn"
              [class.active]="activeTab() === 'text'"
              (click)="activeTab.set('text')"
            >Paste JSON</button>
          </div>

          @if (activeTab() === 'file') {
            <div class="file-upload-area">
              <input
                type="file"
                accept=".json"
                (change)="onFileSelected($event)"
                class="file-input"
              />
              <p class="file-hint">Select a .json file to import</p>
            </div>
          }

          @if (activeTab() === 'text') {
            <textarea
              class="json-input"
              [(ngModel)]="jsonText"
              placeholder='Paste your JSON here...'
              rows="10"
            ></textarea>
          }

          @if (errorMessage()) {
            <p class="error-message">{{ errorMessage() }}</p>
          }

          <div class="dialog-actions">
            <button class="btn btn-cancel" (click)="close()">Cancel</button>
            <button
              class="btn btn-import"
              [disabled]="!canImport()"
              (click)="doImport()"
            >Import</button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .dialog-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.6);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 100;
    }
    .dialog-content {
      background: #252542;
      border-radius: 12px;
      padding: 24px;
      width: 480px;
      max-width: 90vw;
      box-shadow: 0 8px 32px rgba(0,0,0,0.4);
    }
    .dialog-title {
      color: #f0f0f5;
      font-size: 20px;
      font-weight: 600;
      margin: 0 0 20px 0;
    }
    .dialog-tabs {
      display: flex;
      gap: 4px;
      margin-bottom: 16px;
      background: #1a1a2e;
      border-radius: 8px;
      padding: 4px;
    }
    .tab-btn {
      flex: 1;
      padding: 8px 16px;
      border: none;
      border-radius: 6px;
      background: transparent;
      color: #8888aa;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .tab-btn.active {
      background: #6c63ff;
      color: white;
    }
    .tab-btn:hover:not(.active) {
      color: #f0f0f5;
    }
    .file-upload-area {
      border: 2px dashed #3a3a5c;
      border-radius: 8px;
      padding: 32px;
      text-align: center;
      margin-bottom: 16px;
    }
    .file-input {
      color: #8888aa;
      font-size: 14px;
    }
    .file-input::file-selector-button {
      background: #6c63ff;
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 6px;
      cursor: pointer;
      margin-right: 12px;
      font-size: 14px;
    }
    .file-hint {
      color: #8888aa;
      font-size: 13px;
      margin-top: 8px;
    }
    .json-input {
      width: 100%;
      background: #1a1a2e;
      border: 1px solid #3a3a5c;
      border-radius: 8px;
      color: #f0f0f5;
      font-family: 'JetBrains Mono', 'Fira Code', monospace;
      font-size: 13px;
      padding: 12px;
      resize: vertical;
      margin-bottom: 16px;
      box-sizing: border-box;
    }
    .json-input:focus {
      outline: none;
      border-color: #6c63ff;
    }
    .error-message {
      color: #ff4757;
      font-size: 13px;
      margin-bottom: 12px;
    }
    .dialog-actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }
    .btn {
      padding: 8px 20px;
      border: none;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .btn-cancel {
      background: #3a3a5c;
      color: #f0f0f5;
    }
    .btn-cancel:hover {
      background: #4a4a6c;
    }
    .btn-import {
      background: #6c63ff;
      color: white;
    }
    .btn-import:hover:not(:disabled) {
      background: #5a52e0;
    }
    .btn-import:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  `],
})
export class ImportDialogComponent {
  private graphService = inject(GraphService);
  private toastService = inject(ToastService);

  isOpen = signal(false);
  activeTab = signal<'file' | 'text'>('file');
  jsonText = '';
  errorMessage = signal<string | null>(null);
  private pendingJson: string | null = null;

  open(): void {
    this.isOpen.set(true);
    this.jsonText = '';
    this.errorMessage.set(null);
    this.pendingJson = null;
  }

  close(): void {
    this.isOpen.set(false);
  }

  canImport(): boolean {
    return !!this.pendingJson || this.jsonText.trim().length > 0;
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      this.pendingJson = reader.result as string;
      this.errorMessage.set(null);
    };
    reader.onerror = () => {
      this.errorMessage.set('Failed to read file');
    };
    reader.readAsText(file);
  }

  doImport(): void {
    const jsonStr = this.pendingJson || this.jsonText;
    if (!jsonStr) return;

    try {
      const parsed = JSON.parse(jsonStr);
      const result = this.graphService.importGraph(parsed);
      if (result.success) {
        this.toastService.show('Graph imported successfully', 'success');
        this.close();
      } else {
        this.errorMessage.set(result.error ?? 'Import failed: invalid graph data');
      }
    } catch (e) {
      this.errorMessage.set('Invalid JSON: ' + (e instanceof Error ? e.message : 'parse error'));
    }
  }
}
