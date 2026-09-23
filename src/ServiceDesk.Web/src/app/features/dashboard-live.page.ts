import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DashboardSummary, WorkApiService } from '../core/work-api.service';

@Component({
  selector: 'app-dashboard-live',
  standalone: true,
  imports: [CommonModule, RouterLink, CurrencyPipe, DatePipe],
  template: `
    <div class="page dashboard-page">
      <div class="header-row">
        <div>
          <span class="eyebrow">Workspace Operations</span>
          <h1 class="page-title">Executive Overview</h1>
          <p class="subtitle">Live database KPIs, operational dispatching, and attention alerts.</p>
        </div>
        <div class="header-actions">
          <button class="btn" (click)="loadDashboard()" [disabled]="loading()">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:6px">
              <polyline points="23 4 23 10 17 10"></polyline>
              <polyline points="1 20 1 14 7 14"></polyline>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
            </svg>
            {{ loading() ? 'Refreshing...' : 'Refresh' }}
          </button>
          <a routerLink="/app/jobs/new" class="btn primary">＋ New job</a>
        </div>
      </div>

      @if (errorMessage()) {
        <div class="callout error-text" style="margin-bottom: 22px;">
          <p><strong>Error loading metrics:</strong> {{ errorMessage() }}</p>
          <button class="btn btn-secondary btn-sm" style="margin-top: 8px;" (click)="loadDashboard()">Retry</button>
        </div>
      }

      @if (loading() && !summary()) {
        <div class="loading-state card">
          <div class="spinner"></div>
          <p>Calculating live workspace metrics from SQL Server...</p>
        </div>
      }

      @if (summary(); as s) {
        <!-- 4 Primary KPI Stat Cards -->
        <div class="kpi-grid">
          <div class="kpi-card card">
            <div class="kpi-header">
              <span class="kpi-label">Jobs Today</span>
              <span class="kpi-icon icon-jobs">📋</span>
            </div>
            <div class="kpi-value">{{ s.jobsTodayCount }}</div>
            <div class="kpi-meta">
              <span class="badge badge-success">{{ s.jobsCompletedTodayCount }} completed</span>
              @if (s.jobsRemainingTodayCount > 0) {
                <span class="badge badge-neutral">{{ s.jobsRemainingTodayCount }} remaining</span>
              }
            </div>
          </div>

          <div class="kpi-card card">
            <div class="kpi-header">
              <span class="kpi-label">Open Estimates</span>
              <span class="kpi-icon icon-estimates">📝</span>
            </div>
            <div class="kpi-value">{{ s.openEstimatesCount }}</div>
            <div class="kpi-meta">
              <span class="meta-label">{{ s.openEstimatesValue | currency }} in pipeline</span>
            </div>
          </div>

          <div class="kpi-card card">
            <div class="kpi-header">
              <span class="kpi-label">Outstanding Invoices</span>
              <span class="kpi-icon icon-invoices">💳</span>
            </div>
            <div class="kpi-value">{{ s.outstandingInvoicesCount }}</div>
            <div class="kpi-meta">
              <span class="meta-label error-color">{{ s.outstandingInvoicesValue | currency }} pending</span>
            </div>
          </div>

          <div class="kpi-card card highlight-card">
            <div class="kpi-header">
              <span class="kpi-label">Revenue This Month</span>
              <span class="kpi-icon icon-rev">💰</span>
            </div>
            <div class="kpi-value">{{ s.revenueThisMonth | currency }}</div>
            <div class="kpi-meta">
              <span class="meta-label">vs {{ s.revenueLastMonth | currency }} last month</span>
            </div>
          </div>
        </div>

        <!-- Needs Attention Section -->
        <div class="section-gap"></div>
        @if (s.attentionItems && s.attentionItems.length > 0) {
          <div class="attention-box">
            <h2 class="section-title">🚨 Action Required</h2>
            <div class="alert-list">
              @for (item of s.attentionItems; track item.title) {
                <div class="callout error-text attention-item">
                  <div class="attention-content">
                    <strong>{{ item.title }}</strong>
                    <p>{{ item.description }}</p>
                  </div>
                  @if (item.actionUrl) {
                    <a [routerLink]="item.actionUrl" class="btn btn-primary btn-sm">Resolve</a>
                  }
                </div>
              }
            </div>
          </div>
        } @else {
          <div class="callout success-box">
            <div style="display:flex; align-items:center; gap: 10px;">
              <span style="font-size: 20px;">✅</span>
              <div>
                <strong>All systems operational</strong>
                <div style="font-size: 13px; color: var(--text-muted);">No overdue invoices or subscription capacity blockers detected in this workspace.</div>
              </div>
            </div>
          </div>
        }

        <!-- Today's Schedule & Quick Operations -->
        <div class="section-gap"></div>
        <div class="dashboard-columns">
          <div class="main-column card">
            <div class="card-head">
              <div>
                <h2 style="margin:0; font-size: 17px;">Today's Jobs</h2>
                <span class="meta-label">Live dispatch queue directly from SQL Server</span>
              </div>
              <a routerLink="/app/jobs" class="view-all-link">View All Jobs &rarr;</a>
            </div>

            @if (s.todaySchedule.length === 0) {
              <div class="empty-state">
                <p>No jobs scheduled for today yet.</p>
                <a routerLink="/app/jobs" class="btn btn-secondary btn-sm" style="margin-top: 8px;">Dispatch New Job</a>
              </div>
            } @else {
              <div class="table-scroll">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>Job #</th>
                      <th>Title & Customer</th>
                      <th>Priority</th>
                      <th>Status</th>
                      <th>Staff</th>
                      <th>Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (job of s.todaySchedule; track job.id) {
                      <tr>
                        <td>
                          <a [routerLink]="['/app/jobs', job.id]" class="code-link">{{ job.jobNumber }}</a>
                        </td>
                        <td>
                          <div class="job-cell-title">{{ job.title }}</div>
                          <div class="job-cell-cust">{{ job.customerName }}</div>
                        </td>
                        <td>
                          <span class="priority-pill" [ngClass]="'priority-' + job.priority.toLowerCase()">{{ job.priority }}</span>
                        </td>
                        <td>
                          <span class="status-pill" [ngClass]="'status-' + job.status.toLowerCase()">{{ formatStatus(job.status) }}</span>
                        </td>
                        <td>
                          <span class="staff-tag">{{ job.assignedMemberName || 'Staff' }}</span>
                        </td>
                        <td class="time-cell">
                          {{ job.scheduledStartAt ? (job.scheduledStartAt | date:'shortTime') : 'All Day' }}
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            }
          </div>

          <!-- Fast Navigation Actions -->
          <div class="side-column card">
            <div class="card-head">
              <h2 style="margin:0; font-size: 17px;">Fast Workflows</h2>
            </div>
            <div class="card-body">
              <div class="quick-links">
                <a routerLink="/app/customers" class="quick-link-btn">
                  <span class="ql-icon">👥</span>
                  <div class="ql-info">
                    <strong>Manage Customers</strong>
                    <span>Accounts, service addresses, and contact info</span>
                  </div>
                </a>
                <a routerLink="/app/invoices" class="quick-link-btn">
                  <span class="ql-icon">📄</span>
                  <div class="ql-info">
                    <strong>Invoices & Billing</strong>
                    <span>Review unpaid balances and issue billing</span>
                  </div>
                </a>
                <a routerLink="/app/reports" class="quick-link-btn">
                  <span class="ql-icon">📊</span>
                  <div class="ql-info">
                    <strong>Live Analytics & CSV Export</strong>
                    <span>Period revenue reports & data controls</span>
                  </div>
                </a>
                <a routerLink="/app/subscription" class="quick-link-btn">
                  <span class="ql-icon">⚡</span>
                  <div class="ql-info">
                    <strong>Subscription & Quota</strong>
                    <span>Plan seats, capacity, and feature entitlements</span>
                  </div>
                </a>
              </div>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .header-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 24px;
      gap: 16px;
      flex-wrap: wrap;
    }
    .header-actions,
    .page-actions,
    .actions {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 18px;
      margin-bottom: 24px;
      min-width: 0;
    }
    .kpi-card {
      padding: 22px 20px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      min-height: 135px;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      transition: transform 0.15s ease, box-shadow 0.15s ease;
      min-width: 0;
    }
    .kpi-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 16px rgba(0,0,0,0.06);
    }
    .highlight-card {
      background: linear-gradient(135deg, rgba(37,99,235,0.04) 0%, rgba(37,99,235,0.09) 100%);
      border-color: rgba(37,99,235,0.25);
    }
    .kpi-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .kpi-label {
      font-size: 13px;
      font-weight: 600;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .kpi-icon {
      font-size: 18px;
    }
    .kpi-value {
      font-size: 32px;
      font-weight: 800;
      color: var(--text);
      margin: 8px 0;
      font-family: var(--font-numeric, inherit);
      letter-spacing: -0.5px;
    }
    .kpi-meta {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 12px;
    }
    .meta-label {
      color: var(--text-muted);
      font-size: 12px;
    }
    .error-color {
      color: var(--red);
      font-weight: 600;
    }
    .badge {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 9999px;
      font-size: 11px;
      font-weight: 600;
    }
    .badge-success {
      background: #dcfce7;
      color: #166534;
    }
    .badge-neutral {
      background: #f1f5f9;
      color: #475569;
    }
    .success-box {
      background: #f0fdf4;
      border-left: 4px solid #16a34a;
      padding: 16px 20px;
      border-radius: var(--radius-sm);
      margin-bottom: 24px;
      min-width: 0;
    }
    .attention-box {
      margin-bottom: 24px;
      min-width: 0;
    }
    .attention-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
      gap: 16px;
    }
    .attention-content p {
      margin: 4px 0 0;
      font-size: 13px;
    }
    .dashboard-columns {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 280px;
      gap: 20px;
      align-items: start;
      min-width: 0;
    }
    .main-column,
    .side-column {
      min-width: 0;
    }
    .table-scroll .data-table th,
    .table-scroll .data-table td {
      padding: 12px 14px;
    }
    .view-all-link {
      font-size: 13px;
      font-weight: 700;
      color: var(--teal);
      text-decoration: none;
    }
    .view-all-link:hover {
      text-decoration: underline;
    }
    .table-scroll {
      width: 100%;
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
    }
    .code-link {
      font-family: monospace;
      font-weight: 700;
      color: var(--teal);
      text-decoration: none;
      white-space: nowrap;
    }
    .code-link:hover {
      text-decoration: underline;
    }
    .job-cell-title {
      font-weight: 600;
      color: var(--ink);
      font-size: 13px;
    }
    .job-cell-cust {
      font-size: 12px;
      color: var(--muted);
      margin-top: 2px;
    }
    .priority-pill {
      display: inline-block;
      padding: 2px 7px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      white-space: nowrap;
    }
    .priority-emergency { background: #fee2e2; color: #991b1b; }
    .priority-high { background: #ffedd5; color: #9a3412; }
    .priority-normal { background: #e0f2fe; color: #075985; }
    .priority-low { background: #f1f5f9; color: #475569; }

    .status-pill {
      display: inline-block;
      padding: 3px 9px;
      border-radius: 9999px;
      font-size: 11px;
      font-weight: 700;
      white-space: nowrap;
    }
    .status-draft { background: #f1f5f9; color: #475569; }
    .status-scheduled { background: #fef9c3; color: #854d0e; }
    .status-inprogress { background: #dbeafe; color: #1e40af; }
    .status-completed { background: #dcfce7; color: #166534; }
    .status-cancelled { background: #fee2e2; color: #991b1b; }

    .staff-tag {
      font-size: 12px;
      color: var(--muted);
      background: #f8fafc;
      padding: 3px 7px;
      border-radius: 5px;
      border: 1px solid var(--line-soft);
      white-space: nowrap;
    }
    .time-cell {
      font-size: 12px;
      color: var(--muted);
      white-space: nowrap;
    }
    .empty-state {
      padding: 36px 20px;
      text-align: center;
      color: var(--muted);
    }
    .quick-links {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .quick-link-btn {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 13px 15px;
      border: 1px solid var(--line);
      border-radius: 9px;
      text-decoration: none;
      color: inherit;
      background: var(--surface);
      transition: border-color .15s, background .15s, transform .15s;
    }
    .quick-link-btn:hover {
      text-decoration: none !important;
      border-color: var(--teal);
      background: #f8fafb;
      transform: translateX(3px);
    }
    .ql-icon {
      font-size: 20px;
      flex-shrink: 0;
    }
    .ql-info {
      display: flex;
      flex-direction: column;
    }
    .ql-info strong {
      font-size: 13px;
      font-weight: 700;
      color: var(--ink);
    }
    .ql-info span {
      font-size: 12px;
      color: var(--muted);
      margin-top: 2px;
    }
    .loading-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 48px;
      gap: 16px;
      color: var(--muted);
    }
    .spinner {
      width: 32px;
      height: 32px;
      border: 3px solid var(--line);
      border-top-color: var(--teal);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    @media (max-width: 1180px) {
      .dashboard-columns {
        grid-template-columns: 1fr;
      }
    }
    @media (max-width: 1024px) {
      .kpi-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }
    @media (max-width: 640px) {
      .kpi-grid {
        grid-template-columns: minmax(0, 1fr);
      }
      .kpi-card {
        padding: 16px;
      }
      .header-row {
        flex-direction: column;
        align-items: stretch;
      }
      .header-actions {
        width: 100%;
      }
      .header-actions .btn {
        flex: 1;
        text-align: center;
        justify-content: center;
      }
    }
  `]
})
export class DashboardLivePage implements OnInit {
  private readonly api = inject(WorkApiService);

  readonly loading = signal(false);
  readonly summary = signal<DashboardSummary | null>(null);
  readonly errorMessage = signal('');

  ngOnInit(): void {
    this.loadDashboard();
  }

  loadDashboard(): void {
    this.loading.set(true);
    this.errorMessage.set('');
    this.api.getDashboardSummary().subscribe({
      next: data => {
        this.summary.set(data);
        this.loading.set(false);
      },
      error: err => {
        this.errorMessage.set(err?.error?.detail || err?.message || 'Failed to load live dashboard summary');
        this.loading.set(false);
      }
    });
  }

  formatStatus(status: string): string {
    if (status === 'InProgress') return 'In progress';
    return status;
  }
}
