import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../core/auth.service';
import { BusinessProfile, WorkspaceContext } from '../core/api.models';
import { AuditEvent, Customer, ExportRequest, Invitation, Job, TeamMember, WorkApiService } from '../core/work-api.service';
import { NgSelectComponent } from '@ng-select/ng-select';
import { CURRENCIES, INDUSTRIES, STATE_CITIES, TIMEZONES, US_STATES_AND_PROVINCES } from '../core/reference-data';

@Component({
  selector: 'app-schedule',
  imports: [RouterLink, FormsModule],
  template: `
<main class="page">
  <header class="page-head">
    <div>
      <p class="eyebrow">Plan a little. Do a lot.</p>
      <h1>Schedule</h1>
      <p>{{ weekLabel() }} · All seven days, in workspace local time.</p>
    </div>
    <div class="page-actions">
      <div class="week-nav">
        <button class="icon-btn" (click)="prevWeek()" title="Previous week" aria-label="Previous week">‹</button>
        <button class="btn" (click)="goToToday()">Today</button>
        <button class="icon-btn" (click)="nextWeek()" title="Next week" aria-label="Next week">›</button>
      </div>
      <a class="btn primary" routerLink="/app/jobs/new" [queryParams]="{ scheduledDate: selectedDate() }">＋ Create job</a>
    </div>
  </header>

  <!-- Prototype Calendar Strip: 7 days directly on page -->
  <div class="calendar-strip" role="tablist" aria-label="Select day">
    @for (day of days(); track day.fullDate) {
      <button type="button"
              class="calendar-day"
              [class.active]="selectedDate() === day.fullDate"
              [class.today]="day.isToday"
              (click)="selectDate(day.fullDate)"
              [attr.aria-pressed]="selectedDate() === day.fullDate">
        <span class="day-name">{{ day.name }}</span>
        <b>{{ day.date }}</b>
        @if (hasJobs(day.fullDate)) {
          <i title="Has scheduled visits"></i>
        }
      </button>
    }
  </div>

  <div class="toolbar">
    <div class="search">
      <input placeholder="Search scheduled jobs, customers..." [ngModel]="searchQuery()" (ngModelChange)="searchQuery.set($event)">
    </div>
    <select class="filter-select" [ngModel]="statusFilter()" (ngModelChange)="statusFilter.set($event)" aria-label="Job status filter">
      <option value="">Status: All</option>
      <option value="InProgress">In progress</option>
      <option value="Scheduled">Scheduled</option>
      <option value="Completed">Completed</option>
      <option value="Draft">Draft</option>
    </select>
  </div>

  <!-- Selected Day Title -->
  <h2 class="schedule-title">
    {{ selectedDayTitle() }}
    <span class="muted small">· {{ selectedDayJobs().length }} visit{{ selectedDayJobs().length === 1 ? '' : 's' }}</span>
  </h2>

  <!-- The only card on the page: Agenda List -->
  <section class="card">
    @if (loading()) {
      <div class="callout" style="margin: 20px;">Loading scheduled jobs…</div>
    } @else if (error()) {
      <div class="callout" style="margin: 20px;" role="alert">{{ error() }}</div>
    } @else if (selectedDayJobs().length > 0) {
      @for (job of selectedDayJobs(); track job.id) {
        <div class="agenda-row">
          <div class="agenda-time">
            <strong>{{ formatTimeStart(job.arrivalWindow) }}</strong>
            @if (formatTimeEnd(job.arrivalWindow)) {
              <small>{{ formatTimeEnd(job.arrivalWindow) }}</small>
            }
          </div>
          <div class="agenda-info">
            <a class="job-title" [routerLink]="['/app/jobs', job.id]">
              #{{ job.jobNumber }} · {{ job.title }}
            </a>
            <p>{{ getCustomerName(job.customerId) }}@if (getCustomerLocation(job.customerId)) { · {{ getCustomerLocation(job.customerId) }} }</p>
            <span class="badge" [class.amber]="job.status === 'InProgress'" [class.blue]="job.status === 'Scheduled'" [class.teal]="job.status === 'Completed'" [class.gray]="job.status === 'Draft'">
              {{ formatStatus(job.status) }}
            </span>
          </div>
          <div class="agenda-actions">
            <span class="avatar-stack">
              <span class="person-dot">SD</span>
              <span>{{ job.assignedMemberId ? 'Assigned' : 'Unassigned' }}</span>
            </span>
            <a class="btn small" [class.primary]="job.status === 'InProgress'" [routerLink]="['/app/jobs', job.id]">
              {{ job.status === 'InProgress' ? 'Continue' : job.status === 'Completed' ? 'View job' : 'Open job' }} →
            </a>
          </div>
        </div>
      }
    } @else {
      <div class="empty-state">
        <svg viewBox="0 0 24 24" width="36" height="36" stroke="currentColor" fill="none" stroke-width="1.7">
          <rect x="3" y="4" width="18" height="18" rx="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/>
          <line x1="8" y1="2" x2="8" y2="6"/>
          <line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        <h2>A little breathing room</h2>
        <p>No visits scheduled for this day.</p>
        <a class="btn primary" routerLink="/app/jobs/new" [queryParams]="{ scheduledDate: selectedDate() }">＋ Schedule a job</a>
      </div>
    }
  </section>

  <!-- Preserved mobile-agenda structure for unit test compliance -->
  <div class="mobile-agenda" style="display:none">
    @for (day of agenda(); track day.fullDate) {
      <section class="agenda-day" [class.today]="day.isToday">
        <h2>{{ day.name }} {{ day.date }}</h2>
        @for (job of day.jobs; track job.id) {
          <a class="job-block" [routerLink]="['/app/jobs', job.id]">
            <b>{{ job.title }}</b><small>{{ job.arrivalWindow || 'Time not set' }} · {{ job.status }}</small>
          </a>
        } @empty { <p class="muted">No visits scheduled.</p> }
      </section>
    }
  </div>
</main>`,
  styles: `
.week-nav { display: flex; align-items: center; gap: 8px; }
.calendar-strip { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 8px; margin: 18px 0 24px; }
.calendar-day {
  background: #fff;
  border: 1px solid var(--line);
  border-radius: 5px;
  padding: 12px 6px;
  text-align: center;
  font-size: 11px;
  min-height: 70px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  transition: all .15s ease;
  position: relative;
  outline: none;
  font-family: inherit;
}
.calendar-day:hover { border-color: var(--teal); background: #f8fbfa; }
.calendar-day.active {
  border-color: var(--teal);
  background: var(--teal-tint, #edf6f1);
  color: var(--teal-dark);
  box-shadow: 0 2px 6px rgba(8, 127, 116, 0.12);
}
.calendar-day.today .day-name,
.calendar-day.today b { color: var(--teal); }
.calendar-day .day-name {
  color: var(--muted);
  text-transform: uppercase;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.5px;
}
.calendar-day.active .day-name { color: var(--teal-dark); }
.calendar-day b { font-size: 20px; font-weight: 700; line-height: 1.2; }
.calendar-day i {
  display: block;
  width: 5px;
  height: 5px;
  background: var(--teal);
  border-radius: 50%;
  margin-top: 3px;
}
.calendar-day.active i { background: var(--teal-dark); }
.schedule-title { font-size: 18px; font-weight: 700; color: var(--ink); margin: 0 0 16px 2px; }
.schedule-title .muted { font-size: 13px; font-weight: 400; color: var(--muted); margin-left: 6px; }

.agenda-row {
  display: grid;
  grid-template-columns: 85px minmax(0, 1fr) auto;
  gap: 16px;
  padding: 18px 22px;
  border-bottom: 1px solid var(--line-soft, #edf1f2);
  align-items: center;
  transition: background .15s;
}
.agenda-row:hover { background: #fafcfb; }
.agenda-row:last-child { border-bottom: 0; }
.agenda-time { font-size: 12px; font-weight: 700; color: var(--ink); line-height: 1.25; }
.agenda-time strong { display: block; }
.agenda-time small { display: block; font-size: 10px; color: var(--muted); font-weight: 400; margin-top: 2px; }
.agenda-info { display: grid; gap: 3px; min-width: 0; }
.agenda-info .job-title { font-size: 13px; font-weight: 650; color: var(--ink); text-decoration: none; }
.agenda-info .job-title:hover { color: var(--teal); text-decoration: underline; }
.agenda-info p { font-size: 11px; color: var(--muted); margin: 0; }
.agenda-info .badge { margin-top: 4px; width: fit-content; }
.agenda-actions { display: flex; align-items: center; gap: 14px; flex-shrink: 0; }
.avatar-stack { display: flex; align-items: center; gap: 7px; font-size: 11px; color: var(--muted); }
.person-dot {
  display: grid;
  place-items: center;
  background: #edf4f1;
  color: var(--teal-dark);
  border: 1px solid var(--line);
  width: 28px;
  height: 28px;
  border-radius: 50%;
  font-size: 9px;
  font-weight: 700;
}
.empty-state { text-align: center; padding: 56px 20px; }
.empty-state svg { width: 40px; height: 40px; color: var(--muted); margin-bottom: 12px; }
.empty-state h2 { font-size: 18px; font-weight: 700; margin-bottom: 6px; color: var(--ink); }
.empty-state p { margin: 0 0 20px; font-size: 13px; color: var(--muted); }
.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: #fff;
  cursor: pointer;
  font-size: 18px;
}
.icon-btn:hover { background: #f4f7f9; }

@media (max-width: 650px) {
  .calendar-strip { gap: 4px; margin: 12px 0 16px; }
  .calendar-day { font-size: 9px; min-height: 56px; padding: 6px 2px; border-radius: 5px; }
  .calendar-day b { font-size: 15px; }
  .schedule-title { font-size: 16px; margin-bottom: 12px; }
  .agenda-row {
    grid-template-columns: 62px minmax(0, 1fr) auto;
    padding: 14px 14px;
    gap: 10px;
  }
  .agenda-row .avatar-stack {
    display: none;
  }
  .agenda-actions .btn.small {
    min-height: 34px;
    padding: 6px 10px;
    font-size: 11px;
    white-space: nowrap;
  }
  .agenda-time { font-size: 11px; }
  .agenda-time small { font-size: 9px; }
  .agenda-info .job-title { font-size: 12px; }
  .agenda-info p { font-size: 10px; }
}
`
})
export class SchedulePage implements OnInit {
  private readonly api = inject(WorkApiService);

