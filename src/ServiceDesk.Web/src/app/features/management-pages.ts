import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../core/auth.service';
import { BusinessProfile, WorkspaceContext } from '../core/api.models';
import { Job, WorkApiService } from '../core/work-api.service';

interface ScheduledJobCell {
  id: string;
  title: string;
  time: string;
  tech: string;
  status: string;
}

@Component({
  selector: 'app-schedule',
  imports: [RouterLink],
  template: `
<main class="page">
  <header class="page-head">
    <div>
      <p class="eyebrow">Dispatch board</p>
      <h1>Schedule</h1>
      <p>Assign work and see technician availability.</p>
    </div>
    <div class="page-actions">
      <button class="btn" (click)="goToToday()">Today</button>
      <a class="btn primary" routerLink="/app/jobs/new">＋ Create job</a>
    </div>
  </header>
  <section class="card">
    <div class="toolbar">
      <button class="icon-btn" (click)="prevWeek()" title="Previous week">‹</button>
      <strong>{{ weekLabel() }}</strong>
      <button class="icon-btn" (click)="nextWeek()" title="Next week">›</button>
      <span style="flex:1"></span>
      <button class="btn" (click)="loadJobs()">↻ Refresh</button>
    </div>
    @if (loading()) {
      <div class="callout">Loading scheduled jobs…</div>
    } @else if (error()) {
      <div class="callout" role="alert">{{ error() }}</div>
    } @else if (rawJobs().length === 0) {
      <div class="callout">No jobs are scheduled for this workspace yet.</div>
    }
    <div class="calendar">
      <div class="time-head"></div>
      @for (day of days(); track day.name) {
        <div class="day-head" [class.today]="day.isToday">
          <small>{{ day.name }}</small>
          <strong>{{ day.date }}</strong>
        </div>
      }
      @for (slot of slots(); track slot.time) {
        <div class="time">{{ slot.time }}</div>
        @for (job of slot.jobs; track $index) {
          <div class="calendar-cell">
            @if (job) {
              <a class="job-block" [class.amber]="job.status === 'InProgress'" [class.blue]="job.status === 'Scheduled'" [routerLink]="['/app/jobs', job.id]">
                <b>{{ job.title }}</b>
                <small>{{ job.time }} · {{ job.tech }}</small>
              </a>
            }
          </div>
        }
      }
    </div>
  </section>
</main>`,
  styles: `
.calendar { display: grid; grid-template-columns: 74px repeat(5, minmax(145px, 1fr)); overflow: auto; }
.time-head, .day-head { position: sticky; top: 0; z-index: 2; min-height: 64px; padding: 12px; border-bottom: 1px solid var(--line); background: #fff; }
.day-head { display: grid; place-items: center; }
.day-head.today strong { color: var(--teal); }
.day-head small { color: var(--muted); text-transform: uppercase; }
.day-head strong { font-size: 19px; }
.time { padding: 16px 12px; border-top: 1px solid var(--line-soft); color: var(--muted); font-size: 11px; }
.calendar-cell { min-height: 96px; padding: 7px; border-top: 1px solid var(--line-soft); border-left: 1px solid var(--line-soft); }
.job-block { height: 100%; display: grid; align-content: start; gap: 4px; padding: 10px; border-left: 3px solid var(--teal); border-radius: 6px; color: #174f49; background: var(--teal-tint); font-size: 11px; text-decoration: none; }
.job-block.amber { border-color: var(--amber); color: #7a4b0a; background: var(--amber-bg); }
.job-block.blue { border-color: var(--blue); color: #294f88; background: var(--blue-bg); }
.job-block small { font-size: 9px; opacity: .8; }
@media (max-width: 720px) { .calendar { grid-template-columns: 55px repeat(5, 150px); } }
`
})
export class SchedulePage implements OnInit {
  private readonly api = inject(WorkApiService);

  private readonly currentDate = signal(new Date());

  readonly weekStart = computed(() => {
    const d = new Date(this.currentDate());
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust to Monday
    return new Date(d.setDate(diff));
  });

  readonly weekLabel = computed(() => {
    const start = this.weekStart();
    const end = new Date(start);
    end.setDate(start.getDate() + 4);

    const startMonth = start.toLocaleDateString('en-US', { month: 'short' });
    const endMonth = end.toLocaleDateString('en-US', { month: 'short' });
    const year = start.getFullYear();

    if (startMonth === endMonth) {
      return `${startMonth} ${start.getDate()}–${end.getDate()}, ${year}`;
    }
    return `${startMonth} ${start.getDate()} – ${endMonth} ${end.getDate()}, ${year}`;
  });

  readonly days = computed(() => {
    const start = this.weekStart();
    const names = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
    const today = new Date();

    return names.map((name, i) => {
      const dateObj = new Date(start);
      dateObj.setDate(start.getDate() + i);
      const isToday =
        dateObj.getDate() === today.getDate() &&
        dateObj.getMonth() === today.getMonth() &&
        dateObj.getFullYear() === today.getFullYear();

      return {
        name,
        date: dateObj.getDate(),
        fullDate: dateObj.toISOString().split('T')[0],
        isToday
      };
    });
  });

