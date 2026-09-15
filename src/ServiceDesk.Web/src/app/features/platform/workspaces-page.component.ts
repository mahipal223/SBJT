import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PlatformAdminApiService, PlatformBusinessSummaryResponse } from '../../core/platform-admin-api.service';
import { PlatformContextService } from '../../core/platform-context.service';

@Component({
  selector: 'app-platform-workspaces',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
<div class="page-container">
  <div class="page-header">
    <div>
      <h2>Tenant Workspaces</h2>
      <p class="subtitle">Cross-tenant business supervision, status transitions, and subscription oversight.</p>
    </div>
    <div class="filter-bar">
      <input
        type="search"
        placeholder="Search by name or email…"
        [(ngModel)]="searchQuery"
        (keyup.enter)="loadBusinesses()"
        class="search-input" />

      <select [(ngModel)]="statusFilter" (change)="loadBusinesses()" class="status-select">
        <option value="">All Statuses</option>
        <option value="Active">Active</option>
        <option value="Suspended">Suspended</option>
        <option value="Closed">Closed</option>
      </select>

      <button type="button" class="btn-primary" (click)="loadBusinesses()">Filter</button>
    </div>
  </div>

  @if (loading()) {
    <div class="state-card loading">
      <div class="spinner"></div>
      <p>Loading tenant workspaces…</p>
    </div>
  } @else if (error()) {
    <div class="state-card error">
      <p class="error-msg">⚠️ {{ error() }}</p>
      <button type="button" class="btn-retry" (click)="loadBusinesses()">Try Again</button>
    </div>
  } @else if (businesses().length === 0) {
    <div class="state-card empty">
      <p>No tenant workspaces match the selected criteria.</p>
    </div>
  } @else {
    <div class="table-card">
      <table class="data-table">
        <thead>
          <tr>
            <th>Workspace</th>
            <th>Industry</th>
            <th>Status</th>
            <th>Plan & Members</th>
            <th>Billing Email</th>
            <th>Created</th>
            @if (platformContext.canViewMetrics()) {
              <th>Actions</th>
            }
          </tr>
        </thead>
        <tbody>
          @for (b of businesses(); track b.id) {
            <tr>
              <td>
                <strong class="biz-name">{{ b.name }}</strong>
                <span class="biz-id">{{ b.id }}</span>
              </td>
              <td>{{ b.industry }}</td>
              <td>
                <span class="status-badge" [class.active]="b.status === 'Active'" [class.suspended]="b.status === 'Suspended'">
                  {{ b.status }}
                </span>
              </td>
              <td>
                <div class="plan-info">
                  <span class="plan-name">{{ b.planName || 'No Plan' }}</span>
                  <span class="member-count">{{ b.memberCount }} members</span>
                </div>
              </td>
              <td>{{ b.billingEmail }}</td>
              <td>{{ b.createdAt | date:'shortDate' }}</td>
              @if (platformContext.canViewMetrics()) {
                <td>
                  @if (b.status === 'Active') {
                    <button type="button" class="action-btn warn" (click)="openStatusModal(b, 'Suspended')">
                      Suspend
                    </button>
                  } @else if (b.status === 'Suspended') {
                    <button type="button" class="action-btn ok" (click)="openStatusModal(b, 'Active')">
                      Reactivate
                    </button>
                  }
                </td>
              }
            </tr>
          }
        </tbody>
      </table>
    </div>
  }

  <!-- Status Transition Modal -->
  @if (statusModalOpen()) {
    <div class="modal-backdrop">
      <div class="modal-card">
        <h3>{{ targetStatus() === 'Suspended' ? 'Suspend Business' : 'Reactivate Business' }}</h3>
        <p class="modal-desc">
          You are changing the operational status for <strong>{{ targetBusiness()?.name }}</strong> to <em>{{ targetStatus() }}</em>.
        </p>

        <div class="form-group">
          <label>Reason for change (required):</label>
          <textarea
            [(ngModel)]="statusReason"
            placeholder="Document administrative justification for platform audit log…"
            rows="3"
            class="modal-input"></textarea>
        </div>

        @if (modalError()) {
          <div class="modal-alert">{{ modalError() }}</div>
        }

        <div class="modal-actions">
          <button type="button" class="btn-cancel" (click)="closeStatusModal()">Cancel</button>
          <button
            type="button"
            class="btn-confirm"
            [class.danger]="targetStatus() === 'Suspended'"
            [disabled]="submittingStatus() || !statusReason.trim()"
            (click)="submitStatusChange()">
            @if (submittingStatus()) { Updating… } @else { Confirm Status Change }
          </button>
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
.filter-bar { display: flex; gap: 0.5rem; flex-wrap: wrap; }
.search-input { width: 240px; padding: 0.5rem 0.75rem; border-radius: 6px; background: #1e293b; border: 1px solid #334155; color: #f8fafc; font-size: 0.85rem; }
.status-select { padding: 0.5rem 0.75rem; border-radius: 6px; background: #1e293b; border: 1px solid #334155; color: #f8fafc; font-size: 0.85rem; }
.btn-primary { padding: 0.5rem 1rem; border-radius: 6px; background: #6366f1; color: #fff; border: 0; font-weight: 600; cursor: pointer; }
.table-card { background: #1e293b; border: 1px solid #334155; border-radius: 10px; overflow-x: auto; }
.data-table { width: 100%; border-collapse: collapse; text-align: left; font-size: 0.85rem; }
.data-table th { padding: 0.85rem 1rem; background: #0f172a; color: #94a3b8; font-weight: 600; text-transform: uppercase; font-size: 0.75rem; border-bottom: 1px solid #334155; }
.data-table td { padding: 0.85rem 1rem; border-bottom: 1px solid #1e293b; color: #cbd5e1; vertical-align: middle; }
.data-table tr:hover td { background: #24344d; }
.biz-name { display: block; color: #f8fafc; font-weight: 600; }
.biz-id { display: block; font-size: 0.75rem; color: #64748b; }
.status-badge { display: inline-block; padding: 0.2rem 0.6rem; border-radius: 6px; font-size: 0.75rem; font-weight: 700; background: #334155; color: #cbd5e1; }
.status-badge.active { background: rgba(34, 197, 94, 0.15); color: #4ade80; border: 1px solid #22c55e; }
.status-badge.suspended { background: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid #ef4444; }
.plan-info { display: flex; flex-direction: column; gap: 0.15rem; }
.plan-name { font-weight: 600; color: #f1f5f9; }
.member-count { font-size: 0.75rem; color: #94a3b8; }
.action-btn { padding: 0.35rem 0.75rem; border-radius: 5px; font-size: 0.75rem; font-weight: 600; border: 1px solid transparent; cursor: pointer; }
.action-btn.warn { background: rgba(239, 68, 68, 0.15); color: #fca5a5; border-color: #ef4444; }
.action-btn.ok { background: rgba(34, 197, 94, 0.15); color: #86efac; border-color: #22c55e; }
.state-card { background: #1e293b; border: 1px solid #334155; border-radius: 10px; padding: 3rem 1.5rem; text-align: center; color: #94a3b8; }
.spinner { width: 28px; height: 28px; border: 3px solid #334155; border-top-color: #6366f1; border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto 0.75rem; }
@keyframes spin { to { transform: rotate(360deg); } }
.modal-backdrop { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.65); display: grid; place-items: center; z-index: 50; padding: 1rem; }
.modal-card { width: 100%; max-width: 480px; background: #1e293b; border: 1px solid #475569; border-radius: 12px; padding: 1.75rem; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5); }
.modal-card h3 { margin: 0 0 0.5rem; font-size: 1.2rem; color: #f8fafc; }
.modal-desc { font-size: 0.85rem; color: #94a3b8; margin-bottom: 1.25rem; }
.form-group label { display: block; font-size: 0.8rem; font-weight: 600; color: #cbd5e1; margin-bottom: 0.35rem; }
.modal-input { width: 100%; padding: 0.6rem; border-radius: 6px; background: #0f172a; border: 1px solid #334155; color: #f8fafc; font-size: 0.85rem; box-sizing: border-box; }
.modal-alert { margin-top: 0.75rem; font-size: 0.8rem; color: #f87171; }
.modal-actions { display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1.5rem; }
.btn-cancel { padding: 0.5rem 1rem; border-radius: 6px; background: transparent; border: 1px solid #475569; color: #cbd5e1; cursor: pointer; }
.btn-confirm { padding: 0.5rem 1rem; border-radius: 6px; background: #6366f1; border: 0; color: #fff; font-weight: 600; cursor: pointer; }
.btn-confirm.danger { background: #ef4444; }
.btn-confirm:disabled { opacity: 0.5; cursor: not-allowed; }
  `
})
export class PlatformWorkspacesComponent implements OnInit {
  private readonly api = inject(PlatformAdminApiService);
  readonly platformContext = inject(PlatformContextService);

  readonly businesses = signal<PlatformBusinessSummaryResponse[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  searchQuery = '';
  statusFilter = '';

  // Status modal
  readonly statusModalOpen = signal(false);
  readonly targetBusiness = signal<PlatformBusinessSummaryResponse | null>(null);
  readonly targetStatus = signal<'Active' | 'Suspended'>('Suspended');
  statusReason = '';
  readonly submittingStatus = signal(false);
  readonly modalError = signal<string | null>(null);

  ngOnInit(): void {
    this.loadBusinesses();
  }

  loadBusinesses(): void {
    this.loading.set(true);
    this.error.set(null);

    this.api.getBusinesses(this.searchQuery, this.statusFilter).subscribe({
      next: items => {
        this.businesses.set(items);
        this.loading.set(false);
      },
      error: err => {
        this.error.set(err?.error?.detail || err?.message || 'Failed to load tenant workspaces.');
        this.loading.set(false);
      }
    });
  }

  openStatusModal(b: PlatformBusinessSummaryResponse, newStatus: 'Active' | 'Suspended'): void {
    this.targetBusiness.set(b);
    this.targetStatus.set(newStatus);
    this.statusReason = '';
    this.modalError.set(null);
    this.statusModalOpen.set(true);
  }

  closeStatusModal(): void {
    this.statusModalOpen.set(false);
    this.targetBusiness.set(null);
  }

  submitStatusChange(): void {
    const biz = this.targetBusiness();
    if (!biz || !this.statusReason.trim()) return;

    this.submittingStatus.set(true);
    this.modalError.set(null);

    this.api.updateBusinessStatus(biz.id, this.targetStatus(), this.statusReason.trim()).subscribe({
      next: () => {
        this.submittingStatus.set(false);
        this.closeStatusModal();
        this.loadBusinesses();
      },
      error: err => {
        this.modalError.set(err?.error?.detail || err?.message || 'Status transition failed.');
        this.submittingStatus.set(false);
      }
    });
  }
}
