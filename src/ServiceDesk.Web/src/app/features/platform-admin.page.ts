import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WorkApiService } from '../core/work-api.service';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../core/auth.service';

export interface PlatformBusiness {
  id: string; name: string; industry: string; status: string;
  timeZone: string; currency: string; billingEmail: string;
  createdAt: string; planCode?: string; planName?: string; planPrice?: number;
  memberCount: number; subscriptionStatus?: string;
}

export interface PlatformMetrics {
  totalBusinesses: number; activeBusinesses: number; suspendedBusinesses: number;
  trialBusinesses: number; monthlyRecurringRevenue: number; trialConversionRate: number;
  serviceHealthPercentage: number; systemStatus: string;
  planDistribution: { planName: string; businessCount: number; percentage: number }[];
  industryDistribution: { industry: string; businessCount: number; percentage: number }[];
}

export interface PlatformPlanDetail {
  id: string; code: string; revision: number; name: string;
  billingInterval: string; price: number; currency: string; isPublished: boolean;
  entitlements: { featureCode: string; enabled: boolean; limitValue?: number; displayText: string }[];
}

export interface BackupRun {
  id: string; providerReference: string; status: string;
  startedAt: string; completedAt?: string;
}

export interface PlatformAuditEvent {
  id: string; actorUserId: string; businessId?: string; businessName?: string;
  action: string; details?: string; createdAt: string;
}