  readonly rawJobs = signal<Job[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');

  readonly slots = computed(() => {
    const timeSlots = ['8 AM', '10 AM', '12 PM', '2 PM', '4 PM'];
    const currentDays = this.days();
    const jobsList = this.rawJobs();

    return timeSlots.map(t => {
      const slotHour = parseInt(t, 10) + (t.includes('PM') && !t.includes('12') ? 12 : 0);
      const jobsForDays = currentDays.map(d => {
        const found = jobsList.find(j => {
          if (j.scheduledDate !== d.fullDate) return false;
          if (!j.arrivalWindow) return t === '10 AM'; // Default slot for untimed
          const windowHour = parseInt(j.arrivalWindow, 10) + (j.arrivalWindow.includes('PM') && !j.arrivalWindow.startsWith('12') ? 12 : 0);
          return Math.abs(windowHour - slotHour) < 2;
        });

        if (!found) return null;
        return {
          id: found.id,
          title: found.title,
          time: found.arrivalWindow || t,
          tech: found.assignedMemberId ? 'Assigned' : 'Unassigned',
          status: found.status
        } as ScheduledJobCell;
      });

      return { time: t, jobs: jobsForDays };
    });
  });

  ngOnInit(): void {
    this.loadJobs();
  }

  loadJobs(): void {
    this.loading.set(true);
    this.error.set('');
    this.api.jobs('', '', 100).subscribe({
      next: res => {
        this.rawJobs.set(res.items ?? []);
        this.loading.set(false);
      },
      error: () => {
        this.rawJobs.set([]);
        this.loading.set(false);
        this.error.set('Scheduled jobs could not be loaded. Try again.');
      }
    });
  }

  prevWeek(): void {
    const current = new Date(this.currentDate());
    current.setDate(current.getDate() - 7);
    this.currentDate.set(current);
  }

  nextWeek(): void {
    const current = new Date(this.currentDate());
    current.setDate(current.getDate() + 7);
    this.currentDate.set(current);
  }

  goToToday(): void {
    this.currentDate.set(new Date());
  }
}

@Component({selector:'app-catalog',template:`<main class="page"><header class="page-head"><div><p class="eyebrow">Price book</p><h1>Services & parts</h1><p>Reusable items keep estimates, jobs, and invoices consistent.</p></div><button class="btn primary">＋ Add item</button></header><section class="grid cols-4"><article class="card stat"><span class="stat-label">Active services</span><strong class="stat-value">28</strong><span class="stat-meta">Across 5 categories</span></article><article class="card stat"><span class="stat-label">Parts & materials</span><strong class="stat-value">146</strong><span class="stat-meta">12 low stock</span></article><article class="card stat"><span class="stat-label">Average markup</span><strong class="stat-value">34%</strong><span class="stat-meta">Materials only</span></article><article class="card stat"><span class="stat-label">Taxable items</span><strong class="stat-value">121</strong><span class="stat-meta">Texas rules applied</span></article></section><section class="card section-gap"><div class="toolbar"><div class="search"><input placeholder="Search service, SKU, or category"></div><select class="filter-select" aria-label="Catalog item type"><option>All item types</option><option>Services</option><option>Parts & materials</option></select></div><div class="table-scroll"><table class="data-table"><thead><tr><th>Item</th><th>Type</th><th>Category / SKU</th><th>Cost</th><th>Sale price</th><th>Tax</th></tr></thead><tbody>@for(i of items;track i.name){<tr><td class="cell-main"><strong>{{i.name}}</strong><small>{{i.description}}</small></td><td><span class="badge" [class.blue]="i.type==='Part'">{{i.type}}</span></td><td>{{i.category}}</td><td>{{i.cost}}</td><td class="money">{{i.price}}</td><td>{{i.tax}}</td></tr>}</tbody></table></div></section></main>`})
export class CatalogPage{items=[{name:'Diagnostic visit',description:'Standard on-site assessment',type:'Service',category:'General service',cost:'—',price:'$125.00',tax:'No'},{name:'Drain cleaning',description:'Up to 75 ft main line',type:'Service',category:'Plumbing',cost:'—',price:'$285.00',tax:'No'},{name:'Temperature relief valve',description:'3/4 in brass valve',type:'Part',category:'PLB-TRV-34',cost:'$31.50',price:'$68.00',tax:'Yes'},{name:'Brake pad set',description:'Ceramic front axle set',type:'Part',category:'AUT-BRK-102',cost:'$72.00',price:'$139.00',tax:'Yes'}]}

@Component({selector:'app-estimates',template:`<main class="page"><header class="page-head"><div><p class="eyebrow">Sales pipeline</p><h1>Estimates</h1><p>Create options, send for approval, and convert accepted work into jobs.</p></div><button class="btn primary">＋ New estimate</button></header><section class="grid cols-4"><article class="card stat"><span class="stat-label">Draft</span><strong class="stat-value">5</strong><span class="stat-meta">$6,980 total</span></article><article class="card stat"><span class="stat-label">Sent</span><strong class="stat-value">3</strong><span class="stat-meta">Awaiting response</span></article><article class="card stat"><span class="stat-label">Approved</span><strong class="stat-value">68%</strong><span class="stat-meta">Last 90 days</span></article><article class="card stat"><span class="stat-label">Won value</span><strong class="stat-value">$12,480</strong><span class="stat-meta">This month</span></article></section><section class="card section-gap"><div class="toolbar"><div class="search"><input placeholder="Search estimate or customer"></div><select class="filter-select" aria-label="Estimate status"><option>Status: All</option><option>Draft</option><option>Sent</option><option>Approved</option><option>Declined</option><option>Expired</option></select></div><div class="table-scroll"><table class="data-table"><thead><tr><th>Estimate</th><th>Customer</th><th>Created</th><th>Expires</th><th>Status</th><th>Total</th></tr></thead><tbody><tr><td><b>#EST-1032</b></td><td>Sarah Miller</td><td>Sep 10</td><td>Oct 10</td><td><span class="badge amber">Sent</span></td><td class="money">$2,840.00</td></tr><tr><td><b>#EST-1031</b></td><td>Olivia Davis</td><td>Sep 8</td><td>Oct 8</td><td><span class="badge">Approved</span></td><td class="money">$1,460.00</td></tr><tr><td><b>#EST-1030</b></td><td>James Wilson</td><td>Sep 6</td><td>Oct 6</td><td><span class="badge gray">Draft</span></td><td class="money">$620.00</td></tr></tbody></table></div></section></main>`})
export class EstimatesPage{}

@Component({selector:'app-invoices',template:`<main class="page"><header class="page-head"><div><p class="eyebrow">Accounts receivable</p><h1>Invoices & payments</h1><p>Send professional invoices and track every payment.</p></div><button class="btn primary">＋ New invoice</button></header><section class="grid cols-4"><article class="card stat"><span class="stat-label">Outstanding</span><strong class="stat-value">$7,450</strong><span class="stat-meta">8 open invoices</span></article><article class="card stat"><span class="stat-label">Overdue</span><strong class="stat-value">$1,250</strong><span class="stat-meta" style="color:var(--red)">3 need follow-up</span></article><article class="card stat"><span class="stat-label">Paid this month</span><strong class="stat-value">$16,820</strong><span class="stat-meta">21 payments</span></article><article class="card stat"><span class="stat-label">Average payment time</span><strong class="stat-value">4.2 days</strong><span class="stat-meta">↓ 1.1 days</span></article></section><section class="card section-gap"><div class="toolbar"><div class="search"><input placeholder="Search invoice or customer"></div><select class="filter-select" aria-label="Invoice status"><option>Status: All</option><option>Draft</option><option>Sent</option><option>Paid</option><option>Overdue</option></select><button class="btn hide-mobile">Export</button></div><div class="table-scroll"><table class="data-table"><thead><tr><th>Invoice</th><th>Customer</th><th>Issued / Due</th><th>Status</th><th>Total</th><th>Balance</th></tr></thead><tbody>@for(i of invoices;track i.id){<tr><td><b>{{i.id}}</b></td><td>{{i.customer}}</td><td><span class="cell-main"><strong>{{i.issued}}</strong><small>Due {{i.due}}</small></span></td><td><span class="badge" [class.red]="i.status==='Overdue'" [class.amber]="i.status==='Sent'" [class.gray]="i.status==='Draft'">{{i.status}}</span></td><td class="money">{{i.total}}</td><td class="money">{{i.balance}}</td></tr>}</tbody></table></div></section></main>`})
export class InvoicesPage{invoices=[{id:'#INV-1048',customer:'Olivia Davis',issued:'Aug 4',due:'Sep 2',status:'Overdue',total:'$850.00',balance:'$850.00'},{id:'#INV-1055',customer:'Michael Brown',issued:'Sep 3',due:'Sep 17',status:'Sent',total:'$425.00',balance:'$425.00'},{id:'#INV-1056',customer:'Sarah Miller',issued:'Sep 8',due:'Sep 22',status:'Paid',total:'$245.00',balance:'$0.00'},{id:'#INV-1057',customer:'James Wilson',issued:'Sep 10',due:'Sep 24',status:'Draft',total:'$620.00',balance:'$620.00'}]}

@Component({selector:'app-reports',template:`<main class="page"><header class="page-head"><div><p class="eyebrow">Business intelligence</p><h1>Reports</h1><p>Understand revenue, jobs, customers, and technician performance.</p></div><div class="page-actions"><button class="btn">Sep 1–30, 2026⌄</button><button class="btn primary">Export report</button></div></header><section class="grid cols-4"><article class="card stat"><span class="stat-label">Revenue</span><strong class="stat-value">$18,940</strong><span class="stat-meta">↑ 12.4%</span></article><article class="card stat"><span class="stat-label">Jobs completed</span><strong class="stat-value">68</strong><span class="stat-meta">↑ 8 jobs</span></article><article class="card stat"><span class="stat-label">Average job</span><strong class="stat-value">$278</strong><span class="stat-meta">↑ $18</span></article><article class="card stat"><span class="stat-label">New customers</span><strong class="stat-value">14</strong><span class="stat-meta">↑ 3 customers</span></article></section><section class="grid cols-2 section-gap"><article class="card"><div class="card-head"><h2>Revenue trend</h2><span class="badge">+12.4%</span></div><div class="chart">@for(h of bars;track $index){<span [style.height.%]="h"></span>}</div><div class="chart-labels"><span>Apr</span><span>May</span><span>Jun</span><span>Jul</span><span>Aug</span><span>Sep</span></div></article><article class="card"><div class="card-head"><h2>Revenue by service</h2></div><div class="card-body grid"><div class="usage"><div class="usage-head"><b>Plumbing repair</b><span>$7,840 · 41%</span></div><div class="progress"><span style="width:41%"></span></div></div><div class="usage"><div class="usage-head"><b>Installation</b><span>$5,670 · 30%</span></div><div class="progress"><span style="width:30%"></span></div></div><div class="usage"><div class="usage-head"><b>Maintenance</b><span>$3,420 · 18%</span></div><div class="progress"><span style="width:18%"></span></div></div><div class="usage"><div class="usage-head"><b>Other</b><span>$2,010 · 11%</span></div><div class="progress"><span style="width:11%"></span></div></div></div></article></section><div class="callout section-gap"><strong>Advanced reports are included in your Team plan.</strong> Reports enforce your workspace and role permissions before returning business data.</div></main>`,styles:`.chart{height:250px;display:flex;align-items:end;gap:9%;padding:35px 30px 0}.chart span{flex:1;min-width:18px;border-radius:6px 6px 0 0;background:linear-gradient(#43b9ad,var(--teal))}.chart-labels{display:flex;justify-content:space-around;padding:12px 24px 20px;border-top:1px solid var(--line-soft);color:var(--muted);font-size:11px}`})
export class ReportsPage{bars=[45,62,54,71,68,88]}

@Component({
  selector: 'app-team',
  template: `
<main class="page">
  <header class="page-head">
    <div><p class="eyebrow">People & access</p><h1>Team & permissions</h1><p>Membership details for {{ businessName() }}.</p></div>
    <button class="btn primary" disabled title="Staff invitations are not available yet">＋ Invite staff</button>
  </header>
  @if (error()) {
    <div class="callout" role="alert">{{ error() }}</div>
  } @else if (soloMode()) {
    <div class="callout"><strong>Solo workspace.</strong> Team tools stay hidden from navigation until team mode is enabled.</div>
  }
  <section class="grid cols-3 section-gap">
    <article class="card stat"><span class="stat-label">Active staff</span><strong class="stat-value">1</strong><span class="stat-meta">Workspace owner</span></article>
    <article class="card stat"><span class="stat-label">Pending invitations</span><strong class="stat-value">0</strong><span class="stat-meta">Invitation workflow not enabled</span></article>
    <article class="card stat"><span class="stat-label">Current role</span><strong class="stat-value">{{ role() }}</strong><span class="stat-meta">Authenticated membership</span></article>
  </section>
  <section class="card section-gap">
    <div class="card-head"><h2>Workspace member</h2></div>
    <div class="table-scroll"><table class="data-table"><thead><tr><th>Team member</th><th>Role</th><th>Status</th></tr></thead><tbody><tr><td><span class="person"><span class="avatar">{{ initials() }}</span><span class="cell-main"><strong>{{ auth.fullName() || 'Workspace owner' }}</strong><small>{{ auth.email() }}</small></span></span></td><td>{{ role() }}</td><td><span class="badge">Active</span></td></tr></tbody></table></div>
  </section>
</main>`
})
export class TeamPage implements OnInit {
  readonly auth = inject(AuthService);
  private readonly http = inject(HttpClient);

