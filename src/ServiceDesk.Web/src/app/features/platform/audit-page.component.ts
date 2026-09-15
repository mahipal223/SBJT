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
      ⟳ Refresh Audit Trail
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
.page-container { display: flex; flex-direction: column; gap: 1.5rem; }
.page-header { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem; }
h2 { font-size: 1.35rem; font-weight: 700; color: #f8fafc; margin: 0; }
.subtitle { font-size: 0.85rem; color: #94a3b8; margin: 0.25rem 0 0; }
.btn-refresh { padding: 0.5rem 1rem; border-radius: 6px; background: #334155; color: #f8fafc; border: 1px solid #475569; font-size: 0.85rem; font-weight: 600; cursor: pointer; }
.table-card { background: #1e293b; border: 1px solid #334155; border-radius: 10px; overflow-x: auto; }
.data-table { width: 100%; border-collapse: collapse; text-align: left; font-size: 0.85rem; }
.data-table th { padding: 0.85rem 1rem; background: #0f172a; color: #94a3b8; font-weight: 600; text-transform: uppercase; font-size: 0.75rem; border-bottom: 1px solid #334155; }
.data-table td { padding: 0.85rem 1rem; border-bottom: 1px solid #1e293b; color: #cbd5e1; }
.nowrap { white-space: nowrap; }
.action-tag { display: inline-block; padding: 0.2rem 0.6rem; border-radius: 6px; font-size: 0.75rem; font-weight: 700; background: rgba(99, 102, 241, 0.15); color: #a5b4fc; border: 1px solid #6366f1; }
.mono { font-family: monospace; font-size: 0.8rem; color: #818cf8; }
.mono-sub { display: block; font-family: monospace; font-size: 0.75rem; color: #64748b; }
.muted { color: #64748b; font-style: italic; }
.details-cell { max-width: 320px; word-break: break-word; font-size: 0.8rem; color: #94a3b8; }
.state-card { background: #1e293b; border: 1px solid #334155; border-radius: 10px; padding: 3rem 1.5rem; text-align: center; color: #94a3b8; }
.spinner { width: 28px; height: 28px; border: 3px solid #334155; border-top-color: #6366f1; border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto 0.75rem; }
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
