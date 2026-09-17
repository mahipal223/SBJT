import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  PlatformAdminApiService,
  PlatformAdminAuditEventResponse
} from '../../core/platform-admin-api.service';
import { PlatformContextService } from '../../core/platform-context.service';

@Component({
  selector: 'app-platform-audit',
  standalone: true,
  imports: [CommonModule],
  template: `
<div class="page-container">
  <div class="page-header">
    <div>
      <h2>Platform Audit Log</h2>
      <p class="subtitle">Immutable chronological audit trail of operator actions, status changes, and platform events.</p>
    </div>
    <button type="button" class="btn-refresh" (click)="loadAuditEvents()" [disabled]="loading()">
      <svg class="refresh-icon" [class.spin]="loading()" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="23 4 23 10 17 10"></polyline>
        <polyline points="1 20 1 14 7 14"></polyline>
        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
      </svg>
      {{ loading() ? 'Refreshing…' : 'Refresh Audit Trail' }}
    </button>
  </div>

  @if (loading()) {
    <div class="state-card loading">
      <div class="spinner"></div>
      <p>Loading platform audit trail…</p>
    </div>
  } @else if (error()) {
    <div class="state-card error">
      <p class="error-msg">⚠️ {{ error() }}</p>
      <button type="button" class="btn-retry" (click)="loadAuditEvents()">Try Again</button>
    </div>
  } @else if (events().length === 0) {
    <div class="state-card empty">
      <p>No platform audit events found.</p>
    </div>
  } @else {
    <div class="table-card">
      <table class="data-table">
        <thead>
          <tr>
            <th>Timestamp</th>
            <th>Action</th>
            <th>Target Workspace</th>
            <th>Operator (Actor)</th>
            <th>Details & Metadata</th>
          </tr>
        </thead>
        <tbody>
          @for (event of events(); track event.id) {
            <tr>
              <td class="nowrap">{{ event.createdAt | date:'medium' }}</td>
              <td><span class="action-tag">{{ event.action }}</span></td>
              <td>
                @if (event.businessName) {
                  <strong>{{ event.businessName }}</strong>
                  <span class="mono-sub">{{ event.businessId }}</span>
                } @else {
                  <span class="muted">Global / System</span>
                }
              </td>
              <td><span class="mono">{{ event.actorUserId }}</span></td>
              <td class="details-cell">{{ event.details || '—' }}</td>
            </tr>
          }
        </tbody>
      </table>
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
.nowrap { white-space: nowrap; }
.action-tag { display: inline-block; padding: 3px 8px; border-radius: 12px; font-size: 11px; font-weight: 700; background: var(--teal-tint); color: var(--teal-dark); border: 1px solid #b7e8de; }
.mono { font-family: monospace; font-size: 12px; color: var(--navy); font-weight: 600; }
.mono-sub { display: block; font-family: monospace; font-size: 11px; color: var(--muted); }
.muted { color: var(--muted); font-style: italic; }
.details-cell { max-width: 320px; word-break: break-word; font-size: 12px; color: var(--muted); }
.state-card { background: #fff; border: 1px solid var(--line); border-radius: 12px; padding: 3rem 1.5rem; text-align: center; color: var(--muted); box-shadow: var(--shadow); }
.spinner { width: 28px; height: 28px; border: 3px solid var(--line); border-top-color: var(--teal); border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto 0.75rem; }
@keyframes spin { to { transform: rotate(360deg); } }
  `
})
export class PlatformAuditComponent implements OnInit {
  private readonly api = inject(PlatformAdminApiService);
  readonly platformContext = inject(PlatformContextService);

  readonly events = signal<PlatformAdminAuditEventResponse[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  ngOnInit(): void {
    this.loadAuditEvents();
  }

  loadAuditEvents(): void {
    this.loading.set(true);
    this.error.set(null);

    this.api.getAdminAuditEvents(50).subscribe({
      next: items => {
        this.events.set(items);
        this.loading.set(false);
      },
      error: err => {
        this.error.set(err?.error?.detail || err?.message || 'Failed to load platform audit trail.');
        this.loading.set(false);
      }
    });
  }
}
