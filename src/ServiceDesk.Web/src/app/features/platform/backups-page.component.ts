import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  PlatformAdminApiService,
  BackupRunResponse,
  RestoreRunResponse
} from '../../core/platform-admin-api.service';
import { PlatformContextService } from '../../core/platform-context.service';

@Component({
  selector: 'app-platform-backups',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
<div class="page-container">
  <div class="page-header">
    <div>
      <h2>Backups & Disaster Recovery</h2>
      <p class="subtitle">Platform database snapshot verification, restore simulations, and recovery point tracking.</p>
    </div>
    <button type="button" class="btn-refresh" (click)="loadBackups()" [disabled]="loading()">
      ⟳ Refresh Runs
    </button>
  </div>

  @if (loading()) {
    <div class="state-card loading">
      <div class="spinner"></div>
      <p>Loading backup run history…</p>
    </div>
  } @else if (error()) {
    <div class="state-card error">
      <p class="error-msg">⚠️ {{ error() }}</p>
      <button type="button" class="btn-retry" (click)="loadBackups()">Try Again</button>
    </div>
  } @else if (runs().length === 0) {
    <div class="state-card empty">
      <p>No platform backup runs recorded.</p>
    </div>
  } @else {
    <div class="table-card">
      <table class="data-table">
        <thead>
          <tr>
            <th>Backup Run ID</th>
            <th>Provider Reference</th>
            <th>Status</th>
            <th>Started</th>
            <th>Completed</th>
            @if (platformContext.canViewBackups()) {
              <th>Disaster Recovery</th>
            }
          </tr>
        </thead>
        <tbody>
          @for (run of runs(); track run.id) {
            <tr>
              <td><span class="mono">{{ run.id }}</span></td>
              <td>{{ run.providerReference }}</td>
              <td>
                <span class="status-badge" [class.success]="run.status === 'Completed'" [class.running]="run.status === 'InProgress'">
                  {{ run.status }}
                </span>
              </td>
              <td>{{ run.startedAt | date:'short' }}</td>
              <td>{{ (run.completedAt | date:'short') || 'In Progress' }}</td>
              @if (platformContext.canViewBackups()) {
                <td>
                  <button type="button" class="btn-restore" (click)="openRestoreModal(run)">
                    Test DR Restore
                  </button>
                </td>
              }
            </tr>
          }
        </tbody>
      </table>
    </div>
  }

  <!-- DR Restore Modal -->
  @if (restoreModalOpen()) {
    <div class="modal-backdrop">
      <div class="modal-card">
        <h3>Trigger Disaster Recovery Restore</h3>
        <p class="modal-desc">
          Initiate an automated restore run for backup snapshot <strong class="mono">{{ targetRun()?.id }}</strong>.
        </p>

        <div class="form-group">
          <label>Target Environment:</label>
          <select [(ngModel)]="targetEnvironment" class="modal-input">
            <option value="dr-sandbox">Disaster Recovery Sandbox (dr-sandbox)</option>
            <option value="staging">Staging Validation (staging)</option>
          </select>
        </div>

        @if (restoreSuccess()) {
          <div class="modal-alert success">
            ✅ Restore run queued successfully! Operation ID: <span class="mono">{{ restoreResult()?.id }}</span> (Status: {{ restoreResult()?.status }})
          </div>
        }

        @if (modalError()) {
          <div class="modal-alert error">{{ modalError() }}</div>
        }

        <div class="modal-actions">
          <button type="button" class="btn-cancel" (click)="closeRestoreModal()">Close</button>
          @if (!restoreSuccess()) {
            <button
              type="button"
              class="btn-confirm"
              [disabled]="submittingRestore()"
              (click)="submitRestore()">
              @if (submittingRestore()) { Initiating… } @else { Launch Restore Run }
            </button>
          }
        </div>
      </div>
    </div>
  }
</div>
  `,
  styles: `
.page-container { display: flex; flex-direction: column; gap: 1.5rem; }
.page-header { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem; }
h2 { font-size: 1.35rem; font-weight: 700; color: #f8fafc; margin: 0; }
.subtitle { font-size: 0.85rem; color: #94a3b8; margin: 0.25rem 0 0; }
.btn-refresh { padding: 0.5rem 1rem; border-radius: 6px; background: #334155; color: #f8fafc; border: 1px solid #475569; font-size: 0.85rem; font-weight: 600; cursor: pointer; }
.table-card { background: #1e293b; border: 1px solid #334155; border-radius: 10px; overflow-x: auto; }
.data-table { width: 100%; border-collapse: collapse; text-align: left; font-size: 0.85rem; }
.data-table th { padding: 0.85rem 1rem; background: #0f172a; color: #94a3b8; font-weight: 600; text-transform: uppercase; font-size: 0.75rem; border-bottom: 1px solid #334155; }
.data-table td { padding: 0.85rem 1rem; border-bottom: 1px solid #1e293b; color: #cbd5e1; }
.mono { font-family: monospace; font-size: 0.8rem; color: #818cf8; }
.status-badge { display: inline-block; padding: 0.2rem 0.6rem; border-radius: 6px; font-size: 0.75rem; font-weight: 700; background: #334155; color: #cbd5e1; }
.status-badge.success { background: rgba(34, 197, 94, 0.15); color: #4ade80; border: 1px solid #22c55e; }
.status-badge.running { background: rgba(59, 130, 246, 0.15); color: #60a5fa; border: 1px solid #3b82f6; }
.btn-restore { padding: 0.35rem 0.75rem; border-radius: 5px; font-size: 0.75rem; font-weight: 600; background: rgba(99, 102, 241, 0.15); color: #a5b4fc; border: 1px solid #6366f1; cursor: pointer; }
.btn-restore:hover { background: rgba(99, 102, 241, 0.3); }
.state-card { background: #1e293b; border: 1px solid #334155; border-radius: 10px; padding: 3rem 1.5rem; text-align: center; color: #94a3b8; }
.spinner { width: 28px; height: 28px; border: 3px solid #334155; border-top-color: #6366f1; border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto 0.75rem; }
@keyframes spin { to { transform: rotate(360deg); } }
.modal-backdrop { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.65); display: grid; place-items: center; z-index: 50; padding: 1rem; }
.modal-card { width: 100%; max-width: 480px; background: #1e293b; border: 1px solid #475569; border-radius: 12px; padding: 1.75rem; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5); }
.modal-card h3 { margin: 0 0 0.5rem; font-size: 1.2rem; color: #f8fafc; }
.modal-desc { font-size: 0.85rem; color: #94a3b8; margin-bottom: 1.25rem; }
.form-group label { display: block; font-size: 0.8rem; font-weight: 600; color: #cbd5e1; margin-bottom: 0.35rem; }
.modal-input { width: 100%; padding: 0.6rem; border-radius: 6px; background: #0f172a; border: 1px solid #334155; color: #f8fafc; font-size: 0.85rem; box-sizing: border-box; }
.modal-alert { margin-top: 1rem; font-size: 0.85rem; padding: 0.75rem; border-radius: 6px; }
.modal-alert.success { background: rgba(34, 197, 94, 0.15); border: 1px solid #22c55e; color: #86efac; }
.modal-alert.error { background: rgba(239, 68, 68, 0.15); border: 1px solid #ef4444; color: #f87171; }
.modal-actions { display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1.5rem; }
.btn-cancel { padding: 0.5rem 1rem; border-radius: 6px; background: transparent; border: 1px solid #475569; color: #cbd5e1; cursor: pointer; }
.btn-confirm { padding: 0.5rem 1rem; border-radius: 6px; background: #6366f1; border: 0; color: #fff; font-weight: 600; cursor: pointer; }
.btn-confirm:disabled { opacity: 0.5; cursor: not-allowed; }
  `
})
export class PlatformBackupsComponent implements OnInit {
  private readonly api = inject(PlatformAdminApiService);
  readonly platformContext = inject(PlatformContextService);

  readonly runs = signal<BackupRunResponse[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly restoreModalOpen = signal(false);
  readonly targetRun = signal<BackupRunResponse | null>(null);
  targetEnvironment = 'dr-sandbox';
  readonly submittingRestore = signal(false);
  readonly restoreSuccess = signal(false);
  readonly restoreResult = signal<RestoreRunResponse | null>(null);
  readonly modalError = signal<string | null>(null);

  ngOnInit(): void {
    this.loadBackups();
  }

  loadBackups(): void {
    this.loading.set(true);
    this.error.set(null);

    this.api.getBackupRuns(25).subscribe({
      next: items => {
        this.runs.set(items);
        this.loading.set(false);
      },
      error: err => {
        this.error.set(err?.error?.detail || err?.message || 'Failed to load backup runs.');
        this.loading.set(false);
      }
    });
  }

  openRestoreModal(run: BackupRunResponse): void {
    this.targetRun.set(run);
    this.targetEnvironment = 'dr-sandbox';
    this.restoreSuccess.set(false);
    this.restoreResult.set(null);
    this.modalError.set(null);
    this.restoreModalOpen.set(true);
  }

  closeRestoreModal(): void {
    this.restoreModalOpen.set(false);
    this.targetRun.set(null);
  }

  submitRestore(): void {
    const run = this.targetRun();
    if (!run) return;

    this.submittingRestore.set(true);
    this.modalError.set(null);

    this.api.createRestoreRun({
      backupRunId: run.id,
      targetEnvironment: this.targetEnvironment
    }).subscribe({
      next: res => {
        this.submittingRestore.set(false);
        this.restoreSuccess.set(true);
        this.restoreResult.set(res);
      },
      error: err => {
        this.modalError.set(err?.error?.detail || err?.message || 'Failed to trigger restore run.');
        this.submittingRestore.set(false);
      }
    });
  }
}