  readonly businessName = signal(this.auth.businessName());
  readonly role = signal(this.auth.role());
  readonly soloMode = signal(false);
  readonly error = signal('');
  readonly initials = computed(() => {
    const name = this.auth.fullName().trim();
    if (!name) return '?';
    return name.split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();
  });

  ngOnInit(): void {
    const businessId = this.auth.businessId();
    if (!businessId) return;
    this.http.get<WorkspaceContext>(`/api/v1/businesses/${businessId}/workspace`).subscribe({
      next: workspace => {
        this.businessName.set(workspace.businessName);
        this.role.set(workspace.role);
        this.soloMode.set(workspace.business.soloMode);
      },
      error: () => this.error.set('Workspace membership could not be loaded.')
    });
  }
}

@Component({selector:'app-subscription',template:`<main class="page"><header class="page-head"><div><p class="eyebrow">Billing & entitlement</p><h1>Subscription</h1><p>Your API checks these limits before accepting restricted actions.</p></div><button class="btn">Billing history</button></header><section class="split"><div class="grid"><article class="card"><div class="card-head"><div><p class="eyebrow">Current plan</p><h2>Team</h2></div><span class="badge">Active</span></div><div class="card-body"><div class="price"><strong>$49</strong><span>/ month<br><small>Billed monthly</small></span></div><p class="muted">For growing service businesses that need dispatch, permissions, and reports.</p><div class="page-actions"><button class="btn primary">Change plan</button><button class="btn">Manage payment method</button></div></div></article><article class="card"><div class="card-head"><h2>Usage and plan limits</h2><small class="muted">Billing period: Sep 1–30</small></div><div class="card-body grid">@for(u of usage;track u.name){<div class="usage"><div class="usage-head"><b>{{u.name}}</b><span>{{u.display}}</span></div><div class="progress"><span [style.width.%]="u.percent" [style.background]="u.percent>80?'var(--amber)':'var(--teal)'"></span></div><small class="muted">{{u.description}}</small></div>}</div></article></div><aside class="grid"><article class="card"><div class="card-head"><h2>Included features</h2></div><div class="card-body list"><div class="list-row"><span>✓ Estimates</span><b>Enabled</b></div><div class="list-row"><span>✓ Advanced reports</span><b>Enabled</b></div><div class="list-row"><span>✓ Data export</span><b>Enabled</b></div><div class="list-row"><span>✓ Audit history</span><b>365 days</b></div></div></article><article class="card"><div class="card-head"><h2>Next invoice</h2></div><div class="card-body"><strong style="font-size:24px">$49.00</strong><p class="muted">Due October 1, 2026<br>Visa ending in 4242</p></div></article></aside></section><section class="card section-gap"><div class="card-head"><h2>How limit checks work</h2></div><div class="table-scroll"><table class="data-table"><thead><tr><th>User action</th><th>Feature code</th><th>API rule</th><th>Limit display</th></tr></thead><tbody><tr><td>Invite employee</td><td><code>staff.seats</code></td><td>Active + pending must fit limit</td><td>5 staff seats</td></tr><tr><td>Upload job photo</td><td><code>storage.bytes</code></td><td>Used + reserved upload size</td><td>10 GB storage</td></tr><tr><td>Create job</td><td><code>jobs.per_period</code></td><td>Created within billing period</td><td>500 jobs per billing period</td></tr><tr><td>Open advanced reports</td><td><code>reports.advanced.enabled</code></td><td>Entitlement must be enabled</td><td>Advanced reports enabled</td></tr><tr><td>Use estimates</td><td><code>estimates.enabled</code></td><td>Entitlement must be enabled</td><td>Estimates enabled</td></tr></tbody></table></div></section></main>`,styles:`.price{display:flex;align-items:center;gap:12px;margin-bottom:16px}.price>strong{font-family:Manrope;font-size:46px}.price span{color:var(--muted);line-height:1.2}.price small{font-size:10px}code{padding:3px 5px;border-radius:4px;background:#eef3f5;font-size:11px}`})
export class SubscriptionPage{usage=[{name:'Staff seats',display:'3 of 5',percent:60,description:'Active users plus pending invitations'},{name:'Jobs this period',display:'84 of 500',percent:17,description:'Resets October 1'},{name:'File storage',display:'2.4 GB of 10 GB',percent:24,description:'Photos, documents, and exports'}]}

@Component({
  selector: 'app-settings',
  imports: [RouterLink, FormsModule],
  template: `
<main class="page">
  <header class="page-head">
    <div>
      <p class="eyebrow">Workspace configuration</p>
      <h1>Business settings</h1>
      <p>Identity, billing, security, data, and account controls.</p>
    </div>
    <button class="btn primary" (click)="save()" [disabled]="saving() || (tab() === 'profile' && !isProfileValid())">{{ saving() ? 'Saving…' : 'Save changes' }}</button>
  </header>

  @if (savedMsg()) {
    <div class="callout section-gap" style="border-color:var(--teal);background:var(--teal-tint);color:var(--navy);margin-bottom:16px">
      {{ savedMsg() }}
    </div>
  }

  <nav class="tabs">
    <a [class.active]="tab() === 'profile'" (click)="tab.set('profile')" style="cursor:pointer">Business profile</a>
    <a [class.active]="tab() === 'notifications'" (click)="tab.set('notifications')" style="cursor:pointer">Notifications</a>
    <a>Billing & tax</a>
    <a routerLink="/app/settings/smtp">Outbound Email (SMTP)</a>
    <a>Security</a>
    <a>Data</a>
  </nav>

  @if (tab() === 'profile') {
    @if (profileLoading()) {
      <div class="callout">Loading business profile…</div>
    } @else if (profileError()) {
      <div class="callout" role="alert">{{ profileError() }}</div>
    } @else if (profile(); as business) {
      <section class="split">
        <article class="card">
          <div class="card-head"><h2>Business profile</h2></div>
          <form class="card-body form-grid" #businessForm="ngForm">
            <div class="field wide"><label for="settings-name">Business name</label><input id="settings-name" name="name" [(ngModel)]="business.name" required maxlength="200"></div>
            <div class="field"><label for="settings-industry">Business type</label><input id="settings-industry" name="industry" [(ngModel)]="business.industry" required maxlength="32"></div>
            <div class="field"><label for="settings-phone">Business phone</label><input id="settings-phone" name="phone" [(ngModel)]="business.phone" pattern="[0-9()+ .-]{7,20}"></div>
            <div class="field wide"><label for="settings-address">Street address</label><input id="settings-address" name="address" [(ngModel)]="business.address" maxlength="250"></div>
            <div class="field"><label for="settings-city">City</label><input id="settings-city" name="city" [(ngModel)]="business.city" maxlength="100"></div>
            <div class="field"><label for="settings-state">State</label><input id="settings-state" name="state" [(ngModel)]="business.state" pattern="[A-Za-z]{2}" maxlength="2"></div>
            <div class="field"><label for="settings-zip">ZIP</label><input id="settings-zip" name="zip" [(ngModel)]="business.zip" pattern="[0-9]{5}(-[0-9]{4})?" maxlength="10"></div>
            <div class="field"><label for="settings-timezone">Time zone</label><input id="settings-timezone" name="timeZone" [(ngModel)]="business.timeZone" required maxlength="80"></div>
            <div class="field"><label for="settings-currency">Currency</label><input id="settings-currency" name="currency" [(ngModel)]="business.currency" pattern="[A-Z]{3}" maxlength="3"></div>
            @if (businessForm.invalid) { <div class="field wide"><small class="muted">Correct invalid profile fields before saving.</small></div> }
          </form>
        </article>
        <aside class="grid">
          <article class="card"><div class="card-head"><h2>Email delivery</h2></div><div class="card-body list"><div class="list-row"><span class="cell-main"><strong>Custom outbound SMTP</strong><small>Send invoices and estimates from your own domain</small></span><a class="btn small" routerLink="/app/settings/smtp">Configure</a></div></div></article>
          <article class="card"><div class="card-head"><h2>Workspace mode</h2></div><div class="card-body"><strong>{{ business.soloMode ? 'Solo' : 'Team' }}</strong><p class="muted">Workspace mode is set during onboarding.</p></div></article>
        </aside>
      </section>
    }
  }

  @if (tab() === 'notifications') {
    <section class="split">
      <div class="grid">
        <article class="card">
          <div class="card-head">
            <div>
              <h2>Email notification preferences</h2>
              <p style="margin:4px 0 0;font-size:12px;color:var(--muted)">Select which events trigger automatic emails to your team and customers.</p>
            </div>
          </div>
          <div class="card-body list">
            <div class="list-row" style="display:flex;justify-content:space-between;align-items:center;padding:12px 0">
              <span class="cell-main">
                <strong>Job assignment alerts</strong>
                <small>Email technician when a new dispatch job is scheduled or updated</small>
              </span>
              <input type="checkbox" [checked]="jobAssigned()" (change)="jobAssigned.set(!jobAssigned())" style="width:20px;height:20px;accent-color:var(--teal)">
            </div>
            <div class="list-row" style="display:flex;justify-content:space-between;align-items:center;padding:12px 0">
              <span class="cell-main">
                <strong>Invoice issued notifications</strong>
                <small>Email customer when an invoice is issued with online payment link</small>
              </span>
              <input type="checkbox" [checked]="invoiceIssued()" (change)="invoiceIssued.set(!invoiceIssued())" style="width:20px;height:20px;accent-color:var(--teal)">
            </div>
            <div class="list-row" style="display:flex;justify-content:space-between;align-items:center;padding:12px 0">
              <span class="cell-main">
                <strong>Payment received confirmations</strong>
                <small>Email receipt to customer and notification to accounting staff</small>
              </span>
              <input type="checkbox" [checked]="paymentReceived()" (change)="paymentReceived.set(!paymentReceived())" style="width:20px;height:20px;accent-color:var(--teal)">
            </div>
            <div class="list-row" style="display:flex;justify-content:space-between;align-items:center;padding:12px 0">
              <span class="cell-main">
                <strong>Daily dispatch digest</strong>
                <small>Morning summary email of scheduled jobs and technician assignments</small>
              </span>
              <input type="checkbox" [checked]="dailyDigest()" (change)="dailyDigest.set(!dailyDigest())" style="width:20px;height:20px;accent-color:var(--teal)">
            </div>
          </div>
        </article>
      </div>

      <aside class="grid">
        <article class="card">
          <div class="card-head"><h2>Alert delivery</h2></div>
          <div class="card-body form-grid">
            <div class="field wide">
              <label>Accounting / Alert Email</label>
              <input [value]="recipientEmail()" (input)="onRecipientInput($event)" placeholder="billing@northstar.example">
            </div>
            <div class="field wide">
              <button class="btn primary" (click)="savePreferences()" style="width:100%">Save notification settings</button>
            </div>
          </div>
        </article>
      </aside>
    </section>
  }
</main>`
})
export class SettingsPage implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);

  readonly tab = signal<'profile' | 'notifications'>('profile');
  readonly savedMsg = signal('');
  readonly saving = signal(false);
  readonly profileLoading = signal(true);
  readonly profileError = signal('');
  readonly profile = signal<BusinessProfile | null>(null);

  readonly jobAssigned = signal(true);
  readonly invoiceIssued = signal(true);
  readonly paymentReceived = signal(true);
  readonly dailyDigest = signal(false);
  readonly recipientEmail = signal(this.auth.email());

  ngOnInit(): void {
    const bizId = this.auth.businessId();
    if (bizId) {
      this.http.get<BusinessProfile>(`/api/v1/businesses/${bizId}`).subscribe({
        next: profile => {
          this.profile.set(profile);
          this.profileLoading.set(false);
        },
        error: () => {
          this.profileLoading.set(false);
          this.profileError.set('Business profile could not be loaded.');
        }
      });
      this.http.get<{
        jobAssignedEmail: boolean;
        invoiceIssuedEmail: boolean;
        paymentReceivedEmail: boolean;
        dailyDigestEmail: boolean;
        alertEmailRecipient: string | null;
      }>(`/api/v1/businesses/${bizId}/notifications/preferences`).subscribe({
        next: pref => {
          this.jobAssigned.set(pref.jobAssignedEmail);
          this.invoiceIssued.set(pref.invoiceIssuedEmail);
          this.paymentReceived.set(pref.paymentReceivedEmail);
          this.dailyDigest.set(pref.dailyDigestEmail);
          if (pref.alertEmailRecipient) {
            this.recipientEmail.set(pref.alertEmailRecipient);
          }
        },
        error: () => {}
      });
    }
  }

  onRecipientInput(e: Event): void {
    const val = (e.target as HTMLInputElement).value;
    this.recipientEmail.set(val);
  }

  save(): void {
    if (this.tab() === 'profile') {
      this.saveProfile();
    } else {
      this.savePreferences();
    }
  }

  isProfileValid(): boolean {
    const value = this.profile();
    if (!value || !value.name.trim() || !value.industry.trim() || !value.timeZone.trim()) return false;
    if (value.phone && !/^[0-9()+ .-]{7,20}$/.test(value.phone)) return false;
    if (value.state && !/^[A-Za-z]{2}$/.test(value.state)) return false;
    if (value.zip && !/^\d{5}(-\d{4})?$/.test(value.zip)) return false;
    return /^[A-Z]{3}$/.test(value.currency);
  }

  saveProfile(): void {
    const businessId = this.auth.businessId();
    const profile = this.profile();
    if (!businessId || !profile || !profile.name.trim()) return;

    this.saving.set(true);
    this.savedMsg.set('');
    this.http.patch<BusinessProfile>(`/api/v1/businesses/${businessId}`, {
      name: profile.name.trim(),
      industry: profile.industry,
      phone: profile.phone || null,
      address: profile.address || null,
      city: profile.city || null,
      state: profile.state || null,
      zip: profile.zip || null,
      timeZone: profile.timeZone,
      currency: profile.currency
    }).subscribe({
      next: updated => {
        this.profile.set(updated);
        this.auth.activateWorkspace(updated.id, updated.name, this.auth.role());
        this.saving.set(false);
        this.savedMsg.set('Business profile saved.');
      },
      error: err => {
        this.saving.set(false);
        this.savedMsg.set(err?.error?.detail || 'Business profile could not be saved.');
      }
    });
  }

  savePreferences(): void {
    const bizId = this.auth.businessId();
    if (!bizId) {
      return;
    }

    this.saving.set(true);
    this.http.patch(`/api/v1/businesses/${bizId}/notifications/preferences`, {
      jobAssignedEmail: this.jobAssigned(),
      invoiceIssuedEmail: this.invoiceIssued(),
      paymentReceivedEmail: this.paymentReceived(),
      dailyDigestEmail: this.dailyDigest(),
      alertEmailRecipient: this.recipientEmail().trim() || null
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.savedMsg.set('Notification preferences saved successfully.');
        setTimeout(() => this.savedMsg.set(''), 4000);
      },
      error: () => {
        this.saving.set(false);
        this.savedMsg.set('Notification preferences could not be saved.');
        setTimeout(() => this.savedMsg.set(''), 4000);
      }
    });
  }
}


