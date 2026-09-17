import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PlatformAdminApiService, PlatformMetricsResponse } from '../../core/platform-admin-api.service';
import { PlatformContextService } from '../../core/platform-context.service';

@Component({
  selector: 'app-platform-overview',
  standalone: true,
  imports: [CommonModule],
  template: `
<div class="page-container">
  <div class="page-header">
    <div>
      <h2>Platform Overview & Metrics</h2>
      <p class="subtitle">System health, recurring revenue, tenant volume, and service telemetry.</p>
    </div>
    <button type="button" class="btn-refresh" (click)="loadMetrics()" [disabled]="loading()">
      <svg class="refresh-icon" [class.spin]="loading()" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="23 4 23 10 17 10"></polyline>
        <polyline points="1 20 1 14 7 14"></polyline>
        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
      </svg>
      {{ loading() ? 'Refreshing…' : 'Refresh Metrics' }}
    </button>
  </div>

  @if (loading()) {
    <div class="state-card loading">
      <div class="spinner"></div>
      <p>Loading real-time metrics…</p>
    </div>
  } @else if (error()) {
    <div class="state-card error">
      <p class="error-msg">⚠️ {{ error() }}</p>
      <button type="button" class="btn-retry" (click)="loadMetrics()">Try Again</button>
    </div>
  } @else if (metrics()) {
    <section class="kpi-grid">
      <div class="kpi-card blue">
        <span class="label">Total Businesses</span>
        <span class="value">{{ metrics()!.totalBusinesses | number }}</span>
        <span class="meta">{{ metrics()!.activeBusinesses | number }} active · {{ metrics()!.suspendedBusinesses }} suspended</span>
      </div>
      <div class="kpi-card green">
        <span class="label">Monthly Recurring Revenue</span>
        <span class="value">\${{ (metrics()!.monthlyRecurringRevenue / 1000).toFixed(1) }}K</span>
        <span class="meta">↑ Verified subscription billing</span>
      </div>
      <div class="kpi-card amber">
        <span class="label">Trial Conversion Rate</span>
        <span class="value">{{ metrics()!.trialConversionRate.toFixed(1) }}%</span>
        <span class="meta">{{ metrics()!.trialBusinesses }} businesses currently on trial</span>
      </div>
      <div class="kpi-card purple">
        <span class="label">Platform Health</span>
        <span class="value">{{ metrics()!.serviceHealthPercentage }}%</span>
        <span class="meta health-ok">● {{ metrics()!.systemStatus }}</span>
      </div>
    </section>

    <div class="charts-grid">
      <div class="card">
        <h3>Plan Distribution</h3>
        @if (metrics()!.planDistribution.length === 0) {
          <p class="empty-text">No active subscriptions recorded.</p>
        } @else {
          <div class="dist-list">
            @for (p of metrics()!.planDistribution; track p.planName) {
              <div class="dist-item">
                <div class="dist-row">
                  <span class="dist-name">{{ p.planName }}</span>
                  <span class="dist-meta">{{ p.businessCount | number }} ({{ p.percentage }}%)</span>
                </div>
                <div class="bar-bg"><div class="bar-fill blue" [style.width.%]="p.percentage"></div></div>
              </div>
            }
          </div>
        }
      </div>

      <div class="card">
        <h3>Industry Distribution</h3>
        @if (metrics()!.industryDistribution.length === 0) {
          <p class="empty-text">No tenant industry data available.</p>
        } @else {
          <div class="dist-list">
            @for (ind of metrics()!.industryDistribution; track ind.industry) {
              <div class="dist-item">
                <div class="dist-row">
                  <span class="dist-name">{{ ind.industry }}</span>
                  <span class="dist-meta">{{ ind.businessCount | number }} ({{ ind.percentage }}%)</span>
                </div>
                <div class="bar-bg"><div class="bar-fill teal" [style.width.%]="ind.percentage"></div></div>
              </div>
            }
          </div>
        }
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
.kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1.25rem; width: 100%; }
.kpi-card { padding: 20px; border-radius: 12px; background: #fff; border: 1px solid var(--line); box-shadow: var(--shadow); display: flex; flex-direction: column; gap: 4px; }
.kpi-card .label { font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--muted); letter-spacing: .05em; }
.kpi-card .value { font-size: 28px; font-weight: 800; color: var(--ink); font-family: 'Manrope', sans-serif; }
.kpi-card .meta { font-size: 12px; color: var(--muted); }
.kpi-card .health-ok { color: var(--teal); font-weight: 700; }
.kpi-card.blue { border-left: 4px solid var(--blue); }
.kpi-card.green { border-left: 4px solid var(--teal); }
.kpi-card.amber { border-left: 4px solid var(--amber); }
.kpi-card.purple { border-left: 4px solid #6366f1; }
.charts-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1.25rem; }
.card { background: #fff; border: 1px solid var(--line); border-radius: 12px; padding: 22px; box-shadow: var(--shadow); }
.card h3 { font-size: 16px; font-weight: 800; color: var(--ink); margin: 0 0 1rem; font-family: 'Manrope', sans-serif; }
.dist-list { display: flex; flex-direction: column; gap: 0.85rem; }
.dist-row { display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 0.35rem; }
.dist-name { font-weight: 700; color: var(--ink); }
.dist-meta { color: var(--muted); font-size: 12px; font-weight: 600; }
.bar-bg { height: 8px; background: var(--bg); border: 1px solid var(--line-soft); border-radius: 4px; overflow: hidden; }
.bar-fill { height: 100%; border-radius: 4px; }
.bar-fill.blue { background: var(--blue); }
.bar-fill.teal { background: var(--teal); }
.empty-text { font-size: 0.85rem; color: var(--muted); text-align: center; padding: 2rem 0; }
.state-card { background: #fff; border: 1px solid var(--line); border-radius: 12px; padding: 3rem 1.5rem; text-align: center; color: var(--muted); box-shadow: var(--shadow); }
.spinner { width: 28px; height: 28px; border: 3px solid var(--line); border-top-color: var(--teal); border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto 0.75rem; }
@keyframes spin { to { transform: rotate(360deg); } }
.btn-retry { margin-top: 1rem; padding: 8px 16px; border-radius: 6px; background: var(--teal); color: #fff; border: 0; font-weight: 700; cursor: pointer; }
.btn-retry:hover { background: var(--teal-dark); }
  `
})
export class PlatformOverviewComponent implements OnInit {
  private readonly api = inject(PlatformAdminApiService);
  readonly platformContext = inject(PlatformContextService);

  readonly metrics = signal<PlatformMetricsResponse | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  ngOnInit(): void {
    this.loadMetrics();
  }

  loadMetrics(): void {
    this.loading.set(true);
    this.error.set(null);

    this.api.getMetrics().subscribe({
      next: data => {
        this.metrics.set(data);
        this.loading.set(false);
      },
      error: err => {
        this.error.set(err?.error?.detail || err?.message || 'Failed to load platform metrics.');
        this.loading.set(false);
      }
    });
  }
}
