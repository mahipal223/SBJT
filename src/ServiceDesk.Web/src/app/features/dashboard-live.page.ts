import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DashboardSummary, WorkApiService } from '../core/work-api.service';

@Component({
  selector: 'app-dashboard-live',
  standalone: true,
  imports: [RouterLink, CurrencyPipe, DatePipe],
  template: `
<main class="page overview">
  <header class="overview-header">
    <div><p class="eyebrow">Your business at a glance</p><h1>Dashboard</h1><p class="intro">Stay on top of your work and payments.</p></div>
    <div class="overview-actions">
      <a class="btn primary" routerLink="/app/jobs/new">＋ Create job</a>
    </div>
  </header>
  @if(errorMessage()) {
    <section class="overview-error" role="alert"><strong>Dashboard could not be refreshed.</strong><p>{{errorMessage()}}</p><button class="btn" (click)="loadDashboard()" [disabled]="loading()">Try again</button></section>
  }
  @if(loading() && !summary()) { <section class="overview-loading" role="status">Loading your business overview…</section> }
  @if(summary(); as s) {
    @if(loading() || errorMessage()) { <p class="muted" role="status">Showing the last loaded overview.</p> }
    <section class="overview-metrics" aria-label="Business summary">
      <a class="overview-metric" routerLink="/app/schedule"><span class="metric-label">Jobs today <span aria-hidden="true">↗</span></span><strong>{{s.jobsTodayCount}}</strong><span class="metric-note">{{s.jobsRemainingTodayCount}} remaining · {{s.jobsCompletedTodayCount}} completed</span></a>
      <a class="overview-metric" routerLink="/app/estimates"><span class="metric-label">Open estimates <span aria-hidden="true">↗</span></span><strong>{{s.openEstimatesCount}}</strong><span class="metric-note">{{s.openEstimatesValue | currency}} in pipeline</span></a>
      <a class="overview-metric" routerLink="/app/invoices"><span class="metric-label">Unpaid balance <span aria-hidden="true">↗</span></span><strong>{{s.outstandingInvoicesValue | currency}}</strong><span class="metric-note">{{s.outstandingInvoicesCount}} issued invoices</span></a>
      <a class="overview-metric revenue" routerLink="/app/reports"><span class="metric-label">Revenue this month <span aria-hidden="true">↗</span></span><strong>{{s.revenueThisMonth | currency}}</strong><span class="metric-note">{{s.revenueLastMonth | currency}} last month</span></a>
    </section>
    @if(s.attentionItems.length) {
      <section class="overview-attention" aria-label="Needs attention"><h2>Needs attention</h2>@for(item of s.attentionItems; track item.title) {<div class="attention-row"><div><strong>{{item.title}}</strong><p>{{item.description}}</p></div>@if(item.actionUrl){<a class="btn" [routerLink]="item.actionUrl">Review</a>}</div>}</section>
    } @else { <div class="overview-clear"><span aria-hidden="true">✓</span><p><strong>No urgent alerts</strong><span>No overdue invoices or workspace capacity blockers.</span></p></div> }
    <div class="overview-columns">
      <section class="overview-jobs">
        <header class="overview-section-head"><div><h2>Recent jobs</h2><p>Latest work and current status</p></div><a routerLink="/app/jobs">View all →</a></header>
        <div class="overview-job-list">
          @for(job of s.todaySchedule.slice(0, 5); track job.id) {
            <a class="overview-job" [routerLink]="['/app/jobs',job.id]">
              <div class="job-heading"><span class="job-number">{{job.jobNumber}}</span><span class="job-status" [class.done]="job.status==='Completed'" [class.active]="job.status==='InProgress'">{{formatStatus(job.status)}}</span></div>
              <div class="job-description"><h3>{{job.title}}</h3><p>{{job.customerName}}</p></div>
              <div class="job-details"><span>{{job.scheduledStartAt ? (job.scheduledStartAt | date:'MMM d · h:mm a') : 'Unscheduled'}}</span><span>{{job.assignedMemberName || 'Unassigned'}}</span>@if(job.priority!=='Normal'){<span class="job-priority">{{job.priority}} priority</span>}</div>
              <span class="job-arrow" aria-hidden="true">→</span>
            </a>
          } @empty { <div class="overview-empty"><h3>No jobs yet</h3><p>Create a job to start tracking your work.</p><a class="btn primary" routerLink="/app/jobs/new">Create your first job</a></div> }
        </div>
      </section>
      <aside class="overview-shortcuts" aria-label="Quick actions"><header class="overview-section-head"><h2>Quick actions</h2></header>
        <a routerLink="/app/schedule"><span class="shortcut-icon" aria-hidden="true">▦</span><span><strong>View schedule</strong><small>Plan upcoming visits</small></span><span aria-hidden="true">→</span></a>
        <a routerLink="/app/customers"><span class="shortcut-icon" aria-hidden="true">◎</span><span><strong>Customers</strong><small>Contacts and service history</small></span><span aria-hidden="true">→</span></a>
        <a routerLink="/app/invoices"><span class="shortcut-icon" aria-hidden="true">▤</span><span><strong>Invoices & payments</strong><small>Review balances and payments</small></span><span aria-hidden="true">→</span></a>
        <a routerLink="/app/reports"><span class="shortcut-icon" aria-hidden="true">↗</span><span><strong>Business reports</strong><small>Understand your performance</small></span><span aria-hidden="true">→</span></a>
      </aside>
    </div>
  }
  <footer class="overview-refresh"><button class="icon-btn" type="button" (click)="loadDashboard()" [disabled]="loading()" [attr.aria-label]="loading() ? 'Refreshing dashboard' : 'Refresh dashboard'" [attr.aria-busy]="loading()" title="Refresh dashboard"><svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 7v5h-5M4 17v-5h5"/><path d="M6.1 6.1A8 8 0 0 1 19.7 12M4.3 12a8 8 0 0 0 13.6 5.9"/></svg></button></footer>
</main>`,
  styles: `
:host { display:block; }
.overview { max-width:1560px; margin:0 auto; }
.overview-header { display:flex; align-items:center; justify-content:space-between; gap:24px; margin-bottom:24px; }
.overview-header h1 { margin:6px 0 8px; font-size:32px; letter-spacing:-1px; }
.intro { margin:0; color:var(--muted); }
.overview-actions { display:flex; gap:10px; flex-shrink:0; }
.overview-actions .btn { min-height:44px; }
.overview-refresh { display:flex; justify-content:flex-end; margin-top:20px; }
.overview-refresh .icon-btn { width:44px; height:44px; color:var(--teal); }
.overview-refresh .icon-btn:disabled { opacity:.5; cursor:wait; }
@media(max-width:880px) { .overview-actions a.primary { display:none; } }
.overview-metrics { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:16px; }
.overview-metric { min-width:0; display:flex; flex-direction:column; gap:14px; padding:22px; background:white; border:1px solid var(--line); border-radius:14px; color:var(--ink); text-decoration:none; }
.metric-label { display:flex; justify-content:space-between; gap:8px; font-size:13px; font-weight:600; }
.metric-label > span { color:var(--teal); }
.overview-metric > strong { font-size:clamp(22px,2.3vw,34px); letter-spacing:-1px; line-height:1.15; overflow-wrap:anywhere; }
.metric-note { font-size:12px; color:var(--muted); line-height:1.5; }
.revenue { background:var(--navy); color:white; border-color:var(--navy); }
.revenue .metric-note { color:#bed7dd; }
.overview .revenue .metric-label { color:#e6f4f3 !important; }
.overview .revenue > strong { color:white !important; }
.revenue .metric-label > span { color:#79ddd1; }
.overview-clear { display:flex; gap:12px; align-items:center; margin:20px 0 28px; padding:14px 18px; background:#eaf7f2; border-radius:12px; color:#1c6051; }
.overview-clear > span { font-size:22px; }
.overview-clear p { display:grid; gap:3px; margin:0; font-size:13px; }
.overview-clear p > span { font-size:12px; }
.overview-columns { display:grid; grid-template-columns:minmax(0,1fr) 310px; gap:24px; align-items:start; }
.overview-section-head { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:16px; }
.overview-section-head h2 { margin:0; font-size:18px; }
.overview-section-head p { margin:5px 0 0; color:var(--muted); font-size:12px; }
.overview-section-head > a { display:flex; align-items:center; min-height:44px; color:var(--teal); font-size:13px; font-weight:700; text-decoration:none; flex-shrink:0; }
.overview-job-list { display:grid; gap:10px; }
.overview-job { display:grid; grid-template-columns:135px minmax(0,1fr) auto 18px; gap:16px; align-items:center; padding:18px; border:1px solid var(--line); border-radius:12px; background:white; color:var(--ink); text-decoration:none; min-width:0; }
.job-heading { display:grid; gap:8px; justify-items:start; }
.job-number { color:var(--muted); font-size:12px; font-weight:700; }
.job-status { padding:4px 8px; border-radius:6px; background:#f0f4f6; font-size:11px; font-weight:700; }
.job-status.done { color:#17694f; background:#e0f7eb; }
.job-status.active { color:#235cb3; background:#e8f0ff; }
.job-description { min-width:0; }
.job-description h3 { margin:0 0 5px; font-size:14px; overflow-wrap:anywhere; }
.job-description p { margin:0; font-size:12px; color:var(--muted); overflow-wrap:anywhere; }
.job-details { display:grid; gap:5px; color:var(--muted); font-size:12px; }
.job-priority { color:#9c500e; font-weight:700; }
.job-arrow { color:var(--teal); }
.overview-shortcuts > a { display:flex; align-items:center; gap:12px; padding:16px 0; color:var(--ink); text-decoration:none; border-bottom:1px solid var(--line); }
.shortcut-icon { width:40px; height:40px; display:grid; place-items:center; border-radius:10px; background:#e5f3f1; color:var(--teal); font-size:20px; flex-shrink:0; }
.overview-shortcuts a > span:nth-child(2) { display:grid; gap:5px; flex:1; min-width:0; }
.overview-shortcuts strong { font-size:13px; }
.overview-shortcuts small { color:var(--muted); font-size:12px; }
.overview-empty, .overview-loading { padding:32px; border:1px dashed var(--line); border-radius:12px; background:white; text-align:center; }
.overview-empty p { color:var(--muted); }
.overview-error, .overview-attention { margin-bottom:24px; padding:18px; border:1px solid #efcfad; border-radius:12px; background:#fff8ef; }
.overview-attention h2 { margin:0 0 14px; font-size:18px; }
.attention-row { display:flex; justify-content:space-between; align-items:center; gap:16px; }
.attention-row + .attention-row { margin-top:14px; }
.attention-row p { color:var(--muted); font-size:13px; margin:5px 0; }
.overview a:focus-visible { outline:3px solid var(--teal); outline-offset:3px; }
.overview-job, .overview-metric, .overview-shortcuts > a { transition:background-color .15s ease, box-shadow .15s ease; }
.overview-job:hover, .overview-metric:not(.revenue):hover { background:#fafcfd; box-shadow:0 4px 14px rgb(18 44 57 / 7%); }
.overview-metric.revenue:hover { background:#1b3c4a; }
.overview-shortcuts > a:hover { background:#edf2f5; }
@media(prefers-reduced-motion:reduce) { .overview-job, .overview-metric, .overview-shortcuts > a { transition:none; } }
@media(max-width:1200px) { .overview-columns { grid-template-columns:minmax(0,1fr); } .overview-shortcuts { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:0 24px; } .overview-shortcuts header { grid-column:1/-1; } }
@media(max-width:1100px) { .overview-metrics { grid-template-columns:repeat(2,minmax(0,1fr)); } }
@media(max-width:720px) { .overview-header { align-items:stretch; flex-direction:column; gap:16px; } .overview-header h1 { font-size:28px; } .overview-actions .btn { flex:1; justify-content:center; } .overview-metrics { gap:10px; } .overview-metric { padding:16px; gap:12px; } .metric-label { font-size:12px; } .overview-job { grid-template-columns:minmax(0,1fr); gap:12px; padding:16px; } .job-heading { display:flex; justify-content:space-between; align-items:center; } .job-details { display:flex; flex-wrap:wrap; gap:8px 14px; padding-top:10px; border-top:1px solid var(--line-soft); } .job-arrow { display:none; } .overview-shortcuts { grid-template-columns:minmax(0,1fr); } .overview-clear { align-items:flex-start; } .attention-row { align-items:flex-start; flex-direction:column; } }
@media(max-width:360px) { .overview-metric { padding:12px; } .metric-label { font-size:11px; } .overview-metric > strong { font-size:22px; } }
`
})
export class DashboardLivePage implements OnInit {
  private readonly api = inject(WorkApiService);
  readonly loading = signal(false);
  readonly summary = signal<DashboardSummary | null>(null);
  readonly errorMessage = signal('');

  ngOnInit(): void { this.loadDashboard(); }

  loadDashboard(): void {
    if (this.loading()) return;
    this.loading.set(true);
    this.errorMessage.set('');
    this.api.getDashboardSummary().subscribe({
      next: data => { this.summary.set(data); this.loading.set(false); },
      error: err => { this.errorMessage.set(err?.error?.detail || 'Your business overview could not be loaded. Please try again.'); this.loading.set(false); }
    });
  }

  formatStatus(status: string): string { return status === 'InProgress' ? 'In progress' : status; }
}
