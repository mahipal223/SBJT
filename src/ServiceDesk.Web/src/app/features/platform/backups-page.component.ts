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
      <svg class="refresh-icon" [class.spin]="loading()" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="23 4 23 10 17 10"></polyline>
        <polyline points="1 20 1 14 7 14"></polyline>
        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
      </svg>
      {{ loading() ? 'Refreshing…' : 'Refresh Runs' }}
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
.page-container { display: flex; flex-direction: column; gap: 1.5rem; width: 100%; }
.page-header { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem; }
h2 { font-size: 24px; font-weight: 800; color: var(--ink); margin: 0; font-family: 'Manrope', sans-serif; }
.subtitle { font-size: 13px; color: var(--muted); margin: 4px 0 0; }
.btn-refresh { display: inline-flex; align-items: center; gap: 8px; padding: 8px 16px; border-radius: 8px; background: #fff; color: var(--navy); border: 1px solid var(--line); font-size: 13px; font-weight: 700; cursor: pointer; transition: all 0.15s ease; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04); }
.btn-refresh:hover:not(:disabled) { background: #f8fafb; border-color: #cbd5e1; color: var(--teal-dark); }
.btn-refresh:disabled { opacity: 0.6; cursor: not-allowed; }
.refresh-icon.spin { animation: spin 0.8s linear infinite; }
.table-card { background: #fff; border: 1px solid var(--line); border-radius: 12px; overflow-x: auto; box-shadow: var(--shadow); width: 100%; }
.data-table { width: 100%; border-collapse: collapse; text-align: left; font-size: 13px; }
.data-table th { padding: 12px 16px; background: #f8fafb; color: var(--muted); font-weight: 700; text-transform: uppercase; font-size: 11px; letter-spacing: .05em; border-bottom: 1px solid var(--line); }
.data-table td { padding: 14px 16px; border-bottom: 1px solid var(--line-soft); color: var(--ink); }
.data-table tr:hover td { background: #f8fafb; }
.mono { font-family: monospace; font-size: 12px; color: var(--navy); font-weight: 600; }
.status-badge { display: inline-block; padding: 3px 8px; border-radius: 12px; font-size: 11px; font-weight: 700; background: #e9f0f3; color: var(--muted); }
.status-badge.success { background: var(--teal-tint); color: var(--teal-dark); border: 1px solid #b7e8de; }
.status-badge.running { background: var(--blue-bg); color: var(--blue); border: 1px solid #cfe0fc; }
.btn-restore { padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: 700; background: #fff; color: var(--teal-dark); border: 1px solid #b7e8de; cursor: pointer; transition: all 0.15s; }
.btn-restore:hover { background: var(--teal-tint); }
.state-card { background: #fff; border: 1px solid var(--line); border-radius: 12px; padding: 3rem 1.5rem; text-align: center; color: var(--muted); box-shadow: var(--shadow); }
.spinner { width: 28px; height: 28px; border: 3px solid var(--line); border-top-color: var(--teal); border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto 0.75rem; }
@keyframes spin { to { transform: rotate(360deg); } }
.modal-backdrop { position: fixed; inset: 0; background: rgba(10, 28, 36, 0.55); backdrop-filter: blur(2px); display: grid; place-items: center; z-index: 50; padding: 1rem; }
.modal-card { width: 100%; max-width: 480px; background: #fff; border: 1px solid var(--line); border-radius: 14px; padding: 1.75rem; box-shadow: 0 20px 40px rgba(16, 41, 54, 0.18); color: var(--ink); }
.modal-card h3 { margin: 0 0 0.5rem; font-size: 18px; font-weight: 800; color: var(--ink); font-family: 'Manrope', sans-serif; }
.modal-desc { font-size: 13px; color: var(--muted); margin-bottom: 1.25rem; }
.form-group label { display: block; font-size: 12px; font-weight: 700; color: var(--ink); margin-bottom: 0.35rem; }
.modal-input { width: 100%; padding: 8px 12px; border-radius: 8px; background: #fff; border: 1px solid var(--line); color: var(--ink); font-size: 13px; box-sizing: border-box; }
select.modal-input { appearance: none; -webkit-appearance: none; padding-right: 36px; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23647985' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 14px center; cursor: pointer; }
.modal-input:focus { outline: 2px solid var(--teal-tint); border-color: var(--teal); }
.modal-alert { margin-top: 1rem; font-size: 13px; padding: 10px 14px; border-radius: 8px; }
.modal-alert.success { background: var(--teal-tint); border: 1px solid #b7e8de; color: var(--teal-dark); }
.modal-alert.error { background: var(--red-bg); border: 1px solid #fed2d2; color: var(--red); }
.modal-actions { display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1.5rem; }
.btn-cancel { padding: 8px 16px; border-radius: 6px; background: #fff; border: 1px solid var(--line); color: var(--ink); font-weight: 600; font-size: 13px; cursor: pointer; }
.btn-cancel:hover { background: #f8fafb; }
.btn-confirm { padding: 8px 16px; border-radius: 6px; background: var(--teal); border: 0; color: #fff; font-weight: 700; font-size: 13px; cursor: pointer; }
.btn-confirm:hover:not(:disabled) { background: var(--teal-dark); }
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