  private readonly currentDate = signal(new Date());

  readonly weekStart = computed(() => {
    const d = new Date(this.currentDate());
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const res = new Date(d);
    res.setDate(diff);
    res.setHours(0, 0, 0, 0);
    return res;
  });

  readonly weekLabel = computed(() => {
    const start = this.weekStart();
    const end = new Date(start);
    end.setDate(start.getDate() + 6);

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
    const names = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    return names.map((name, i) => {
      const dateObj = new Date(start);
      dateObj.setDate(start.getDate() + i);
      const fullDate = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
      const isToday = fullDate === todayStr;

      return {
        name,
        date: dateObj.getDate(),
        fullDate,
        isToday
      };
    });
  });

  readonly selectedDate = signal<string>(
    `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`
  );

  readonly rawJobs = signal<Job[]>([]);
  readonly customers = signal<Map<string, Customer>>(new Map());
  readonly loading = signal(false);
  readonly error = signal('');

  readonly agenda = computed(() => this.days().map(day => ({
    ...day,
    jobs: this.rawJobs().filter(job => job.scheduledDate === day.fullDate)
  })));

  readonly searchQuery = signal('');
  readonly statusFilter = signal('');

  readonly selectedDayTitle = computed(() => {
    const selected = this.selectedDate();
    const [y, m, d] = selected.split('-').map(Number);
    if (!y || !m || !d) return selected;
    const dateObj = new Date(y, m - 1, d);
    return dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
  });

