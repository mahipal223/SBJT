import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuditEvent, BusinessReport, ExportRequest, WorkApiService } from '../core/work-api.service';

@Component({
  selector: 'app-reports-live',
  standalone: true,
  imports: [CommonModule, FormsModule, CurrencyPipe, DatePipe],
  template: `
    <main class="page" style="padding-bottom: 5rem;">
      <!-- Header & Filter Bar -->
      <header class="page-head">
        <div>
          <p class="eyebrow">Financial Analytics & Data Controls</p>
          <h1>Reports & Workspace Intelligence</h1>
          <p>Live SQL performance analytics, tenant CSV exports, and immutable audit logs.</p>
        </div>
        <div class="page-actions" style="align-items: center;">
          <div class="period-buttons">
            <button class="btn small" [class.primary]="period() === '30'" (click)="setPeriod('30')">Last 30 Days</button>
            <button class="btn small" [class.primary]="period() === '90'" (click)="setPeriod('90')">Last 90 Days</button>
            <button class="btn small" [class.primary]="period() === 'month'" (click)="setPeriod('month')">This Month</button>
            <button class="btn small" [class.primary]="period() === 'ytd'" (click)="setPeriod('ytd')">Year to Date</button>
          </div>
          <button class="btn small" (click)="loadReport()" [disabled]="loading()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:4px">
              <polyline points="23 4 23 10 17 10"></polyline>
              <polyline points="1 20 1 14 7 14"></polyline>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
            </svg>
            Refresh
          </button>
        </div>
      </header>

      <!-- Tab navigation -->
      <nav class="tabs" style="margin-bottom: 1.5rem;">
        @for (t of tabs; track t.id) {
          <a [class.active]="activeTab() === t.id" (click)="activeTab.set(t.id)" style="cursor: pointer;">
            <span>{{ t.icon }}</span> {{ t.label }}
          </a>
        }
      </nav>

      @if (errorMessage()) {
        <div class="callout error-text" style="margin-bottom: 22px;">
          <p><strong>Error:</strong> {{ errorMessage() }}</p>
          <button class="btn btn-secondary btn-sm" style="margin-top: 8px;" (click)="loadReport()">Retry</button>
        </div>
      }

      <!-- TAB 1: ANALYTICS & KPIS -->
      @if (activeTab() === 'analytics') {
        @if (loading() && !report()) {
          <div class="loading-state card">
            <div class="spinner"></div>
            <p>Calculating database metrics and financial aggregations...</p>
          </div>
        }

        @if (report(); as r) {
          <!-- 4 Core Financial KPI Cards -->
          <div class="kpi-grid" style="margin-bottom:1.5rem;">
            <div class="kpi-card card">
              <span class="kpi-label">Total Revenue</span>
              <div class="kpi-value">{{ r.totalRevenue | currency }}</div>
              <div class="kpi-meta">
                <span class="growth-pill" [ngClass]="r.revenueGrowthPercent >= 0 ? 'growth-pos' : 'growth-neg'">
                  {{ r.revenueGrowthPercent >= 0 ? '+' : '' }}{{ r.revenueGrowthPercent }}%
                </span>
                <span class="meta-label">vs prior period</span>
              </div>
            </div>

            <div class="kpi-card card">
              <span class="kpi-label">Jobs Completed</span>
              <div class="kpi-value">{{ r.jobsCompletedCount }}</div>
              <div class="kpi-meta">
                <span class="meta-label">Closed tickets in period</span>
              </div>
            </div>

            <div class="kpi-card card">
              <span class="kpi-label">Average Job Value</span>
              <div class="kpi-value">{{ r.averageJobValue | currency }}</div>
              <div class="kpi-meta">
                <span class="meta-label">Mean invoice amount</span>
              </div>
            </div>

            <div class="kpi-card card">
              <span class="kpi-label">New Customers</span>
              <div class="kpi-value">{{ r.newCustomersCount }}</div>
              <div class="kpi-meta">
                <span class="meta-label">Acquired during period</span>
              </div>
            </div>
          </div>

          <!-- Monthly Revenue Trend Chart -->
          <div class="card chart-card" style="margin-bottom:1.5rem;">
            <div class="card-header-flex">
              <div>
                <h2 class="section-title" style="margin:0;">Monthly Revenue Trend</h2>
                <span class="meta-label">6-Month historical billing and job completion volume</span>
              </div>
              <span class="meta-period">{{ r.periodStart }} to {{ r.periodEnd }}</span>
            </div>

            @if (r.monthlyTrends.length === 0) {
              <div class="empty-state">
                <p>No historical revenue data recorded yet for this window.</p>
              </div>
            } @else {
              <div class="trend-chart-container">
                <div class="bars-flex">
                  @for (item of r.monthlyTrends; track item.monthLabel) {
                    <div class="bar-col">
                      <div class="bar-val-label">\${{ item.revenue | number:'1.0-0' }}</div>
                      <div class="bar-track">
                        <div class="bar-fill" [style.height.%]="getBarHeight(item.revenue)"></div>
                      </div>
                      <div class="bar-month">{{ item.monthLabel }}</div>
                      <div class="bar-sub">{{ item.jobsCount }} jobs</div>
                    </div>
                  }
                </div>
              </div>
            }
          </div>

          <!-- Category Breakdown & Staff Performance -->
          <div class="two-col-grid" style="margin-bottom:1.5rem;">
            <!-- Category Breakdown -->
            <div class="card">
              <div class="card-head"><h2 style="margin:0;font-size:16px;">Revenue by Category</h2></div>
              <div class="card-body">
                <p style="margin:0 0 1rem;font-size:.8125rem;color:var(--muted);">Breakdown by invoice line items</p>

                @if (r.categoryBreakdown.length === 0) {
                  <div class="empty-state"><p>No itemized invoice line data available.</p></div>
                }

                @for (cat of r.categoryBreakdown; track cat.categoryName) {
                  <div class="category-row">
                    <div class="cat-info">
                      <div class="cat-name-row">
                        <strong>{{ cat.categoryName }}</strong>
                        <span>{{ cat.totalRevenue | currency }} ({{ cat.percentage }}%)</span>
                      </div>
                      <div class="cat-bar-track">
                        <div class="cat-bar-fill" [style.width.%]="cat.percentage"></div>
                      </div>
                      <div class="cat-sub">{{ cat.itemCount }} items billed</div>
                    </div>
                  </div>
                }
              </div>
            </div>
                     <!-- Technician Performance -->
            <div class="card">
              <div class="card-head"><h2 style="margin:0;font-size:16px;">Team &amp; Staff Performance</h2></div>
              @if (r.technicianPerformance.length === 0) {
                <div class="empty-state"><p>No technician assignments completed in this period.</p></div>
              } @else {
                <div class="table-scroll">
                  <table class="data-table" style="min-width:0;">
                    <thead>
                      <tr>
                        <th>Staff Member</th>
                        <th>Jobs Done</th>
                        <th>Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (tech of r.technicianPerformance; track tech.memberName) {
                        <tr>
                          <td><strong>{{ tech.memberName }}</strong></td>
                          <td>{{ tech.jobsCompleted }}</td>
                          <td>{{ tech.totalRevenue | currency }}</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              }
            </div>
          </div>

          <!-- Invoice Aging Section -->
          <div class="card" style="margin-bottom:.5rem;">
            <div class="card-head"><h2 style="margin:0;font-size:16px;">Accounts Receivable &amp; Invoice Aging</h2></div>
            <div class="card-body">
              <p style="margin:0 0 1rem;font-size:.8125rem;color:var(--muted);">Outstanding balances bucketed by days past payment due date</p>
              <div class="aging-grid">
              <div class="aging-card aging-current">
                <span class="aging-label">Current (Not Due)</span>
                <div class="aging-value">{{ r.invoiceAging.current | currency }}</div>
              </div>
              <div class="aging-card aging-warn">
                <span class="aging-label">1 – 30 Days Overdue</span>
                <div class="aging-value">{{ r.invoiceAging.days1To30 | currency }}</div>
              </div>
              <div class="aging-card aging-amber">
                <span class="aging-label">31 – 60 Days Overdue</span>
                <div class="aging-value">{{ r.invoiceAging.days31To60 | currency }}</div>
              </div>
              <div class="aging-card aging-alert">
                <span class="aging-label">60+ Days Overdue</span>
                <div class="aging-value">{{ r.invoiceAging.days60Plus | currency }}</div>
              </div>
              </div>
            </div>
          </div>
        }
      }

      <!-- TAB 2: CSV DATA EXPORTS -->
      @if (activeTab() === 'exports') {
        <div class="card" style="margin-bottom: 1.5rem;">
          <div class="card-head"><h2 style="margin:0;font-size:16px;">Generate Workspace Data Package (CSV)</h2></div>
          <div class="card-body">
          <p style="margin:0 0 1.25rem;font-size:.8125rem;color:var(--muted);">
            Export raw tenant data formatted to RFC 4180 specifications. All exports strictly enforce database tenant boundaries.
          </p>

          <div class="export-actions-grid">
            <div class="export-box">
              <div class="export-box-icon">👥</div>
              <div class="export-box-content">
                <strong>Customers Export</strong>
                <span>Names, emails, phone numbers, and service locations</span>
              </div>
              <button class="btn btn-secondary btn-sm" (click)="triggerExport('Customers')" [disabled]="exporting()">
                {{ exporting() ? 'Exporting...' : 'Export Customers' }}
              </button>
            </div>

            <div class="export-box">
              <div class="export-box-icon">📋</div>
              <div class="export-box-content">
                <strong>Jobs Export</strong>
                <span>Job numbers, schedules, priority ratings, and statuses</span>
              </div>
              <button class="btn btn-secondary btn-sm" (click)="triggerExport('Jobs')" [disabled]="exporting()">
                {{ exporting() ? 'Exporting...' : 'Export Jobs' }}
              </button>
            </div>

            <div class="export-box">
              <div class="export-box-icon">📄</div>
              <div class="export-box-content">
                <strong>Invoices Export</strong>
                <span>Invoice numbers, dates, subtotal, tax, and totals</span>
              </div>
              <button class="btn btn-secondary btn-sm" (click)="triggerExport('Invoices')" [disabled]="exporting()">
                {{ exporting() ? 'Exporting...' : 'Export Invoices' }}
              </button>
            </div>

            <div class="export-box export-box-highlight">
              <div class="export-box-icon">📦</div>
              <div class="export-box-content">
                <strong>Full Business Package</strong>
                <span>Complete archive of customers, jobs, and invoices</span>
              </div>
              <button class="btn btn-primary btn-sm" (click)="triggerExport('FullBusiness')" [disabled]="exporting()">
                {{ exporting() ? 'Exporting...' : 'Export All' }}
              </button>
            </div>
          </div>
          </div>
        </div>

        <div class="card" style="margin-bottom:.5rem;">
          <div class="card-head" style="flex-wrap:wrap;gap:.75rem;">
            <div>
              <h2 class="section-title" style="margin:0;">Recent Export Requests</h2>
              <span style="font-size:.8125rem;color:var(--muted);">Export packages available for download</span>
            </div>
            <button class="btn small" (click)="loadExports()">Refresh List</button>
          </div>

          @if (exportsList().length === 0) {
            <div class="empty-state"><p>No export packages requested yet. Generate one above to download your tenant data.</p></div>
          } @else {
            <div class="table-scroll">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Package Type</th>
                    <th>Status</th>
                    <th>Created At</th>
                    <th>Expires At</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  @for (item of exportsList(); track item.id) {
                    <tr>
                      <td>
                        <strong>{{ item.exportType }} Package</strong>
                      </td>
                      <td>
                        <span class="badge" [ngClass]="item.status === 'Ready' ? 'badge-success' : 'badge-neutral'">
                          {{ item.status }}
                        </span>
                      </td>
                      <td>{{ item.createdAt | date:'short' }}</td>
                      <td>{{ item.expiresAt ? (item.expiresAt | date:'shortDate') : '7 Days' }}</td>
                      <td>
                        <button class="btn btn-primary btn-sm" (click)="downloadCsv(item.id, item.exportType)" [disabled]="item.status !== 'Ready'">
                          Download CSV
                        </button>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
              </div>
          }
        </div>
      }

      <!-- TAB 3: AUDIT TRAIL LOG -->
      @if (activeTab() === 'audit') {
        <div class="card" style="margin-bottom:.5rem;">
          <div class="card-head" style="flex-wrap:wrap;gap:.75rem;">
            <div>
              <h2 class="section-title" style="margin:0;">Workspace Audit Trail</h2>
              <span style="font-size:.8125rem;color:var(--muted);">Append-only compliance ledger recording critical operations in app.AuditEvents</span>
            </div>
            <button class="btn small" (click)="loadAuditEvents()">Refresh Trail</button>
          </div>

          @if (auditEvents().length === 0) {
            <div class="empty-state"><p>No audit events recorded yet.</p></div>
          } @else {
            <div class="table-scroll">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Timestamp (UTC)</th>
                    <th>Action</th>
                    <th>Entity Type</th>
                    <th>Entity ID</th>
                    <th>Changes / Payload</th>
                  </tr>
                </thead>
                <tbody>
                  @for (ev of auditEvents(); track ev.id) {
                    <tr>
                      <td class="time-cell">{{ ev.createdAt | date:'medium' }}</td>
                      <td>
                        <span class="audit-action-tag">{{ ev.action }}</span>
                      </td>
                      <td>{{ ev.entityType }}</td>
                      <td>
                        <span class="code-link" style="font-size: 11px;">{{ ev.entityId ? ev.entityId.substring(0, 8) + '...' : '—' }}</span>
                      </td>
                      <td>
                        <code class="audit-changes">{{ ev.changes || '{}' }}</code>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </div>
      }
    </main>
  `,
  styles: [`
    .card-head h2 { font-size: 16px; }
    .period-buttons {
      display: flex;
      gap: 4px;
      background: var(--surface);
      padding: 3px;
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
    }
    .period-buttons .btn {
      font-weight: 600;
    }
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 1rem;
    }
    .kpi-card {
      padding: 1.375rem 1.25rem;
      background: var(--surface);
      border: 1px solid var(--line);
      border-radius: 13px;
      border-top: 3px solid var(--teal);
    }
    .kpi-label {
      font-size: 12px;
      font-weight: 600;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .kpi-value {
      font-size: 30px;
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
    .growth-pill {
      display: inline-block;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 700;
    }
    .growth-pos { background: #dcfce7; color: #166534; }
    .growth-neg { background: #fee2e2; color: #991b1b; }
    .meta-period {
      font-size: 12px;
      color: var(--text-muted);
      background: #f1f5f9;
      padding: 4px 10px;
      border-radius: 4px;
    }
    .card-header-flex,
    .card-header-flex-inner {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1.125rem 1.375rem;
      border-bottom: 1px solid var(--line-soft);
      flex-wrap: wrap;
      gap: 12px;
    }
    .chart-card > .card-header-flex,
    .chart-card > .card-header-flex-inner {
      border-bottom: none;
      padding-bottom: 0;
    }
    .trend-chart-container {
      padding: 24px 12px 12px;
    }
    .bars-flex {
      display: flex;
      align-items: flex-end;
      gap: 24px;
      min-height: 220px;
      border-bottom: 2px solid var(--border);
      padding-bottom: 8px;
    }
    .bar-col {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      min-width: 60px;
    }
    .bar-val-label {
      font-size: 11px;
      font-weight: 700;
      color: var(--text);
      margin-bottom: 8px;
    }
    .bar-track {
      width: 44px;
      height: 160px;
      background: #f1f5f9;
      border-radius: 6px 6px 0 0;
      display: flex;
      align-items: flex-end;
      overflow: hidden;
    }
    .bar-fill {
      width: 100%;
      background: linear-gradient(180deg, var(--primary) 0%, #1d4ed8 100%);
      border-radius: 6px 6px 0 0;
      transition: height 0.3s ease;
      min-height: 4px;
    }
    .bar-month {
      font-size: 12px;
      font-weight: 600;
      color: var(--text);
      margin-top: 8px;
    }
    .bar-sub {
      font-size: 11px;
      color: var(--text-muted);
    }
    .two-col-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1.5rem;
    }
    .card > h2.section-title {
      padding: 1.125rem 1.375rem;
      margin: 0;
      border-bottom: 1px solid var(--line-soft);
      font-size: 16px;
    }
    .card > .cat-wrapper,
    .card > .tech-wrapper {
      padding: 1.125rem 1.375rem;
    }
    .category-row {
      margin-bottom: 16px;
    }
    .cat-name-row {
      display: flex;
      justify-content: space-between;
      font-size: 13px;
      margin-bottom: 4px;
    }
    .cat-bar-track {
      height: 8px;
      background: #f1f5f9;
      border-radius: 4px;
      overflow: hidden;
      margin: 4px 0;
    }
    .cat-bar-fill {
      height: 100%;
      background: var(--primary);
      border-radius: 4px;
      transition: width 0.3s ease;
    }
    .cat-sub {
      font-size: 11px;
      color: var(--text-muted);
    }
    .aging-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 1rem;
      margin-top: 0;
    }
    .aging-card {
      padding: 1.125rem;
      border-radius: 10px;
      border: 1px solid var(--line);
    }
    .aging-label {
      font-size: 12px;
      font-weight: 600;
      display: block;
      margin-bottom: 6px;
    }
    .aging-value {
      font-size: 22px;
      font-weight: 800;
      font-family: var(--font-numeric, inherit);
    }
    .aging-current { background: #f8fafc; border-color: #cbd5e1; }
    .aging-current .aging-label { color: #475569; }
    .aging-warn { background: #fefce8; border-color: #fef08a; }
    .aging-warn .aging-label { color: #854d0e; }
    .aging-amber { background: #fff7ed; border-color: #fed7aa; }
    .aging-amber .aging-label { color: #9a3412; }
    .aging-alert { background: #fef2f2; border-color: #fecaca; }
    .aging-alert .aging-label { color: #991b1b; }
    .aging-alert .aging-value { color: #991b1b; }

    .export-actions-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
    }
    .export-box {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 18px 20px;
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      background: var(--surface);
    }
    .export-box-highlight {
      background: linear-gradient(135deg, rgba(37,99,235,0.03) 0%, rgba(37,99,235,0.08) 100%);
      border-color: rgba(37,99,235,0.3);
    }
    .export-box-icon {
      font-size: 28px;
    }
    .export-box-content {
      flex: 1;
      display: flex;
      flex-direction: column;
    }
    .export-box-content strong {
      font-size: 14px;
      color: var(--text);
    }
    .export-box-content span {
      font-size: 12px;
      color: var(--text-muted);
      margin-top: 2px;
    }

    .audit-action-tag {
      font-family: monospace;
      font-size: 12px;
      font-weight: 700;
      background: #f1f5f9;
      color: #334155;
      padding: 3px 6px;
      border-radius: 4px;
    }
    .audit-changes {
      font-family: monospace;
      font-size: 11px;
      color: #475569;
      background: #f8fafc;
      padding: 2px 6px;
      border-radius: 3px;
      max-width: 400px;
      display: inline-block;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .table-responsive {
      overflow-x: auto;
    }
    .data-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
      min-width: 0;
    }
    .data-table th {
      text-align: left;
      padding: 10px 18px;
      color: var(--muted);
      font-weight: 600;
      border-bottom: 1px solid var(--line-soft);
      background: #f8fafb;
      text-transform: uppercase;
      font-size: 11px;
      letter-spacing: 0.5px;
    }
    .data-table td {
      padding: 13px 18px;
      border-bottom: 1px solid var(--line-soft);
      vertical-align: middle;
    }
    .badge {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 9999px;
      font-size: 11px;
      font-weight: 600;
    }
    .badge-success { background: #dcfce7; color: #166534; }
    .badge-neutral { background: #f1f5f9; color: #475569; }
    .empty-state {
      padding: 36px 20px;
      text-align: center;
      color: var(--text-muted);
    }
    .loading-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 48px;
      gap: 16px;
      color: var(--text-muted);
    }
    .spinner {
      width: 32px;
      height: 32px;
      border: 3px solid var(--border);
      border-top-color: var(--primary);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    @media (max-width: 1080px) {
      .kpi-grid { grid-template-columns: repeat(2, 1fr); }
      .aging-grid { grid-template-columns: repeat(2, 1fr); }
      .two-col-grid { grid-template-columns: 1fr; }
      .export-actions-grid { grid-template-columns: 1fr; }
    }
    @media (max-width: 600px) {
      .kpi-grid { grid-template-columns: 1fr; }
      .aging-grid { grid-template-columns: 1fr; }
      .period-buttons { flex-wrap: wrap; }
    }
  `]
})
export class ReportsLivePage implements OnInit {
  private readonly api = inject(WorkApiService);