@Component({selector:'app-admin',template:`<main class="page"><header class="page-head"><div><p class="eyebrow">Platform operations</p><h1>Platform administration</h1><p>Monitor tenants, subscriptions, security events, and service health.</p></div><span class="badge red">Platform admin only</span></header><section class="grid cols-4"><article class="card stat"><span class="stat-label">Active businesses</span><strong class="stat-value">1,284</strong><span class="stat-meta">+42 this month</span></article><article class="card stat"><span class="stat-label">Monthly recurring revenue</span><strong class="stat-value">$48.6K</strong><span class="stat-meta">↑ 8.2%</span></article><article class="card stat"><span class="stat-label">Trial conversion</span><strong class="stat-value">31.4%</strong><span class="stat-meta">Last 30 days</span></article><article class="card stat"><span class="stat-label">Service health</span><strong class="stat-value">99.98%</strong><span class="stat-meta">All systems operational</span></article></section><section class="grid cols-2 section-gap"><article class="card"><div class="card-head"><h2>Tenant workspaces</h2><button class="btn small">View all</button></div><div class="table-scroll"><table class="data-table"><thead><tr><th>Business</th><th>Plan</th><th>Users</th><th>Status</th></tr></thead><tbody><tr><td>Northstar Services</td><td>Team</td><td>3</td><td><span class="badge">Active</span></td></tr><tr><td>Precision Auto Care</td><td>Pro</td><td>8</td><td><span class="badge">Active</span></td></tr><tr><td>BrightWire Electric</td><td>Solo</td><td>1</td><td><span class="badge amber">Trial</span></td></tr></tbody></table></div></article><article class="card"><div class="card-head"><h2>Recent security & audit events</h2><button class="btn small">Open audit explorer</button></div><div class="card-body list"><div class="list-row"><span class="cell-main"><strong>Plan entitlement changed</strong><small>platform-admin@servicedesk · 4 min ago</small></span><span class="badge blue">Plan</span></div><div class="list-row"><span class="cell-main"><strong>Tenant export completed</strong><small>Northstar Services · 18 min ago</small></span><span class="badge">Export</span></div><div class="list-row"><span class="cell-main"><strong>Failed owner login</strong><small>IP 192.0.2.14 · 22 min ago</small></span><span class="badge red">Security</span></div></div></article></section><section class="card section-gap"><div class="card-head"><h2>Platform controls</h2></div><div class="card-body grid cols-3"><button class="btn">Manage plans & entitlements</button><button class="btn">Review backup jobs</button><button class="btn">Inspect webhook failures</button><button class="btn">Manage feature flags</button><button class="btn">View support access log</button><button class="btn">Export platform metrics</button></div></section></main>`})
export class AdminPage{}