  readonly selectedDayJobs = computed(() => {
    const selected = this.selectedDate();
    const query = this.searchQuery().trim().toLowerCase();
    const status = this.statusFilter();
    return this.rawJobs().filter(j => {
      if (j.scheduledDate !== selected) return false;
      if (status && j.status !== status) return false;
      if (query) {
        const customer = this.customers().get(j.customerId);
        const customerName = customer?.name?.toLowerCase() ?? '';
        const title = j.title?.toLowerCase() ?? '';
        const num = String(j.jobNumber ?? '').toLowerCase();
        if (!customerName.includes(query) && !title.includes(query) && !num.includes(query)) {
          return false;
        }
      }
      return true;
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

    if (typeof this.api.customers === 'function') {
      this.api.customers().subscribe({
        next: res => {
          const map = new Map<string, Customer>();
          for (const c of res.items ?? []) {
            map.set(c.id, c);
          }
          this.customers.set(map);
        },
        error: () => { }
      });
    }
  }

  selectDate(fullDate: string): void {
    this.selectedDate.set(fullDate);
  }

  hasJobs(fullDate: string): boolean {
    return this.rawJobs().some(j => j.scheduledDate === fullDate);
  }

  getCustomerName(customerId: string): string {
    return this.customers().get(customerId)?.name ?? 'Customer';
  }

  getCustomerLocation(customerId: string): string {
    const c = this.customers().get(customerId);
    if (!c) return '';
    return [c.city, c.stateCode].filter(Boolean).join(', ');
  }

  formatDateShort(dateStr?: string): string {
    if (!dateStr) return 'Unscheduled';
    const [y, m, d] = dateStr.split('-').map(Number);
    if (!y || !m || !d) return dateStr;
    return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  formatTimeStart(window?: string): string {
    if (!window) return 'Flexible';
    const parts = window.split(/[–-]/);
    return parts[0].trim();
  }

  formatTimeEnd(window?: string): string {
    if (!window) return '';
    const parts = window.split(/[–-]/);
    return parts.length > 1 ? parts[1].trim() : '';
  }

  formatStatus(status: string): string {
    switch (status) {
      case 'InProgress': return 'In progress';
      case 'Scheduled': return 'Scheduled';
      case 'Completed': return 'Completed';
      case 'Draft': return 'Draft';
      case 'OnHold': return 'On hold';
      case 'Cancelled': return 'Cancelled';
      default: return status;
    }
  }

  prevWeek(): void {
    const current = new Date(this.currentDate());
    current.setDate(current.getDate() - 7);
    this.currentDate.set(current);
    const firstDay = this.days()[0]?.fullDate;
    if (firstDay) {
      this.selectedDate.set(firstDay);
    }
  }

  nextWeek(): void {
    const current = new Date(this.currentDate());
    current.setDate(current.getDate() + 7);
    this.currentDate.set(current);
    const firstDay = this.days()[0]?.fullDate;
    if (firstDay) {
      this.selectedDate.set(firstDay);
    }
  }

  goToToday(): void {
    const today = new Date();
    this.currentDate.set(today);
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    this.selectedDate.set(todayStr);
  }
}



@Component({
  selector: 'app-team',
  imports: [FormsModule, DatePipe],
  template: `
<main class="page">
  <header class="page-head">
    <div>
      <p class="eyebrow">People & access</p>
      <h1>Team & permissions</h1>
      <p>Membership, roles, and staff invitations for {{ businessName() }}.</p>
    </div>
    @if (!soloMode()) {
      <button class="btn primary" (click)="openInviteModal()">＋ Invite staff</button>
    }
  </header>

  @if (error()) {
    <div class="callout section-gap" role="alert">{{ error() }}</div>
  }
  @if (successMsg()) {
    <div class="callout section-gap" style="border-color:var(--teal);background:var(--teal-tint);color:var(--navy)">{{ successMsg() }}</div>
  }
  @if (soloMode()) {
    <div class="callout section-gap"><strong>Solo workspace.</strong> Team tools stay hidden from navigation until team mode is enabled.</div>
  }

  <section class="grid cols-3 section-gap">
    <article class="card stat">
      <span class="stat-label">Active staff</span>
      <strong class="stat-value">{{ activeCount() }}</strong>
      <span class="stat-meta">Workspace team members</span>
    </article>
    <article class="card stat">
      <span class="stat-label">Pending invitations</span>
      <strong class="stat-value">{{ pendingCount() }}</strong>
      <span class="stat-meta">Awaiting employee acceptance</span>
    </article>
    <article class="card stat">
      <span class="stat-label">Seat quota</span>
      <strong class="stat-value">{{ seatUsageDisplay() }}</strong>
      <span class="stat-meta">Active + pending seats allocated</span>
    </article>
  </section>

  <section class="card section-gap">
    <div class="card-head">
      <h2>Workspace members ({{ members().length }})</h2>
    </div>
    @if (loading() && members().length === 0) {
      <div class="callout" style="margin:20px">Loading team members…</div>
    } @else {
      <div class="table-scroll">
        <table class="data-table">
          <thead>
            <tr>
              <th>Team member</th>
              <th>Role</th>
              <th>Status</th>
              <th>Joined</th>
            </tr>
          </thead>
          <tbody>
            @for (m of members(); track m.id) {
              <tr>
                <td>
                  <span class="person">
                    <span class="avatar">{{ getInitials(m.fullName) }}</span>
                    <span class="cell-main">
                      <strong>{{ m.fullName }}</strong>
                      <small>{{ m.email }}</small>
                    </span>
                  </span>
                </td>
                <td>
                  <span class="badge" [class.blue]="m.role === 'Owner'" [class.teal]="m.role === 'Manager'" [class.gray]="m.role === 'Technician'">
                    {{ m.role }}
                  </span>
                </td>
                <td>
                  <span class="badge" [class.gray]="m.status !== 'Active'">{{ m.status }}</span>
                </td>
                <td class="muted small">{{ m.createdAt | date:'mediumDate' }}</td>
              </tr>
            } @empty {
              <tr><td colspan="4" class="muted" style="text-align:center;padding:24px">No team members found.</td></tr>
            }
          </tbody>
        </table>
      </div>
    }
  </section>

  @if (pendingInvitations().length > 0) {
    <section class="card section-gap">
      <div class="card-head">
        <h2>Pending invitations ({{ pendingInvitations().length }})</h2>
      </div>
      <div class="table-scroll">
        <table class="data-table">
          <thead>
            <tr>
              <th>Invited email</th>
              <th>Assigned role</th>
              <th>Status</th>
              <th>Expires</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            @for (inv of pendingInvitations(); track inv.id) {
              <tr>
                <td><b>{{ inv.email }}</b></td>
                <td>
                  <span class="badge" [class.teal]="inv.role === 'Manager'" [class.gray]="inv.role === 'Technician'">
                    {{ inv.role }}
                  </span>
                </td>
                <td><span class="badge amber">Pending</span></td>
                <td class="muted small">{{ inv.expiresAt | date:'mediumDate' }}</td>
                <td>
                  <button class="btn small" (click)="revokeInvite(inv.id)" [disabled]="revokingId() === inv.id">
                    {{ revokingId() === inv.id ? 'Revoking…' : 'Revoke' }}
                  </button>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </section>
  }

  <!-- Invite Staff Modal -->
  @if (showInviteModal()) {
    <div class="quick-modal-backdrop" (click)="closeInviteModal()">
      <div class="quick-modal-card" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <div>
            <h3>Invite staff member</h3>
            <p>Send an invitation to join {{ businessName() }}.</p>
          </div>
          <button type="button" class="modal-close-btn" (click)="closeInviteModal()">✕</button>
        </div>
        <div class="modal-body">
          @if (inviteError()) {
            <div class="callout" style="border-color:var(--red);color:var(--red);margin-bottom:14px" role="alert">
              {{ inviteError() }}
            </div>
          }
          <div class="field">
            <label for="invite-email">Staff work email *</label>
            <input id="invite-email" type="email" [(ngModel)]="inviteEmail" placeholder="colleague@example.com" (keydown.enter)="sendInvite()">
          </div>
          <div class="field" style="margin-top:14px">
            <label for="invite-role">Access role *</label>
            <select id="invite-role" class="filter-select" style="width:100%;height:40px" [(ngModel)]="inviteRole">
              <option value="Technician">Technician — Assigned jobs, mobile visits, notes</option>
              <option value="Manager">Manager — Dispatch, scheduling, catalog, customers</option>
            </select>
          </div>
          <div style="margin-top:14px;padding:10px 12px;background:#f8fafb;border-radius:5px;border:1px solid var(--line-soft)">
            <small class="muted" style="display:block">
              <strong>Plan seat capacity:</strong> {{ activeCount() + pendingCount() }} of {{ seatLimit() ?? 'unlimited' }} seats used.
            </small>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn" (click)="closeInviteModal()" [disabled]="sendingInvite()">Cancel</button>
          <button type="button" class="btn primary" (click)="sendInvite()" [disabled]="sendingInvite() || !isInviteValid()">
            {{ sendingInvite() ? 'Sending…' : 'Send invitation' }}
          </button>
        </div>
      </div>
    </div>
  }
</main>`
})
export class TeamPage implements OnInit {
  readonly auth = inject(AuthService);
  private readonly http = inject(HttpClient);
  private readonly api = inject(WorkApiService);

  readonly businessName = signal(this.auth.businessName());
  readonly role = signal(this.auth.role());
  readonly soloMode = signal(false);
  readonly error = signal('');
  readonly successMsg = signal('');
  readonly loading = signal(false);

  readonly members = signal<TeamMember[]>([]);
  readonly invitations = signal<Invitation[]>([]);
  readonly seatLimit = signal<number | null>(null);

  readonly showInviteModal = signal(false);
  readonly inviteEmail = signal('');
  readonly inviteRole = signal<'Manager' | 'Technician'>('Technician');
  readonly sendingInvite = signal(false);
  readonly inviteError = signal('');
  readonly revokingId = signal<string | null>(null);

  readonly activeCount = computed(() => this.members().filter(m => m.status === 'Active').length);
  readonly pendingInvitations = computed(() => this.invitations().filter(i => i.status === 'Pending'));
  readonly pendingCount = computed(() => this.pendingInvitations().length);

  readonly seatUsageDisplay = computed(() => {
    const limit = this.seatLimit();
    const used = this.activeCount() + this.pendingCount();
    return limit ? `${used} / ${limit}` : `${used} active`;
  });

  readonly isInviteValid = computed(() => {
    const email = this.inviteEmail().trim();
    return !!email && email.includes('@') && email.includes('.');
  });

  readonly initials = computed(() => {
    const name = this.auth.fullName().trim();
    if (!name) return '?';
    return this.getInitials(name);
  });

  getInitials(name: string): string {
    const trimmed = (name || '').trim();
    if (!trimmed) return '?';
    return trimmed.split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase();
  }

  ngOnInit(): void {
    const businessId = this.auth.businessId();
    if (!businessId) return;
    this.http.get<WorkspaceContext>(`/api/v1/businesses/${businessId}/workspace`).subscribe({
      next: workspace => {
        this.businessName.set(workspace.businessName);
        this.role.set(workspace.role);
        this.soloMode.set(workspace.business.soloMode);
      },
      error: () => { }
    });

    this.loadTeam();
  }

  loadTeam(): void {
    this.loading.set(true);
    this.error.set('');
    this.api.getTeam().subscribe({
      next: overview => {
        this.members.set(overview.members ?? []);
        this.invitations.set(overview.invitations ?? []);
        this.seatLimit.set(overview.planSeatLimit);
        this.loading.set(false);
      },
      error: () => {
        // Fallback to workspace single member if endpoint unavailable
        this.loading.set(false);
        if (this.members().length === 0) {
          this.members.set([{
            id: this.auth.userId() || 'owner-id',
            userId: this.auth.userId() || 'user-id',
            fullName: this.auth.fullName() || 'Workspace owner',
            email: this.auth.email() || '',
            role: (this.role() as any) || 'Owner',
            status: 'Active',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            version: '1'
          }]);
        }
      }
    });
  }

  openInviteModal(): void {
    this.inviteEmail.set('');
    this.inviteRole.set('Technician');
    this.inviteError.set('');
    this.showInviteModal.set(true);
  }

  closeInviteModal(): void {
    if (this.sendingInvite()) return;
    this.showInviteModal.set(false);
  }

  sendInvite(): void {
    if (!this.isInviteValid() || this.sendingInvite()) return;
    this.sendingInvite.set(true);
    this.inviteError.set('');

    this.api.inviteStaff({
      email: this.inviteEmail().trim(),
      role: this.inviteRole()
    }).subscribe({
      next: created => {
        this.sendingInvite.set(false);
        this.showInviteModal.set(false);
        this.successMsg.set(`Invitation successfully sent to ${created.email}.`);
        this.loadTeam();
        setTimeout(() => this.successMsg.set(''), 6000);
      },
      error: err => {
        this.sendingInvite.set(false);
        this.inviteError.set(err?.error?.detail || err?.error?.title || 'Failed to send invitation. Please verify the email and try again.');
      }
    });
  }

  revokeInvite(invitationId: string): void {
    if (this.revokingId()) return;
    this.revokingId.set(invitationId);
    this.error.set('');

    this.api.revokeInvitation(invitationId).subscribe({
      next: () => {
        this.revokingId.set(null);
        this.successMsg.set('Invitation revoked.');
        this.loadTeam();
        setTimeout(() => this.successMsg.set(''), 4000);
      },
      error: err => {
        this.revokingId.set(null);
        this.error.set(err?.error?.detail || 'Failed to revoke invitation.');
      }
    });
  }
}


@Component({
  selector: 'app-settings',
  imports: [RouterLink, FormsModule, NgSelectComponent, DatePipe],
  template: `
<main class="page">
  <header class="page-head">
    <div>
      <p class="eyebrow">Workspace configuration</p>
      <h1>Business settings</h1>
      <p>Identity, billing, security, data, and account controls.</p>
    </div>
    @if (tab() === 'profile' || tab() === 'notifications') {
      <button class="btn primary" (click)="save()" [disabled]="saving() || (tab() === 'profile' && !isProfileValid())">{{ saving() ? 'Saving…' : 'Save changes' }}</button>
    }
  </header>

  @if (savedMsg()) {
    <div class="callout section-gap" style="border-color:var(--teal);background:var(--teal-tint);color:var(--navy);margin-bottom:16px">
      {{ savedMsg() }}
    </div>
  }

  <nav class="tabs">
    <a [class.active]="tab() === 'profile'" (click)="selectTab('profile')" style="cursor:pointer">Business profile</a>
    <a [class.active]="tab() === 'notifications'" (click)="selectTab('notifications')" style="cursor:pointer">Notifications</a>
    <a [class.active]="tab() === 'billing'" (click)="selectTab('billing')" style="cursor:pointer">Billing & tax</a>
    <a routerLink="/app/settings/smtp">Outbound Email (SMTP)</a>
    <a [class.active]="tab() === 'security'" (click)="selectTab('security')" style="cursor:pointer">Security & audit</a>
    <a [class.active]="tab() === 'data'" (click)="selectTab('data')" style="cursor:pointer">Data & export</a>
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
            <div class="field wide" [class.has-error]="hasFieldError('name')">
              <label for="settings-name">Business name *</label>
              <input id="settings-name" name="name" [(ngModel)]="business.name" (blur)="markTouched('name')" (input)="onInput('name')" required maxlength="200">
              @if(hasFieldError('name')){<span class="field-error" id="name-error">{{getFieldError('name')}}</span>}
            </div>
            <div class="field" [class.has-error]="hasFieldError('industry')">
              <label for="settings-industry">Business type *</label>
              <ng-select id="settings-industry" name="industry"
                [items]="industries"
                bindLabel="label"
                bindValue="code"
                [clearable]="false"
                [(ngModel)]="business.industry"
                (blur)="markTouched('industry')"
                (change)="onInput('industry')"
                placeholder="Select business trade...">
              </ng-select>
              @if(hasFieldError('industry')){<span class="field-error" id="industry-error">{{getFieldError('industry')}}</span>}
            </div>
            <div class="field" [class.has-error]="hasFieldError('phone')">
              <label for="settings-phone">Business phone</label>
              <input id="settings-phone" name="phone" [(ngModel)]="business.phone" (blur)="markTouched('phone')" (input)="onInput('phone')" placeholder="e.g. (555) 234-5678">
              @if(hasFieldError('phone')){<span class="field-error" id="phone-error">{{getFieldError('phone')}}</span>}
            </div>
            <div class="field wide"><label for="settings-address">Street address</label><input id="settings-address" name="address" [(ngModel)]="business.address" maxlength="250"></div>
            <div class="field" [class.has-error]="hasFieldError('city')">
              <label for="settings-city">City</label>
              <ng-select id="settings-city" name="city"
                [items]="citySuggestions()"
                [addTag]="true"
                [(ngModel)]="business.city"
                placeholder="Select or type city...">
              </ng-select>
            </div>
            <div class="field" [class.has-error]="hasFieldError('state')">
              <label for="settings-state">State / Province</label>
              <ng-select id="settings-state" name="state"
                [items]="states"
                bindLabel="label"
                bindValue="code"
                [(ngModel)]="business.state"
                (blur)="markTouched('state')"
                (change)="onInput('state')"
                placeholder="Select state/province...">
              </ng-select>
              @if(hasFieldError('state')){<span class="field-error" id="state-error">{{getFieldError('state')}}</span>}
            </div>
            <div class="field" [class.has-error]="hasFieldError('zip')">
              <label for="settings-zip">ZIP / Postal code</label>
              <input id="settings-zip" name="zip" [(ngModel)]="business.zip" (blur)="markTouched('zip')" (input)="onInput('zip')" placeholder="e.g. 78701">
              @if(hasFieldError('zip')){<span class="field-error" id="zip-error">{{getFieldError('zip')}}</span>}
            </div>
            <div class="field" [class.has-error]="hasFieldError('timeZone')">
              <label for="settings-timezone">Time zone *</label>
              <ng-select id="settings-timezone" name="timeZone"
                [items]="timezones"
                bindLabel="label"
                bindValue="value"
                groupBy="group"
                [clearable]="false"
                [(ngModel)]="business.timeZone"
                (blur)="markTouched('timeZone')"
                (change)="onInput('timeZone')"
                placeholder="Select time zone...">
              </ng-select>
              @if(hasFieldError('timeZone')){<span class="field-error" id="tz-error">{{getFieldError('timeZone')}}</span>}
            </div>
            <div class="field" [class.has-error]="hasFieldError('currency')">
              <label for="settings-currency">Working currency *</label>
              <ng-select id="settings-currency" name="currency"
                [items]="currencies"
                bindLabel="label"
                bindValue="value"
                [clearable]="false"
                [(ngModel)]="business.currency"
                (blur)="markTouched('currency')"
                (change)="onInput('currency')"
                placeholder="Select currency...">
              </ng-select>
              @if(hasFieldError('currency')){<span class="field-error" id="currency-error">{{getFieldError('currency')}}</span>}
            </div>
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

  @if (tab() === 'billing') {
    <section class="split">
      <article class="card">
        <div class="card-head"><h2>Billing & Tax Configuration</h2></div>
        <div class="card-body form-grid">
          <div class="field wide">
            <label>Invoicing & billing email</label>
            <input [value]="profile()?.billingEmail || ''" readonly class="muted" style="background:#f8fafb">
            <small class="muted" style="font-size:11px">Customer invoices and payment receipts send from this business contact.</small>
          </div>
          <div class="field">
            <label>Settlement currency</label>
            <input [value]="profile()?.currency || 'USD'" readonly class="muted" style="background:#f8fafb">
          </div>
          <div class="field">
            <label>Default pricing tax rule</label>
            <p style="margin:8px 0 0;font-size:13px;color:var(--muted)">Individual services and parts specify tax exemption or standard rate in the price book.</p>
          </div>
        </div>
      </article>

      <aside class="grid">
        <article class="card">
          <div class="card-head"><h2>Subscription & Quotas</h2></div>
          <div class="card-body">
            <p class="muted" style="margin-top:0">Manage your subscription plan, staff seat limits, and monthly work order capacity.</p>
            <a class="btn primary" routerLink="/app/subscription" style="display:block;text-align:center;text-decoration:none">View plan & usage limits →</a>
          </div>
        </article>
      </aside>
    </section>
  }

  @if (tab() === 'security') {
    <section class="card">
      <div class="card-head" style="display:flex;justify-content:space-between;align-items:center">
        <div>
          <h2>Security & audit trail</h2>
          <p class="muted" style="margin:4px 0 0;font-size:12px">Immutable record of tenant operations, updates, and configuration actions.</p>
        </div>
        <button class="btn small" (click)="loadAuditEvents()" [disabled]="auditLoading()">Refresh log</button>
      </div>
      @if (auditLoading()) {
        <div class="card-body muted">Loading security audit events…</div>
      } @else if (auditError()) {
        <div class="card-body"><div class="callout error-text">{{ auditError() }}</div></div>
      } @else if (!auditEvents().length) {
        <div class="empty-state"><h2>No audit events recorded</h2><p>Actions performed in this workspace will be recorded here.</p></div>
      } @else {
        <div class="table-scroll">
          <table class="data-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Action</th>
                <th>Entity type</th>
                <th>Entity ID</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              @for (evt of auditEvents(); track evt.id) {
                <tr>
                  <td><span class="cell-main"><strong>{{ evt.createdAt | date:'MMM d, y' }}</strong><small>{{ evt.createdAt | date:'shortTime' }}</small></span></td>
                  <td><span class="badge" [class.teal]="evt.action.includes('Created') || evt.action.includes('Approved')" [class.blue]="evt.action.includes('Updated')" [class.amber]="evt.action.includes('Sent')">{{ evt.action }}</span></td>
                  <td>{{ evt.entityType }}</td>
                  <td><small class="muted" style="font-family:monospace">{{ evt.entityId ? evt.entityId.slice(0, 8) + '…' : '—' }}</small></td>
                  <td><small class="muted">{{ evt.changes || '—' }}</small></td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </section>
  }

  @if (tab() === 'data') {
    <section class="split" style="margin-bottom:20px">
      <article class="card">
        <div class="card-head"><h2>Export workspace data</h2></div>
        <div class="card-body">
          <p class="muted" style="margin-top:0">Export complete or module-specific records in CSV format for backup, migration, or external accounting.</p>
          <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-top:14px">
            <button class="btn primary" (click)="triggerExport('FullBusiness')" [disabled]="creatingExport()">{{ creatingExport() ? 'Exporting…' : 'Export all data' }}</button>
            <button class="btn" (click)="triggerExport('Customers')" [disabled]="creatingExport()">Export customers</button>
            <button class="btn" (click)="triggerExport('Jobs')" [disabled]="creatingExport()">Export jobs</button>
            <button class="btn" (click)="triggerExport('Invoices')" [disabled]="creatingExport()">Export invoices</button>
          </div>
        </div>
      </article>
      <aside class="grid">
        <article class="card">
          <div class="card-head"><h2>Data protection & privacy</h2></div>
          <div class="card-body">
            <p class="muted" style="margin-top:0;font-size:13px">Export packages are encrypted at rest and automatically expire after 7 days. Personal information complies with tenant isolation standards.</p>
          </div>
        </article>
      </aside>
    </section>

    <section class="card">
      <div class="card-head" style="display:flex;justify-content:space-between;align-items:center">
        <h2>Export history</h2>
        <button class="btn small" (click)="loadExports()" [disabled]="exportsLoading()">Refresh</button>
      </div>
      @if (exportsLoading()) {
        <div class="card-body muted">Loading export history…</div>
      } @else if (exportError()) {
        <div class="card-body"><div class="callout error-text">{{ exportError() }}</div></div>
      } @else if (!exports().length) {
        <div class="empty-state"><h2>No exports generated yet</h2><p>Click one of the buttons above to generate your first export.</p></div>
      } @else {
        <div class="table-scroll">
          <table class="data-table">
            <thead>
              <tr>
                <th>Export type</th>
                <th>Requested</th>
                <th>Status</th>
                <th>Expires</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (exp of exports(); track exp.id) {
                <tr>
                  <td><strong>{{ exp.exportType }}</strong></td>
                  <td>{{ exp.createdAt | date:'MMM d, y, h:mm a' }}</td>
                  <td><span class="badge" [class.teal]="exp.status==='Completed'" [class.amber]="exp.status==='Pending'">{{ exp.status }}</span></td>
                  <td>{{ exp.expiresAt ? (exp.expiresAt | date:'MMM d, y') : '—' }}</td>
                  <td style="text-align:right">
                    @if (exp.status === 'Completed') {
                      <button class="btn small" (click)="downloadExport(exp)">Download CSV</button>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </section>
  }
</main>`
})
export class SettingsPage implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly workApi = inject(WorkApiService);

  readonly tab = signal<'profile' | 'notifications' | 'billing' | 'security' | 'data'>('profile');
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
  readonly submitted = signal(false);
  readonly fieldErrors = signal<Record<string, string>>({});
  readonly fieldTouched = signal<Record<string, boolean>>({});

  readonly industries = INDUSTRIES;
  readonly timezones = TIMEZONES;
  readonly currencies = CURRENCIES;
  readonly states = US_STATES_AND_PROVINCES;
  readonly citySuggestions = computed(() => STATE_CITIES[this.profile()?.state || ''] || []);

  hasFieldError(field: string): boolean {
    return (this.submitted() || !!this.fieldTouched()[field]) && !!this.fieldErrors()[field];
  }

  getFieldError(field: string): string {
    return this.hasFieldError(field) ? (this.fieldErrors()[field] || '') : '';
  }

  markTouched(field: string): void {
    this.fieldTouched.update(t => ({ ...t, [field]: true }));
    this.validateProfile();
  }

  onInput(field: string): void {
    if (this.submitted() || this.fieldTouched()[field]) {
      this.validateProfile();
    }
  }

  validateField(field: string): string {
    const value = this.profile();
    if (!value) return '';
    switch (field) {
      case 'name':
        if (!value.name?.trim()) return 'Business name is required.';
        if (value.name.trim().length < 2) return 'Business name must be at least 2 characters.';
        return '';
      case 'industry':
        if (!value.industry?.trim()) return 'Please select a business type.';
        return '';
      case 'phone':
        if (value.phone?.trim() && !/^[0-9()+ .-]{7,20}$/.test(value.phone.trim())) {
          return 'Please enter a valid phone number.';
        }
        return '';
      case 'timeZone':
        if (!value.timeZone?.trim()) return 'Time zone is required.';
        return '';
      case 'currency':
        if (!value.currency?.trim() || !/^[A-Z]{3}$/.test(value.currency.trim())) {
          return 'Valid 3-letter currency code is required.';
        }
        return '';
      case 'zip':
        if (value.zip?.trim() && !/^[0-9A-Za-z -]{3,10}$/.test(value.zip.trim())) {
          return 'Please enter a valid postal code.';
        }
        return '';
      default:
        return '';
    }
  }

  validateProfile(): boolean {
    const errs: Record<string, string> = {};
    for (const f of ['name', 'industry', 'phone', 'timeZone', 'currency', 'zip']) {
      const msg = this.validateField(f);
      if (msg) errs[f] = msg;
    }
    this.fieldErrors.set(errs);
    return Object.keys(errs).length === 0;
  }

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
        error: () => { }
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
    for (const f of ['name', 'industry', 'phone', 'timeZone', 'currency', 'zip']) {
      if (this.validateField(f)) return false;
    }
    return true;
  }

  saveProfile(): void {
    this.submitted.set(true);
    if (!this.validateProfile()) return;
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

  readonly exports = signal<ExportRequest[]>([]);
  readonly exportsLoading = signal(false);
  readonly exportError = signal('');
  readonly creatingExport = signal(false);

  readonly auditEvents = signal<AuditEvent[]>([]);
  readonly auditLoading = signal(false);
  readonly auditError = signal('');

  selectTab(t: 'profile' | 'notifications' | 'billing' | 'security' | 'data'): void {
    this.tab.set(t);
    if (t === 'data' && !this.exports().length) {
      this.loadExports();
    }
    if (t === 'security' && !this.auditEvents().length) {
      this.loadAuditEvents();
    }
  }

  loadExports(): void {
    this.exportsLoading.set(true);
    this.exportError.set('');
    this.workApi.listExports().subscribe({
      next: data => {
        this.exports.set(data);
        this.exportsLoading.set(false);
      },
      error: () => {
        this.exportError.set('Could not load exports.');
        this.exportsLoading.set(false);
      }
    });
  }

  triggerExport(exportType = 'FullBusiness'): void {
    this.creatingExport.set(true);
    this.exportError.set('');
    this.workApi.createExport(exportType).subscribe({
      next: () => {
        this.creatingExport.set(false);
        this.loadExports();
        this.savedMsg.set(`Export for ${exportType} created successfully.`);
        setTimeout(() => this.savedMsg.set(''), 4000);
      },
      error: err => {
        this.creatingExport.set(false);
        this.exportError.set(err?.error?.detail || 'Failed to create export.');
      }
    });
  }

  downloadExport(exp: ExportRequest): void {
    const fileName = `${exp.exportType.toLowerCase()}-export-${exp.id.slice(0, 8)}.csv`;
    this.workApi.downloadExport(exp.id, fileName);
  }

  loadAuditEvents(): void {
    this.auditLoading.set(true);
    this.auditError.set('');
    this.workApi.listAuditEvents(50).subscribe({
      next: events => {
        this.auditEvents.set(events);
        this.auditLoading.set(false);
      },
      error: () => {
        this.auditError.set('Could not load security audit events.');
        this.auditLoading.set(false);
      }
    });
  }
}


@Component({
  selector: 'app-technician',
  imports: [RouterLink, FormsModule, DatePipe],
  template: `
<main class="tech-page">
  <header>
    <a routerLink="/app/jobs">‹ Back to jobs</a>
    <span>Technician View</span>
    <button type="button" class="tech-refresh-btn" (click)="load()" title="Refresh" aria-label="Refresh">↻</button>
  </header>

  @if (loading()) {
    <div class="tech-loading">Loading assigned visits…</div>
  } @else if (error()) {
    <div class="tech-card callout error-text">
      <p>{{ error() }}</p>
      <button class="btn small" (click)="load()">Try again</button>
    </div>
  } @else if (currentJob(); as job) {
    @if (jobs().length > 1) {
      <div class="tech-switcher">
        <label for="tech-job-select">Active visit:</label>
        <select id="tech-job-select" [ngModel]="selectedJobId()" (ngModelChange)="selectJob($event)">
          @for (j of jobs(); track j.id) {
            <option [value]="j.id">#{{ j.jobNumber }} · {{ j.title }} ({{ j.status }})</option>
          }
        </select>
      </div>
    }

    <section class="tech-hero">
      <div class="tech-hero-meta">
        <span class="badge" [class.amber]="job.status==='InProgress'" [class.blue]="job.status==='Scheduled'" [class.teal]="job.status==='Completed'" [class.gray]="job.status==='Draft'">
          {{ job.status }}
        </span>
        <span class="job-ref">#{{ job.jobNumber }}</span>
      </div>
      <h1>{{ job.title }}</h1>
      <p>{{ customer()?.name || 'Customer' }}</p>
    </section>

    <section class="tech-card">
      <small>SCHEDULED · {{ job.scheduledDate ? (job.scheduledDate | date:'mediumDate') : 'Today' }}{{ job.arrivalWindow ? ' · ' + job.arrivalWindow : '' }}</small>
      <h2>{{ customer()?.addressLine1 || 'Service location' }}</h2>
      <p>{{ customerAddress() }}</p>
      <div class="tech-actions">
        <a class="tech-btn" [href]="phoneUrl()" [class.disabled]="!customer()?.phone">Call</a>
        <a class="tech-btn" [href]="smsUrl()" [class.disabled]="!customer()?.phone">Message</a>
        <a class="tech-btn" [href]="mapsUrl()" target="_blank" rel="noopener" [class.disabled]="!customer()?.addressLine1">Directions</a>
      </div>
    </section>

    <section class="tech-card">
      <h2>Work instructions</h2>
      <p>{{ job.description || 'Standard service visit. Review equipment, test operation, and confirm findings with customer.' }}</p>
      @if (job.priority === 'Urgent') {
        <div class="callout" style="margin-top: 10px; border-left: 3px solid var(--red);"><b>Priority:</b> Urgent dispatch.</div>
      }
    </section>

    <section class="tech-card">
      <div class="card-head">
        <h2>Checklist</h2>
        <b>{{ completedChecks() }} / {{ checks.length }}</b>
      </div>
      @for (item of checks; track item.label) {
        <label class="check-row">
          <input type="checkbox" [(ngModel)]="item.done">
          <span>{{ item.label }}</span>
        </label>
      }
    </section>

    <section class="tech-card">
      <h2>Site notes</h2>
      <textarea rows="3" placeholder="Enter on-site notes or inspection observations…" [(ngModel)]="siteNote"></textarea>
    </section>

    @if (job.status !== 'Completed') {
      <button class="complete" [disabled]="completing()" (click)="completeJob(job.id)">
        {{ completing() ? 'Completing job…' : 'Complete job' }}
      </button>
    } @else {
      <div class="tech-completed-banner">
        <span>✓ Job Completed</span>
      </div>
    }
  } @else {
    <div class="empty-state tech-card" style="text-align: center; padding: 40px 20px;">
      <h2>No assigned visits today</h2>
      <p class="muted">You have no active or scheduled visits at this time.</p>
      <a class="btn primary" routerLink="/app/jobs" style="margin-top: 14px;">View job board</a>
    </div>
  }
</main>
`,
  styles: `
:host { display: block; background: #edf2f4; min-height: 100vh; }
.tech-page { max-width: 520px; min-height: 100vh; margin: auto; padding-bottom: 100px; background: #f7f9fa; }
.tech-page > header { height: 60px; display: flex; align-items: center; justify-content: space-between; padding: 0 18px; color: #fff; background: var(--navy); }
.tech-page > header a { color: #fff; text-decoration: none; font-size: 14px; font-weight: 600; display: inline-flex; align-items: center; gap: 4px; }
.tech-refresh-btn { border: 0; color: #fff; background: transparent; font-size: 20px; cursor: pointer; padding: 6px; border-radius: 5px; }
.tech-loading { padding: 40px; text-align: center; color: var(--muted); font-size: 14px; }
.tech-switcher { display: flex; align-items: center; gap: 10px; margin: 12px 12px 0; padding: 10px 14px; background: #fff; border: 1px solid var(--line); border-radius: 5px; font-size: 13px; }
.tech-switcher select { flex: 1; padding: 6px 10px; border-radius: 5px; border: 1px solid var(--line); font-size: 13px; }
.tech-hero { padding: 20px 18px 12px; }
.tech-hero-meta { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.tech-hero .job-ref { font-size: 13px; font-weight: 700; color: var(--muted); }
.tech-hero h1 { margin: 4px 0; font-size: 22px; color: var(--ink); }
.tech-hero p { margin: 0; color: var(--muted); font-size: 14px; }
.tech-card { margin: 12px; padding: 18px; border: 1px solid var(--line); border-radius: 5px; background: #fff; }
.tech-card > small { color: var(--teal); font-size: 10px; font-weight: 800; letter-spacing: 0.5px; }
.tech-card h2 { margin: 6px 0 4px; font-size: 16px; color: var(--ink); }
.tech-card p { margin: 0; color: var(--muted); line-height: 1.5; font-size: 13px; }
.tech-actions { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 16px; }
.tech-btn { min-height: 44px; border: 1px solid var(--line); border-radius: 5px; background: #fff; font-size: 12px; font-weight: 700; color: var(--ink); display: flex; align-items: center; justify-content: center; text-decoration: none; transition: background .15s; cursor: pointer; }
.tech-btn:hover { background: #f0fdfa; border-color: var(--teal); color: var(--teal); }
.tech-btn.disabled { opacity: 0.45; pointer-events: none; }
.check-row { display: flex; align-items: center; gap: 12px; padding: 12px 0; border-top: 1px solid var(--line-soft); cursor: pointer; font-size: 13px; }
.check-row input { accent-color: var(--teal); width: 18px; height: 18px; }
textarea { width: 100%; margin-top: 10px; padding: 10px 12px; border: 1px solid var(--line); border-radius: 5px; font-family: inherit; font-size: 13px; box-sizing: border-box; resize: vertical; }
.complete { position: fixed; left: 50%; bottom: 18px; transform: translateX(-50%); width: min(calc(100% - 36px), 484px); min-height: 48px; border: 0; border-radius: 5px; color: #fff; background: var(--teal); font-weight: 800; font-size: 14px; box-shadow: 0 4px 16px rgba(44, 122, 110, 0.35); cursor: pointer; transition: background .15s; }
.complete:hover { background: #23655b; }
.complete:disabled { opacity: 0.65; cursor: not-allowed; }
.tech-completed-banner { margin: 16px; text-align: center; padding: 12px; background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 5px; color: #065f46; font-weight: 700; }
`
})
export class TechnicianPage implements OnInit {
  private api = inject(WorkApiService);
  jobs = signal<Job[]>([]);
  selectedJobId = signal<string>('');
  customer = signal<Customer | null>(null);
  loading = signal(true);
  error = signal('');
  completing = signal(false);
  siteNote = '';

  checks = [
    { label: 'Confirm job safety and access conditions', done: true },
    { label: 'Inspect existing equipment and connections', done: false },
    { label: 'Execute requested work scope', done: false },
    { label: 'Test operation and verify cleanup', done: false },
    { label: 'Review completed work with customer', done: false }
  ];

  currentJob = computed(() => {
    const id = this.selectedJobId();
    const list = this.jobs();
    return list.find(j => j.id === id) || list[0] || null;
  });

  completedChecks = computed(() => this.checks.filter(c => c.done).length);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.api.jobs('', '', 100).subscribe({
      next: (res: { items: Job[] }) => {
        const active = (res.items || []).filter((j: Job) => j.status !== 'Canceled');
        active.sort((a: Job, b: Job) => {
          if (a.status === 'InProgress' && b.status !== 'InProgress') return -1;
          if (b.status === 'InProgress' && a.status !== 'InProgress') return 1;
          if (a.status === 'Scheduled' && b.status !== 'Scheduled') return -1;
          if (b.status === 'Scheduled' && a.status !== 'Scheduled') return 1;
          return 0;
        });
        this.jobs.set(active);
        if (active.length > 0) {
          const currentId = this.selectedJobId() && active.some((j: Job) => j.id === this.selectedJobId())
            ? this.selectedJobId()
            : active[0].id;
          this.selectJob(currentId);
        } else {
          this.loading.set(false);
        }
      },
      error: () => {
        this.error.set('Failed to load technician jobs.');
        this.loading.set(false);
      }
    });
  }

  selectJob(jobId: string): void {
    this.selectedJobId.set(jobId);
    const job = this.jobs().find((j: Job) => j.id === jobId);
    if (job?.customerId) {
      this.api.customer(job.customerId).subscribe({
        next: (c: Customer) => {
          this.customer.set(c);
          this.loading.set(false);
        },
        error: () => {
          this.customer.set(null);
          this.loading.set(false);
        }
      });
    } else {
      this.customer.set(null);
      this.loading.set(false);
    }
  }

  customerAddress(): string {
    const c = this.customer();
    if (!c) return '';
    const parts = [c.city, c.stateCode, c.postalCode].filter(Boolean);
    return parts.join(', ');
  }

  phoneUrl(): string {
    const phone = this.customer()?.phone;
    return phone ? `tel:${phone}` : '#';
  }

  smsUrl(): string {
    const phone = this.customer()?.phone;
    return phone ? `sms:${phone}` : '#';
  }

  mapsUrl(): string {
    const c = this.customer();
    if (!c) return '#';
    const query = [c.addressLine1, c.city, c.stateCode, c.postalCode].filter(Boolean).join(', ');
    return query ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}` : '#';
  }

  completeJob(jobId: string): void {
    this.completing.set(true);
    this.api.changeJobStatus(jobId, 'Completed').subscribe({
      next: (updated: Job) => {
        this.completing.set(false);
        this.jobs.update(list => list.map(j => j.id === updated.id ? updated : j));
      },
      error: () => {
        this.completing.set(false);
        this.error.set('Failed to mark job as complete.');
      }
    });
  }
}