  readonly tabs: { id: 'analytics' | 'exports' | 'audit'; label: string; icon: string }[] = [
    { id: 'analytics', label: 'Analytics & KPIs', icon: '📈' },
    { id: 'exports', label: 'CSV Data Exports', icon: '📦' },
    { id: 'audit', label: 'Audit Trail Log', icon: '🛡' }
  ];

  readonly activeTab = signal<'analytics' | 'exports' | 'audit'>('analytics');
  readonly period = signal('30');
  readonly loading = signal(false);
  readonly exporting = signal(false);
  readonly report = signal<BusinessReport | null>(null);
  readonly exportsList = signal<ExportRequest[]>([]);
  readonly auditEvents = signal<AuditEvent[]>([]);
  readonly errorMessage = signal('');

  ngOnInit(): void {
    this.loadReport();
    this.loadExports();
    this.loadAuditEvents();
  }

  setPeriod(p: string): void {
    this.period.set(p);
    this.loadReport();
  }

  loadReport(): void {
    this.loading.set(true);
    this.errorMessage.set('');

    const today = new Date();
    let fromDate = '';
    const toDate = today.toISOString().split('T')[0];

    const currentPeriod = this.period();
    if (currentPeriod === '30') {
      const d = new Date(today);
      d.setDate(d.getDate() - 30);
      fromDate = d.toISOString().split('T')[0];
    } else if (currentPeriod === '90') {
      const d = new Date(today);
      d.setDate(d.getDate() - 90);
      fromDate = d.toISOString().split('T')[0];
    } else if (currentPeriod === 'month') {
      const d = new Date(today.getFullYear(), today.getMonth(), 1);
      fromDate = d.toISOString().split('T')[0];
    } else if (currentPeriod === 'ytd') {
      const d = new Date(today.getFullYear(), 0, 1);
      fromDate = d.toISOString().split('T')[0];
    }

    this.api.getBusinessReport(fromDate, toDate).subscribe({
      next: data => {
        this.report.set(data);
        this.loading.set(false);
      },
      error: err => {
        this.errorMessage.set(err?.error?.detail || err?.message || 'Failed to load business report');
        this.loading.set(false);
      }
    });
  }

  getBarHeight(value: number): number {
    const r = this.report();
    if (!r?.monthlyTrends || r.monthlyTrends.length === 0) return 10;
    const max = Math.max(...r.monthlyTrends.map(t => t.revenue), 1);
    return Math.max(8, Math.round((value / max) * 100));
  }

  triggerExport(exportType: string): void {
    this.exporting.set(true);
    this.errorMessage.set('');
    this.api.createExport(exportType).subscribe({
      next: exp => {
        this.exporting.set(false);
        this.loadExports();
        this.downloadCsv(exp.id, exp.exportType);
      },
      error: err => {
        this.exporting.set(false);
        this.errorMessage.set(err?.error?.detail || err?.message || 'Failed to create export package');
      }
    });
  }

  loadExports(): void {
    this.api.listExports().subscribe({
      next: list => { this.exportsList.set(list); },
      error: () => { }
    });
  }

  downloadCsv(exportId: string, exportType: string): void {
    this.api.downloadExport(exportId, `${exportType.toLowerCase()}-export.csv`);
  }

  loadAuditEvents(): void {
    this.api.listAuditEvents(50).subscribe({
      next: events => { this.auditEvents.set(events); },
      error: () => { }
    });
  }
}