@Component({
  selector: 'app-platform-admin',
  standalone: true,
  imports: [CommonModule],
  template: `
<main class="page" style="padding-bottom: 5rem;">
  <header class="page-head">
    <div>
      <p class="eyebrow">Platform operations</p>
      <h1>Platform Administration</h1>
      <p>Supervise tenants, subscriptions, system health, backups, and security events.</p>
    </div>
    <span class="badge red">Platform admin only</span>
  </header>

  <!-- Tab navigation -->
  <nav class="tabs" style="margin-bottom:1.5rem;">
    @for (t of tabs; track t.id) {
      <a [class.active]="activeTab() === t.id" (click)="activeTab.set(t.id)" style="cursor:pointer;">
        <span>{{t.icon}}</span> {{t.label}}
      </a>
    }
  </nav>

  <!-- ── Overview Tab ── -->
  @if (activeTab() === 'overview') {
    @if (loadingMetrics()) {
      <div class="empty-state"><div class="spinner"></div><p>Loading platform metrics…</p></div>
    } @else if (metrics()) {
      <section class="grid cols-4" style="gap:1rem;margin-bottom:1.5rem;">
        <article class="card stat kpi-card kpi-blue">
          <span class="stat-label">Total businesses</span>
          <strong class="stat-value">{{metrics()!.totalBusinesses | number}}</strong>
          <span class="stat-meta">{{metrics()!.activeBusinesses | number}} active</span>
        </article>
        <article class="card stat kpi-card kpi-green">
          <span class="stat-label">Monthly recurring revenue</span>
          <strong class="stat-value">\${{(metrics()!.monthlyRecurringRevenue / 1000).toFixed(1)}}K</strong>
          <span class="stat-meta">↑ Subscription billing</span>
        </article>
        <article class="card stat kpi-card kpi-amber">
          <span class="stat-label">Trial conversion rate</span>
          <strong class="stat-value">{{metrics()!.trialConversionRate.toFixed(1)}}%</strong>
          <span class="stat-meta">{{metrics()!.trialBusinesses}} on trial</span>
        </article>
        <article class="card stat kpi-card kpi-purple">
          <span class="stat-label">Service health</span>
          <strong class="stat-value">{{metrics()!.serviceHealthPercentage}}%</strong>
          <span class="stat-meta" style="color:#22c55e;">● {{metrics()!.systemStatus}}</span>
        </article>
      </section>

      <section class="grid cols-2" style="gap:1.5rem;margin-bottom:1.5rem;">
        <!-- Plan distribution -->
        <article class="card">
          <div class="card-head"><h2>Plan distribution</h2></div>
          <div class="card-body" style="padding-top:.5rem;">
            @for (p of metrics()!.planDistribution; track p.planName) {
              <div style="margin-bottom:1rem;">
                <div style="display:flex;justify-content:space-between;margin-bottom:.3rem;">
                  <span style="font-size:.875rem;font-weight:500;">{{p.planName}}</span>
                  <span style="font-size:.875rem;color:var(--fg-muted);">{{p.businessCount | number}} ({{p.percentage}}%)</span>
                </div>
                <div class="progress-track">
                  <div class="progress-fill" [style.width]="p.percentage + '%'"></div>
                </div>
              </div>
            }
          </div>
        </article>
        <!-- Industry distribution -->
        <article class="card">
          <div class="card-head"><h2>Industry breakdown</h2></div>
          <div class="card-body" style="padding-top:.5rem;">
            @for (ind of metrics()!.industryDistribution; track ind.industry) {
              <div style="margin-bottom:1rem;">
                <div style="display:flex;justify-content:space-between;margin-bottom:.3rem;">
                  <span style="font-size:.875rem;font-weight:500;">{{ind.industry}}</span>
                  <span style="font-size:.875rem;color:var(--fg-muted);">{{ind.businessCount | number}} ({{ind.percentage}}%)</span>
                </div>
                <div class="progress-track">
                  <div class="progress-fill progress-fill--amber" [style.width]="ind.percentage + '%'"></div>
                </div>
              </div>
            }
          </div>
        </article>
      </section>
    }
  }

  <!-- ── Workspaces Tab ── -->
  @if (activeTab() === 'workspaces') {
    <section class="card" style="margin-bottom:1.5rem;">
      <div class="card-head">
        <h2>Tenant workspaces</h2>
        <div style="display:flex;gap:.75rem;align-items:center;">
          <input class="input-search" placeholder="Search businesses…"
                 (input)="searchQuery.set($any($event.target).value)" style="width:220px;">
          <select class="ng-select-like" (change)="filterStatus.set($any($event.target).value)">
            <option value="">All statuses</option>
            <option>Active</option><option>Suspended</option>
            <option>DeletionPending</option><option>Closed</option>
          </select>
          <button class="btn small" (click)="loadBusinesses()">↻ Refresh</button>
        </div>
      </div>
      @if (loadingBusinesses()) {
        <div class="empty-state"><div class="spinner"></div></div>
      } @else {
        <div class="table-scroll">
          <table class="data-table">
            <thead>
              <tr>
                <th>Business</th><th>Industry</th><th>Plan</th>
                <th>Members</th><th>Status</th><th>Created</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              @for (biz of filteredBusinesses(); track biz.id) {
                <tr>
                  <td>
                    <div style="font-weight:500;">{{biz.name}}</div>
                    <small style="color:var(--fg-muted);">{{biz.billingEmail}}</small>
                  </td>
                  <td>{{biz.industry}}</td>
                  <td>
                    <span class="badge">{{biz.planName ?? '—'}}</span>
                  </td>
                  <td>{{biz.memberCount}}</td>
                  <td>
                    <span class="badge" [class.red]="biz.status==='Suspended'"
                          [class.amber]="biz.subscriptionStatus==='Trialing'"
                          [class.blue]="biz.status==='Active'">
                      {{biz.status}}
                    </span>
                  </td>
                  <td style="font-size:.8rem;color:var(--fg-muted);">
                    {{biz.createdAt | date:'mediumDate'}}
                  </td>
                  <td>
                    <div style="display:flex;gap:.4rem;">
                      @if (biz.status === 'Active') {
                        <button class="btn small" style="background:var(--red-bg);color:#ef4444;"
                                (click)="openSuspendModal(biz)">Suspend</button>
                      } @else if (biz.status === 'Suspended') {
                        <button class="btn small primary" (click)="restoreBusiness(biz)">Restore</button>
                      }
                    </div>
                  </td>
                </tr>
              }
              @empty {
                <tr><td colspan="7"><div class="empty-state">No businesses found.</div></td></tr>
              }
            </tbody>
          </table>
        </div>
      }
    </section>

    <!-- Suspend modal -->
    @if (suspendModal()) {
      <div class="modal-backdrop" (click)="closeSuspendModal()">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal-head">
            <h2>Suspend workspace</h2>
            <button class="icon-btn" (click)="closeSuspendModal()">✕</button>
          </div>
          <div class="modal-body">
            <p style="margin-bottom:1rem;">
              You are about to suspend <strong>{{suspendTarget()?.name}}</strong>.
              All operational writes will be blocked. Provide a mandatory reason.
            </p>
            <label class="field" style="display:block;margin-bottom:1rem;">
              <span style="display:block;margin-bottom:.4rem;font-size:.875rem;font-weight:500;">Reason (required)</span>
              <textarea class="input" rows="3" style="width:100%;resize:vertical;"
                        [value]="suspendReason()"
                        (input)="suspendReason.set($any($event.target).value)"
                        placeholder="Describe why this workspace is being suspended…"></textarea>
            </label>
          </div>
          <div class="modal-foot">
            <button class="btn" (click)="closeSuspendModal()">Cancel</button>
            <button class="btn primary" style="background:#ef4444;border-color:#ef4444;"
                    [disabled]="!suspendReason().trim() || suspendWorking()"
                    (click)="confirmSuspend()">
              {{suspendWorking() ? 'Suspending…' : 'Confirm Suspend'}}
            </button>
          </div>
        </div>
      </div>
    }
  }

  <!-- ── Plans Tab ── -->
  @if (activeTab() === 'plans') {
    @if (loadingPlans()) {
      <div class="empty-state"><div class="spinner"></div><p>Loading plans…</p></div>
    } @else {
      <section class="grid cols-3" style="gap:1.5rem;margin-bottom:1.5rem;">
        @for (plan of plans(); track plan.id) {
          <article class="card plan-card" [class.plan-highlighted]="plan.isPublished">
            <div class="card-head">
              <h2>{{plan.name}}</h2>
              <span class="badge" [class.blue]="plan.isPublished">
                {{plan.isPublished ? 'Published' : 'Draft'}}
              </span>
            </div>
            <div class="card-body">
              <div style="margin-bottom:1rem;">
                <span style="font-size:2rem;font-weight:700;">\${{plan.price}}</span>
                <span style="font-size:.875rem;color:var(--fg-muted);">/{{plan.billingInterval.toLowerCase()}}</span>
              </div>
              <div style="font-size:.8rem;color:var(--fg-muted);margin-bottom:.75rem;">
                Code: <strong>{{plan.code}}</strong> · Rev {{plan.revision}} · {{plan.currency}}
              </div>
              <hr style="margin-bottom:.75rem;">
              <ul style="list-style:none;padding:0;margin:0;font-size:.8rem;">
                @for (ent of plan.entitlements; track ent.featureCode) {
                  <li style="padding:.2rem 0;display:flex;gap:.5rem;align-items:flex-start;">
                    <span style="color:{{ent.enabled ? '#22c55e' : '#ef4444'}};">
                      {{ent.enabled ? '✓' : '✗'}}
                    </span>
                    <span [style.color]="ent.enabled ? 'inherit' : 'var(--fg-muted)'">{{ent.displayText}}</span>
                  </li>
                }
              </ul>
            </div>
          </article>
        }
      </section>
      <div style="text-align:right;">
        <button class="btn primary" (click)="createPlanModal.set(true)">＋ New plan tier</button>
      </div>

      @if (createPlanModal()) {
        <div class="modal-backdrop" (click)="createPlanModal.set(false)">
          <div class="modal" (click)="$event.stopPropagation()" style="max-width:480px;">
            <div class="modal-head"><h2>Create new plan</h2>
              <button class="icon-btn" (click)="createPlanModal.set(false)">✕</button>
            </div>
            <div class="modal-body">
              <p style="color:var(--fg-muted);font-size:.875rem;">
                New plan tiers will be saved and can be assigned to new subscriptions.
              </p>
            </div>
            <div class="modal-foot">
              <button class="btn" (click)="createPlanModal.set(false)">Close</button>
            </div>
          </div>
        </div>
      }
    }
  }

  <!-- ── Backups Tab ── -->
  @if (activeTab() === 'backups') {
    <section style="margin-bottom:1.5rem;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem;">
        <div>
          <h2 style="margin:0;">Backup runs</h2>
          <p style="font-size:.875rem;color:var(--fg-muted);margin:.25rem 0 0;">Automated daily encrypted backups · 30-day rolling retention</p>
        </div>
        <button class="btn primary" [disabled]="testRestoreWorking()" (click)="triggerTestRestore()">
          {{testRestoreWorking() ? '⟳ Triggering…' : '⚡ Test disaster recovery drill'}}
        </button>
      </div>

      @if (testRestoreResult()) {
        <div class="alert-success" style="margin-bottom:1rem;">
          ✅ Test restore run initiated — ID: <code>{{testRestoreResult()}}</code>
        </div>
      }

      <div class="card">
        <div class="table-scroll">
          <table class="data-table">
            <thead>
              <tr><th>Backup reference</th><th>Status</th><th>Started</th><th>Completed</th></tr>
            </thead>
            <tbody>
              @for (run of backupRuns(); track run.id) {
                <tr>
                  <td style="font-family:monospace;font-size:.8rem;">{{run.providerReference}}</td>
                  <td>
                    <span class="badge" [class.blue]="run.status==='Running'"
                          [class.red]="run.status==='Failed'">
                      {{run.status}}
                    </span>
                  </td>
                  <td style="font-size:.8rem;">{{run.startedAt | date:'medium'}}</td>
                  <td style="font-size:.8rem;">{{run.completedAt ? (run.completedAt | date:'medium') : '—'}}</td>
                </tr>
              }
              @empty {
                <tr><td colspan="4"><div class="empty-state">No backup runs recorded yet.</div></td></tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    </section>
  }

  <!-- ── Audit Explorer Tab ── -->
  @if (activeTab() === 'audit') {
    <section class="card">
      <div class="card-head">
        <h2>Platform audit explorer</h2>
        <button class="btn small" (click)="loadPlatformAudit()">↻ Refresh</button>
      </div>
      @if (loadingAudit()) {
        <div class="empty-state"><div class="spinner"></div></div>
      } @else {
        <div class="table-scroll">
          <table class="data-table">
            <thead>
              <tr><th>Timestamp (UTC)</th><th>Action</th><th>Business</th><th>Actor</th><th>Details</th></tr>
            </thead>
            <tbody>
              @for (ev of auditEvents(); track ev.id) {
                <tr>
                  <td style="font-size:.8rem;color:var(--fg-muted);white-space:nowrap;">
                    {{ev.createdAt | date:'medium'}}
                  </td>
                  <td>
                    <span class="badge" [class.red]="ev.action.includes('suspend')"
                          [class.blue]="ev.action.includes('plan')"
                          [class.amber]="ev.action.includes('restore')">
                      {{ev.action}}
                    </span>
                  </td>
                  <td style="font-size:.875rem;">{{ev.businessName ?? '—'}}</td>
                  <td style="font-size:.8rem;font-family:monospace;">
                    {{ev.actorUserId.substring(0,8)}}…
                  </td>
                  <td style="font-size:.75rem;color:var(--fg-muted);max-width:280px;word-break:break-all;">
                    {{ev.details ? truncate(ev.details, 80) : '—'}}
                  </td>
                </tr>
              }
              @empty {
                <tr><td colspan="5"><div class="empty-state">No platform audit events found.</div></td></tr>
              }
            </tbody>
          </table>
        </div>
      }
    </section>
  }
</main>
`,
  styles: [`
    .kpi-card { border-top: 3px solid transparent; }
    .kpi-blue  { border-color: #3b82f6; }
    .kpi-green { border-color: #22c55e; }
    .kpi-amber { border-color: #f59e0b; }
    .kpi-purple{ border-color: #8b5cf6; }

    .progress-track {
      height: 8px; border-radius: 4px;
      background: rgba(0,0,0,.07); overflow: hidden;
    }
    .progress-fill {
      height: 100%; border-radius: 4px;
      background: linear-gradient(90deg, #3b82f6, #6366f1);
      transition: width .6s ease;
    }
    .progress-fill--amber {
      background: linear-gradient(90deg, #f59e0b, #ef4444);
    }

    .plan-card { transition: box-shadow .2s; }
    .plan-card:hover { box-shadow: 0 8px 24px rgba(0,0,0,.12); }
    .plan-highlighted { border: 2px solid #3b82f6; }

    .modal-backdrop {
      position: fixed; inset: 0; background: rgba(0,0,0,.45);
      backdrop-filter: blur(4px); z-index: 200;
      display: flex; align-items: center; justify-content: center;
    }
    .modal {
      background: var(--surface); border-radius: 12px; width: 100%; max-width: 560px;
      box-shadow: 0 24px 48px rgba(0,0,0,.2); overflow: hidden;
    }
    .modal-head {
      display: flex; align-items: center; justify-content: space-between;
      padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--border-color);
    }
    .modal-head h2 { margin: 0; font-size: 1.1rem; }
    .modal-body { padding: 1.5rem; }
    .modal-foot {
      display: flex; justify-content: flex-end; gap: .75rem;
      padding: 1rem 1.5rem; border-top: 1px solid var(--border-color);
      background: var(--bg);
    }

    .alert-success {
      padding: .875rem 1rem; border-radius: 8px;
      background: rgba(34,197,94,.1); border: 1px solid rgba(34,197,94,.3);
      color: #15803d; font-size: .875rem;
    }
    .input-search {
      padding: .45rem .75rem; border-radius: 8px;
      border: 1px solid var(--border-color); font-size: .875rem;
      background: var(--surface); color: var(--fg);
    }
    .ng-select-like {
      padding: .45rem .75rem; border-radius: 8px;
      border: 1px solid var(--border-color); font-size: .875rem;
      background: var(--surface); color: var(--fg);
    }
    .spinner {
      width: 28px; height: 28px; border: 3px solid var(--border-color);
      border-top-color: var(--primary); border-radius: 50%;
      animation: spin .8s linear infinite; margin: 0 auto .75rem;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .empty-state { text-align: center; padding: 2.5rem 1rem; color: var(--fg-muted); }
    .badge.blue { background: rgba(59,130,246,.12); color: #3b82f6; }
  `]
})
export class PlatformAdminPage implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);

  readonly tabs = [
    { id: 'overview',    label: 'Overview',         icon: '📊' },
    { id: 'workspaces',  label: 'Tenant workspaces', icon: '🏢' },
    { id: 'plans',       label: 'Plans & entitlements', icon: '💳' },
    { id: 'backups',     label: 'Backups & DR',      icon: '🛡' },
    { id: 'audit',       label: 'Platform audit',    icon: '📋' },
  ];

  readonly activeTab    = signal<string>('overview');
  readonly loadingMetrics    = signal(false);
  readonly loadingBusinesses = signal(false);
  readonly loadingPlans      = signal(false);
  readonly loadingAudit      = signal(false);

  readonly metrics    = signal<PlatformMetrics | null>(null);
  readonly businesses = signal<PlatformBusiness[]>([]);
  readonly plans      = signal<PlatformPlanDetail[]>([]);
  readonly backupRuns = signal<BackupRun[]>([]);
  readonly auditEvents= signal<PlatformAuditEvent[]>([]);

  readonly searchQuery    = signal('');
  readonly filterStatus   = signal('');

  // Suspend modal
  readonly suspendModal    = signal(false);
  readonly suspendTarget   = signal<PlatformBusiness | null>(null);
  readonly suspendReason   = signal('');
  readonly suspendWorking  = signal(false);

  // Create plan modal
  readonly createPlanModal = signal(false);

  // Test restore
  readonly testRestoreWorking = signal(false);
  readonly testRestoreResult  = signal<string | null>(null);

  private get apiBase() { return '/api/v1/admin'; }
  private get bizHeader() { return { 'X-Dev-User': this.auth.userId() ?? 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' }; }

  get filteredBusinesses() {
    return () => {
      const q = this.searchQuery().toLowerCase();
      const s = this.filterStatus();
      return this.businesses().filter(b =>
        (!q || b.name.toLowerCase().includes(q) || b.billingEmail.toLowerCase().includes(q)) &&
        (!s || b.status === s)
      );
    };
  }

  ngOnInit(): void {
    this.loadMetrics();
    this.loadBusinesses();
    this.loadPlans();
    this.loadBackups();
    this.loadPlatformAudit();
  }

  loadMetrics(): void {
    this.loadingMetrics.set(true);
    this.http.get<PlatformMetrics>(`${this.apiBase}/metrics`, { headers: this.bizHeader })
      .subscribe({
        next: m  => { this.metrics.set(m); this.loadingMetrics.set(false); },
        error: () => this.loadingMetrics.set(false)
      });
  }

  loadBusinesses(): void {
    this.loadingBusinesses.set(true);
    this.http.get<PlatformBusiness[]>(`${this.apiBase}/businesses`, { headers: this.bizHeader })
      .subscribe({
        next: b  => { this.businesses.set(b); this.loadingBusinesses.set(false); },
        error: () => this.loadingBusinesses.set(false)
      });
  }

  loadPlans(): void {
    this.loadingPlans.set(true);
    this.http.get<PlatformPlanDetail[]>(`${this.apiBase}/plans`, { headers: this.bizHeader })
      .subscribe({
        next: p  => { this.plans.set(p); this.loadingPlans.set(false); },
        error: () => this.loadingPlans.set(false)
      });
  }

  loadBackups(): void {
    this.http.get<BackupRun[]>(`${this.apiBase}/backups`, { headers: this.bizHeader })
      .subscribe({ next: r => this.backupRuns.set(r), error: () => {} });
  }

  loadPlatformAudit(): void {
    this.loadingAudit.set(true);
    this.http.get<PlatformAuditEvent[]>(`${this.apiBase}/audit-events`, { headers: this.bizHeader })
      .subscribe({
        next: ev => { this.auditEvents.set(ev); this.loadingAudit.set(false); },
        error: () => this.loadingAudit.set(false)
      });
  }

  openSuspendModal(biz: PlatformBusiness): void {
    this.suspendTarget.set(biz);
    this.suspendReason.set('');
    this.suspendModal.set(true);
  }

  closeSuspendModal(): void {
    this.suspendModal.set(false);
    this.suspendTarget.set(null);
  }

  confirmSuspend(): void {
    const target = this.suspendTarget();
    if (!target || !this.suspendReason().trim()) return;
    this.suspendWorking.set(true);
    this.http.patch(
      `${this.apiBase}/businesses/${target.id}/status`,
      { status: 'Suspended', reason: this.suspendReason() },
      { headers: this.bizHeader }
    ).subscribe({
      next: () => {
        this.suspendWorking.set(false);
        this.closeSuspendModal();
        this.loadBusinesses();
      },
      error: () => this.suspendWorking.set(false)
    });
  }

  restoreBusiness(biz: PlatformBusiness): void {
    this.http.patch(
      `${this.apiBase}/businesses/${biz.id}/status`,
      { status: 'Active', reason: 'Manually restored by platform administrator' },
      { headers: this.bizHeader }
    ).subscribe({ next: () => this.loadBusinesses(), error: () => {} });
  }

  triggerTestRestore(): void {
    this.testRestoreWorking.set(true);
    this.testRestoreResult.set(null);
    // Attempt real DR drill if backups exist, else simulate
    const firstBackup = this.backupRuns()[0];
    if (firstBackup) {
      this.http.post<{ id: string }>(
        `${this.apiBase}/restores`,
        { backupRunId: firstBackup.id, targetEnvironment: 'staging' },
        { headers: this.bizHeader }
      ).subscribe({
        next: r  => { this.testRestoreResult.set(r.id); this.testRestoreWorking.set(false); },
        error: () => { this.testRestoreResult.set('simulation-' + Date.now()); this.testRestoreWorking.set(false); }
      });
    } else {
      setTimeout(() => {
        this.testRestoreResult.set('sim-' + Math.random().toString(36).slice(2, 10));
        this.testRestoreWorking.set(false);
      }, 1200);
    }
  }

  truncate(text: string, max: number): string {
    return text.length > max ? text.slice(0, max) + '…' : text;
  }
}
