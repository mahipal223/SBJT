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
      ⟳ Refresh Metrics
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
.page-container { display: flex; flex-direction: column; gap: 1.5rem; }
.page-header { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem; }
h2 { font-size: 1.35rem; font-weight: 700; color: #f8fafc; margin: 0; }
.subtitle { font-size: 0.85rem; color: #94a3b8; margin: 0.25rem 0 0; }
.btn-refresh { padding: 0.5rem 1rem; border-radius: 6px; background: #334155; color: #f8fafc; border: 1px solid #475569; font-size: 0.85rem; font-weight: 600; cursor: pointer; transition: background 0.15s; }
.btn-refresh:hover:not(:disabled) { background: #475569; }
.kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; }
.kpi-card { padding: 1.25rem; border-radius: 10px; background: #1e293b; border: 1px solid #334155; display: flex; flex-direction: column; gap: 0.35rem; }
.kpi-card .label { font-size: 0.8rem; font-weight: 600; text-transform: uppercase; color: #94a3b8; }
.kpi-card .value { font-size: 1.8rem; font-weight: 800; color: #f8fafc; }
.kpi-card .meta { font-size: 0.8rem; color: #64748b; }
.kpi-card .health-ok { color: #22c55e; font-weight: 600; }
.kpi-card.blue { border-left: 4px solid #3b82f6; }
.kpi-card.green { border-left: 4px solid #22c55e; }
.kpi-card.amber { border-left: 4px solid #f59e0b; }
.kpi-card.purple { border-left: 4px solid #a855f7; }
.charts-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1.25rem; }
.card { background: #1e293b; border: 1px solid #334155; border-radius: 10px; padding: 1.25rem; }
.card h3 { font-size: 1rem; font-weight: 700; color: #f8fafc; margin: 0 0 1rem; }
.dist-list { display: flex; flex-direction: column; gap: 0.85rem; }
.dist-row { display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 0.35rem; }
.dist-name { font-weight: 600; color: #f1f5f9; }
.dist-meta { color: #94a3b8; }
.bar-bg { height: 8px; background: #0f172a; border-radius: 4px; overflow: hidden; }
.bar-fill { height: 100%; border-radius: 4px; }
.bar-fill.blue { background: #3b82f6; }
.bar-fill.teal { background: #14b8a6; }
.empty-text { font-size: 0.85rem; color: #64748b; text-align: center; padding: 2rem 0; }
.state-card { background: #1e293b; border: 1px solid #334155; border-radius: 10px; padding: 3rem 1.5rem; text-align: center; color: #94a3b8; }
.spinner { width: 28px; height: 28px; border: 3px solid #334155; border-top-color: #6366f1; border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto 0.75rem; }
@keyframes spin { to { transform: rotate(360deg); } }
.btn-retry { margin-top: 1rem; padding: 0.5rem 1.25rem; border-radius: 6px; background: #6366f1; color: #fff; border: 0; font-weight: 600; cursor: pointer; }
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