@Component({selector:'app-technician',imports:[RouterLink],template:`<main class="tech-page"><header><a routerLink="/app/jobs/detail">‹ Back</a><span>Job #J-1084</span><button>•••</button></header><section class="tech-hero"><span class="badge amber">In progress</span><h1>Water heater inspection</h1><p>Sarah Miller</p></section><section class="tech-card"><small>NEXT APPOINTMENT · 9:00–10:30 AM</small><h2>2401 Lakeview Drive</h2><p>Austin, TX 78703</p><div class="tech-actions"><button>☎ Call</button><button>◇ Message</button><button>↗ Navigate</button></div></section><section class="tech-card"><h2>Work instructions</h2><p>Inspect the existing 50-gallon water heater, test pressure and temperature controls, and provide replacement options.</p><div class="callout"><b>Access note:</b> Gate code 2468.</div></section><section class="tech-card"><div class="card-head"><h2>Checklist</h2><b>2 / 4</b></div>@for(item of checks;track item.label){<label class="check-row"><input type="checkbox" [checked]="item.done"><span>{{item.label}}</span></label>}</section><section class="tech-card"><h2>Photos & notes</h2><div class="upload">＋<b>Add job photos</b><small>Camera or photo library</small></div><textarea rows="3" placeholder="Add an internal note…"></textarea></section><button class="complete">Complete job</button></main>`,styles:`:host{display:block;background:#edf2f4;min-height:100vh}.tech-page{max-width:520px;min-height:100vh;margin:auto;padding-bottom:100px;background:#f7f9fa}.tech-page>header{height:60px;display:flex;align-items:center;justify-content:space-between;padding:0 18px;color:#fff;background:var(--navy)}header a{color:#fff;text-decoration:none}header button{border:0;color:#fff;background:transparent}.tech-hero{padding:24px 18px 12px}.tech-hero h1{margin:12px 0 4px;font-size:25px}.tech-hero p{margin:0;color:var(--muted)}.tech-card{margin:12px;padding:18px;border:1px solid var(--line);border-radius:13px;background:#fff}.tech-card>small{color:var(--teal);font-size:9px;font-weight:800}.tech-card h2{margin:8px 0;font-size:17px}.tech-card p{color:var(--muted);line-height:1.5}.tech-actions{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:16px}.tech-actions button{min-height:46px;border:1px solid var(--line);border-radius:8px;background:#fff;font-size:11px;font-weight:700}.check-row{display:flex;gap:12px;padding:14px 0;border-top:1px solid var(--line-soft)}.check-row input{accent-color:var(--teal)}.upload{display:grid;place-items:center;gap:5px;padding:20px;border:1px dashed #aebfc6;border-radius:9px;color:var(--teal)}.upload small{color:var(--muted)}textarea{width:100%;margin-top:12px;padding:11px;border:1px solid var(--line);border-radius:8px}.complete{position:fixed;left:50%;bottom:18px;transform:translateX(-50%);width:min(calc(100% - 36px),484px);min-height:52px;border:0;border-radius:10px;color:#fff;background:var(--teal);font-weight:800;box-shadow:var(--shadow)}`})
export class TechnicianPage{checks=[{label:'Confirm shutoff valve condition',done:true},{label:'Test temperature and pressure valve',done:true},{label:'Check tank and connections for leaks',done:false},{label:'Explain findings to customer',done:false}]}
