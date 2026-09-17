import { Component, HostListener, OnInit, inject, signal } from '@angular/core';
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

      <div class="custom-dropdown" (click)="$event.stopPropagation()">
        <button
          type="button"
          class="dropdown-trigger"
          (click)="statusDropdownOpen.set(!statusDropdownOpen())"
          [class.open]="statusDropdownOpen()"
          aria-haspopup="listbox"
          [attr.aria-expanded]="statusDropdownOpen()">
          <span>{{ selectedStatusLabel() }}</span>
          <svg class="chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </button>

        @if (statusDropdownOpen()) {
          <div class="dropdown-menu" role="listbox">
            @for (opt of statusOptions; track opt.value) {
              <button
                type="button"
                class="dropdown-item"
                role="option"
                [attr.aria-selected]="statusFilter === opt.value"
                [class.selected]="statusFilter === opt.value"
                (click)="selectStatus(opt.value)">
                <span>{{ opt.label }}</span>
                @if (statusFilter === opt.value) {
                  <span class="check-icon">✓</span>
                }
              </button>
            }
          </div>
        }
      </div>

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
.page-container { display: flex; flex-direction: column; gap: 1.5rem; width: 100%; }
.page-header { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem; }
h2 { font-size: 24px; font-weight: 800; color: var(--ink); margin: 0; font-family: 'Manrope', sans-serif; }
.subtitle { font-size: 13px; color: var(--muted); margin: 4px 0 0; }
.filter-bar { display: flex; gap: 0.65rem; flex-wrap: wrap; align-items: center; }
.search-input { height: 40px; width: 260px; padding: 0 14px; border-radius: 8px; background: #fff; border: 1px solid var(--line); color: var(--ink); font-size: 13px; font-family: inherit; transition: all 0.15s; }
.search-input:focus { outline: 2px solid var(--teal-tint); border-color: var(--teal); }
.custom-dropdown { position: relative; display: inline-block; }
.dropdown-trigger { height: 40px; min-width: 155px; padding: 0 14px; border: 1px solid var(--line); border-radius: 8px; background: #fff; color: var(--ink); font-size: 13px; font-weight: 600; font-family: inherit; display: inline-flex; align-items: center; justify-content: space-between; gap: 10px; cursor: pointer; transition: all 0.15s ease; box-shadow: 0 1px 2px rgba(0,0,0,0.03); }
.dropdown-trigger:hover { border-color: #cbd5e1; background: #f8fafb; }
.dropdown-trigger.open { border-color: var(--teal); outline: 2px solid var(--teal-tint); background: #fff; }
.chevron { transition: transform 0.2s ease; color: var(--muted); flex-shrink: 0; }
.dropdown-trigger.open .chevron { transform: rotate(180deg); color: var(--teal); }
.dropdown-menu { position: absolute; top: calc(100% + 5px); left: 0; min-width: 175px; background: #fff; border: 1px solid var(--line); border-radius: 10px; box-shadow: 0 10px 25px rgba(16, 41, 54, 0.12); padding: 5px; z-index: 100; animation: dropdownFade 0.12s ease; }
@keyframes dropdownFade { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
.dropdown-item { width: 100%; padding: 9px 12px; border: 0; background: transparent; border-radius: 6px; text-align: left; font-size: 13px; font-weight: 600; font-family: inherit; color: var(--ink); display: flex; align-items: center; justify-content: space-between; cursor: pointer; transition: background 0.12s; }
.dropdown-item:hover { background: #f4f7f9; color: var(--teal-dark); }
.dropdown-item.selected { background: var(--teal-tint); color: var(--teal-dark); font-weight: 700; }
.check-icon { color: var(--teal); font-weight: 800; font-size: 13px; margin-left: 8px; }
.btn-primary { height: 40px; padding: 0 20px; border-radius: 8px; background: var(--teal); color: #fff; border: 0; font-weight: 700; font-size: 13px; cursor: pointer; transition: background 0.15s; display: inline-flex; align-items: center; justify-content: center; }
.btn-primary:hover { background: var(--teal-dark); }
.table-card { background: #fff; border: 1px solid var(--line); border-radius: 12px; overflow-x: auto; box-shadow: var(--shadow); width: 100%; }
.data-table { width: 100%; border-collapse: collapse; text-align: left; font-size: 13px; }
.data-table th { padding: 12px 16px; background: #f8fafb; color: var(--muted); font-weight: 700; text-transform: uppercase; font-size: 11px; letter-spacing: .05em; border-bottom: 1px solid var(--line); }
.data-table td { padding: 14px 16px; border-bottom: 1px solid var(--line-soft); color: var(--ink); vertical-align: middle; }
.data-table tr:hover td { background: #f8fafb; }
.biz-name { display: block; color: var(--ink); font-weight: 700; font-size: 14px; }
.biz-id { display: block; font-size: 11px; color: var(--muted); font-family: monospace; margin-top: 2px; }
.status-badge { display: inline-block; padding: 3px 8px; border-radius: 12px; font-size: 11px; font-weight: 700; }
.status-badge.active { background: var(--teal-tint); color: var(--teal-dark); border: 1px solid #b7e8de; }
.status-badge.suspended { background: var(--red-bg); color: var(--red); border: 1px solid #fed2d2; }
.plan-info { display: flex; flex-direction: column; gap: 0.15rem; }
.plan-name { font-weight: 700; color: var(--ink); }
.member-count { font-size: 12px; color: var(--muted); }
.action-btn { padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: 700; border: 1px solid transparent; cursor: pointer; transition: all 0.15s; }
.action-btn.warn { background: #fff; color: var(--red); border-color: #fed2d2; }
.action-btn.warn:hover { background: var(--red-bg); }
.action-btn.ok { background: #fff; color: var(--teal-dark); border-color: #b7e8de; }
.action-btn.ok:hover { background: var(--teal-tint); }
.state-card { background: #fff; border: 1px solid var(--line); border-radius: 12px; padding: 3rem 1.5rem; text-align: center; color: var(--muted); box-shadow: var(--shadow); }
.spinner { width: 28px; height: 28px; border: 3px solid var(--line); border-top-color: var(--teal); border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto 0.75rem; }
@keyframes spin { to { transform: rotate(360deg); } }
.modal-backdrop { position: fixed; inset: 0; background: rgba(10, 28, 36, 0.55); backdrop-filter: blur(2px); display: grid; place-items: center; z-index: 50; padding: 1rem; }
.modal-card { width: 100%; max-width: 480px; background: #fff; border: 1px solid var(--line); border-radius: 14px; padding: 1.75rem; box-shadow: 0 20px 40px rgba(16, 41, 54, 0.18); color: var(--ink); }
.modal-card h3 { margin: 0 0 0.5rem; font-size: 18px; font-weight: 800; color: var(--ink); font-family: 'Manrope', sans-serif; }
.modal-desc { font-size: 13px; color: var(--muted); margin-bottom: 1.25rem; }
.form-group label { display: block; font-size: 12px; font-weight: 700; color: var(--ink); margin-bottom: 0.35rem; }
.modal-input { width: 100%; padding: 8px 12px; border-radius: 8px; background: #fff; border: 1px solid var(--line); color: var(--ink); font-size: 13px; box-sizing: border-box; }
.modal-input:focus { outline: 2px solid var(--teal-tint); border-color: var(--teal); }
.modal-alert { margin-top: 0.75rem; font-size: 12px; color: var(--red); }
.modal-actions { display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1.5rem; }
.btn-cancel { padding: 8px 16px; border-radius: 6px; background: #fff; border: 1px solid var(--line); color: var(--ink); font-weight: 600; font-size: 13px; cursor: pointer; }
.btn-cancel:hover { background: #f8fafb; }
.btn-confirm { padding: 8px 16px; border-radius: 6px; background: var(--teal); border: 0; color: #fff; font-weight: 700; font-size: 13px; cursor: pointer; }
.btn-confirm:hover:not(:disabled) { background: var(--teal-dark); }
.btn-confirm.danger { background: var(--red); }
.btn-confirm.danger:hover:not(:disabled) { background: #9e2a2a; }
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

  readonly statusDropdownOpen = signal(false);
  readonly statusOptions = [
    { value: '', label: 'All Statuses' },
    { value: 'Active', label: 'Active' },
    { value: 'Suspended', label: 'Suspended' },
    { value: 'Closed', label: 'Closed' }
  ];

  @HostListener('document:click')
  onDocumentClick(): void {
    this.statusDropdownOpen.set(false);
  }

  selectStatus(val: string): void {
    this.statusFilter = val;
    this.statusDropdownOpen.set(false);
    this.loadBusinesses();
  }

  selectedStatusLabel(): string {
    const opt = this.statusOptions.find(o => o.value === this.statusFilter);
    return opt ? opt.label : 'All Statuses';
  }

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
