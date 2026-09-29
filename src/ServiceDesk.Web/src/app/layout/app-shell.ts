import { afterNextRender, Component, computed, ElementRef, HostListener, inject, Injector, OnInit, signal, ViewChild } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { WorkspaceContext } from '../core/api.models';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
<div class="app-layout">
  @if (drawer()) {
    <button class="scrim" aria-label="Close menu" (click)="close()"></button>
  }
  <aside id="workspace-navigation" class="app-sidebar" [class.open]="drawer()">
    <div class="brand-row">
      <a class="brand" routerLink="/app/overview" (click)="close()"><span>S</span> ServiceDesk</a>
      <button #closeMenuButton class="close-menu" aria-label="Close menu" (click)="close(true)">×</button>
    </div>
    <div class="workspace-picker">
      <span class="workspace-logo">{{ workspaceInitials() }}</span>
      <span><strong>{{ workspaceName() }}</strong><small>{{ workspaceDescription() }}</small></span>
    </div>
    <nav aria-label="Workspace navigation">
      @for (group of navigation(); track group.title) {
        <p>{{ group.title }}</p>
        @for (item of group.items; track item.path) {
          <a [routerLink]="item.path" routerLinkActive="active" (click)="close()">
            <span class="nav-icon" aria-hidden="true">
              @switch (item.icon) {
                @case ('overview') { <svg viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg> }
                @case ('customers') { <svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> }
                @case ('jobs') { <svg viewBox="0 0 24 24"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg> }
                @case ('schedule') { <svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> }
                @case ('estimates') { <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg> }
                @case ('invoices') { <svg viewBox="0 0 24 24"><rect x="2" y="4" width="20" height="16" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/><path d="M12 14v4M10 16h4"/></svg> }
                @case ('catalog') { <svg viewBox="0 0 24 24"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg> }
                @case ('reports') { <svg viewBox="0 0 24 24"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg> }
                @case ('team') { <svg viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> }
                @case ('subscription') { <svg viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg> }
                @case ('settings') { <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg> }
              }
            </span>{{ item.label }}
          </a>
        }
      }
    </nav>
    <div class="sidebar-footer">
      <div class="plan-mini">
        <span><b>Subscription</b><small>View plan and usage</small></span>
        <a routerLink="/app/subscription" (click)="close()">Manage</a>
      </div>
      <button class="user-card" type="button" (click)="logout()" title="Click to sign out">
        <span class="avatar">{{ userInitials() }}</span>
        <span><strong>{{ auth.fullName() || 'Signed-in user' }}</strong><small>{{ auth.role() }} · Sign out</small></span>
      </button>
    </div>
  </aside>
  <section class="app-content" [attr.inert]="drawer() ? '' : null">
    <header class="topbar">
      <button #menuButton class="menu-button" (click)="open()" aria-label="Open menu"
              aria-controls="workspace-navigation" [attr.aria-expanded]="drawer()">☰</button>
      <a class="top-search" routerLink="/app/jobs" aria-label="Search jobs">
        ⌕ <span>Search jobs…</span>
      </a>
      <div class="top-actions">
        <button class="btn-refresh" type="button" (click)="triggerRefresh()" [disabled]="refreshing()" [class.spinning]="refreshing()" title="Refresh page" aria-label="Refresh page">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
          </svg>
        </button>
        <button class="btn-logout" type="button" (click)="logout()" title="Sign out">Sign out</button>
        <span class="avatar" aria-label="Signed-in user">{{ userInitials() }}</span>
      </div>
    </header>
    <div class="pull-to-refresh-indicator" [class.visible]="pullDistance() > 8 || refreshing()" [class.refreshing]="refreshing()" [style.transform]="'translate(-50%, ' + pullOffset() + 'px)'" [attr.aria-hidden]="!refreshing() && pullDistance() <= 8">
      <div class="ptr-circle" [class.ready]="pullDistance() >= pullThreshold">
        @if (refreshing()) {
          <div class="ptr-spinner" aria-label="Refreshing"></div>
        } @else {
          <svg class="ptr-arrow" [style.transform]="'rotate(' + pullAngle() + 'deg)'" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <polyline points="19 12 12 19 5 12"></polyline>
          </svg>
        }
      </div>
    </div>
    <router-outlet (activate)="onActivate($event)" />
  </section>
  <nav class="bottom-nav" aria-label="Mobile navigation" [attr.inert]="drawer() ? '' : null">
    <a routerLink="/app/overview" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }">
      <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z"/></svg>
      Home
    </a>
    <a routerLink="/app/jobs" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }">
      <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M8 5V3h8v2 M4 5h16v16H4z M8 10h8 M8 14h5"/></svg>
      Jobs
    </a>
    <a routerLink="/app/jobs/new" class="create" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }">
      <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 5v14 M5 12h14"/></svg>
      New job
    </a>
    <a routerLink="/app/schedule" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }">
      <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 5h16v16H4z M8 3v4 M16 3v4 M4 10h16 M8 14h2 M14 14h2"/></svg>
      Schedule
    </a>
    <button type="button" (click)="open()" aria-label="More navigation" [attr.aria-expanded]="drawer()">
      <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M5 12h.01 M12 12h.01 M19 12h.01"/></svg>
      More
    </button>
  </nav>
</div>`,
  styles: `
:host { display: block; min-height: 100vh; width: 100%; max-width: 100vw; overflow-x: clip; }
.app-layout { min-height: 100vh; display: grid; grid-template-columns: 248px minmax(0, 1fr); width: 100%; max-width: 100vw; overflow-x: clip; }
.app-sidebar { position: sticky; top: 0; z-index: 30; height: 100vh; display: flex; flex-direction: column; padding: 20px 14px; color: #e9f0f3; background: var(--navy); overflow: auto; scrollbar-width: thin; scrollbar-color: #274d5d transparent; }
.app-sidebar::-webkit-scrollbar { width: 6px; }
.app-sidebar::-webkit-scrollbar-track { background: transparent; }
.app-sidebar::-webkit-scrollbar-thumb { background: #274d5d; border-radius: 3px; }
.brand-row { display: flex; align-items: center; justify-content: space-between; padding: 0 9px; }
.brand { display: flex; align-items: center; gap: 10px; color: #fff; font-size: 19px; font-weight: 800; text-decoration: none; }
.brand > span { width: 29px; height: 29px; display: grid; place-items: center; border-radius: 8px; color: var(--navy); background: #65d0c5; font-size: 16px; }
.close-menu { display: none; border: 0; color: #fff; background: transparent; font-size: 28px; cursor: pointer; }
.workspace-picker { width: 100%; display: grid; grid-template-columns: 35px 1fr; align-items: center; gap: 10px; margin: 22px 0; padding: 10px; border: 1px solid #31505d; border-radius: 10px; color: #fff; background: #173846; text-align: left; }
.workspace-logo { width: 35px; height: 35px; display: grid; place-items: center; border-radius: 8px; color: #14323e; background: #ccebe5; font-size: 11px; font-weight: 800; }
.workspace-picker span:nth-child(2) { min-width: 0; display: grid; gap: 2px; }
.workspace-picker strong { overflow: hidden; font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
.workspace-picker small { color: #aac0c9; font-size: 10px; }
.app-sidebar nav p { margin: 16px 10px 6px; color: #78939e; font-size: 9px; font-weight: 800; letter-spacing: .13em; text-transform: uppercase; }
.app-sidebar nav a { position: relative; display: flex; align-items: center; gap: 11px; padding: 10px 11px; border-radius: 8px; color: #c9d7dd; font-size: 13px; font-weight: 600; text-decoration: none; }
.app-sidebar nav a:hover, .app-sidebar nav a.active { color: #fff; background: #1c4653; }
.app-sidebar nav a.active::before { content: ''; position: absolute; left: -14px; width: 3px; height: 22px; border-radius: 0 4px 4px 0; background: #59c7bc; }
.app-sidebar .nav-icon { width: 19px; text-align: center; font-size: 15px; }
.app-sidebar nav em { margin-left: auto; min-width: 20px; padding: 2px 6px; border-radius: 10px; color: #fff; background: #b14b45; font-size: 9px; font-style: normal; text-align: center; }
.sidebar-footer { display: grid; gap: 10px; margin-top: auto; padding-top: 22px; }
.plan-mini { display: flex; justify-content: space-between; gap: 8px; padding: 12px; border: 1px solid #31505d; border-radius: 9px; }
.plan-mini > span { display: grid; gap: 3px; }
.plan-mini b { font-size: 11px; }
.plan-mini small { color: #8fa8b2; font-size: 10px; }
.plan-mini a { align-self: center; color: #6fd1c7; font-size: 10px; font-weight: 700; text-decoration: none; }
.user-card { display: flex; align-items: center; gap: 10px; padding: 10px; border: 0; color: #fff; background: transparent; text-align: left; cursor: pointer; border-radius: 8px; transition: background .15s; }
.user-card:hover { background: #1c4653; }
.user-card > span:last-child { display: grid; gap: 2px; }
.user-card strong { font-size: 11px; }
.user-card small { color: #8fa8b2; font-size: 10px; }
.app-content { min-width: 0; max-width: 100%; width: 100%; overflow-x: clip; }
.topbar { height: 66px; display: flex; align-items: center; justify-content: space-between; padding: 0 28px; border-bottom: 1px solid var(--line); background: #fff; }
.menu-button { display: none; border: 0; background: transparent; font-size: 21px; cursor: pointer; line-height: 1; }
.top-search { width: min(440px, 50vw); height: 38px; display: flex; align-items: center; gap: 9px; padding: 0 11px; border: 1px solid var(--line); border-radius: 8px; color: var(--muted); background: #f8fafb; font-size: 12px; text-decoration: none; }
.top-search kbd { margin-left: auto; padding: 2px 6px; border: 1px solid var(--line); border-radius: 4px; background: #fff; font-size: 9px; }
.top-actions { display: flex; align-items: center; gap: 9px; }
.top-actions button { position: relative; width: 36px; height: 36px; border: 1px solid var(--line); border-radius: 50%; color: var(--muted); background: #fff; cursor: pointer; }
.top-actions i { position: absolute; right: 4px; top: 3px; width: 7px; height: 7px; border: 2px solid #fff; border-radius: 50%; background: #e05252; }
.btn-logout { width: auto !important; height: 34px !important; border-radius: 6px !important; padding: 0 12px !important; font-size: 12px !important; font-weight: 600; color: var(--navy) !important; background: #f0f4f6 !important; border: 1px solid var(--line) !important; cursor: pointer; transition: background .15s; }
.btn-logout:hover { background: #e2ebef !important; }
.avatar { width: 32px; height: 32px; display: grid; place-items: center; border-radius: 50%; background: var(--teal); color: #fff; font-size: 11px; font-weight: 800; cursor: pointer; }
.bottom-nav, .scrim { display: none; }
@media (max-width: 880px) {
  .app-layout { grid-template-columns: 1fr; }
  .app-sidebar { position: fixed; left: 0; top: 0; bottom: 0; z-index: 1000; transform: translateX(-105%); visibility: hidden; width: min(270px, 100vw); transition: transform .22s ease; box-shadow: 18px 0 50px rgba(0,0,0,.2); }
  .app-sidebar.open { transform: translateX(0); visibility: visible; }
  .close-menu { display: block; min-width: 44px; min-height: 44px; }
  .scrim { display: block; position: fixed; inset: 0; z-index: 999; border: 0; background: rgba(10,28,36,.55); }
  .topbar { height: 60px; padding: 0 16px; }
  .menu-button { display: block; }
  .top-search { width: auto; flex: 1; margin: 0 12px; }
  .top-search kbd { display: none; }
  .bottom-nav { position: fixed; bottom: 0; left: 0; right: 0; z-index: 30; display: grid; grid-template-columns: repeat(5, 1fr); background: #fffffff5; backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border-top: 1px solid #dbe5e3; padding: 7px 8px max(9px, env(safe-area-inset-bottom)); box-shadow: 0 -4px 24px rgba(24, 54, 44, 0.05); }
  .bottom-nav a, .bottom-nav button { border: 0 !important; background: transparent !important; background-color: transparent !important; color: var(--muted) !important; display: flex !important; flex-direction: column !important; align-items: center !important; justify-content: center !important; gap: 4px !important; font-size: 11px !important; min-height: 46px !important; text-decoration: none !important; cursor: pointer !important; padding: 0 !important; border-radius: 0 !important; position: static !important; transition: color .15s ease !important; box-shadow: none !important; outline: none !important; }
  .bottom-nav a:hover, .bottom-nav button:hover, .bottom-nav a.active, .bottom-nav button.active { background: transparent !important; background-color: transparent !important; box-shadow: none !important; }
  .bottom-nav a:focus-visible, .bottom-nav button:focus-visible { outline: 2px solid var(--teal) !important; outline-offset: -2px; }
  .menu-button { min-width: 44px; min-height: 44px; }
  .bottom-nav a::before, .bottom-nav a::after, .bottom-nav button::before, .bottom-nav button::after { display: none !important; content: none !important; }
  .bottom-nav svg { width: 19px; height: 19px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
  .bottom-nav a.active, .bottom-nav .active { background: transparent !important; background-color: transparent !important; color: var(--teal) !important; font-weight: 700 !important; }
  .bottom-nav a.active svg, .bottom-nav .active svg { color: var(--teal) !important; stroke: var(--teal) !important; }
  .bottom-nav .create { background: transparent !important; background-color: transparent !important; }
  .bottom-nav a.create svg, .bottom-nav a.create.active svg { width: 30px !important; height: 30px !important; padding: 5px !important; border-radius: 9px !important; background: var(--teal) !important; color: #fff !important; stroke: #fff !important; stroke-width: 2.4 !important; }
}
@media (max-width: 520px) {
  .top-search span { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
  .btn-logout { display: none !important; }
}
`
})
export class AppShell implements OnInit {
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly http = inject(HttpClient);
  private readonly injector = inject(Injector);

  @ViewChild('menuButton') private menuButton?: ElementRef<HTMLButtonElement>;
  @ViewChild('closeMenuButton') private closeMenuButton?: ElementRef<HTMLButtonElement>;

  readonly drawer = signal(false);
  readonly workspace = signal<WorkspaceContext | null>(null);
  readonly pullDistance = signal(0);
  readonly refreshing = signal(false);
  readonly pullThreshold = 65;
  private activeComponent: any = null;
  private startY = 0;
  private startX = 0;
  private isTrackingTouch = false;

  readonly pullOffset = computed(() => {
    if (this.refreshing()) return 55;
    return Math.min(this.pullDistance() * 0.8, 68);
  });

  readonly pullAngle = computed(() => {
    const p = Math.min(this.pullDistance() / this.pullThreshold, 1);
    return Math.round(p * 180);
  });

  onActivate(component: any) {
    this.activeComponent = component;
  }

  @HostListener('window:touchstart', ['$event'])
  onTouchStart(event: TouchEvent) {
    if (this.refreshing() || this.drawer()) return;
    if (window.scrollY <= 1 && document.documentElement.scrollTop <= 1) {
      this.startY = event.touches[0].clientY;
      this.startX = event.touches[0].clientX;
      this.isTrackingTouch = true;
    }
  }

  @HostListener('window:touchmove', ['$event'])
  onTouchMove(event: TouchEvent) {
    if (!this.isTrackingTouch || this.refreshing()) return;
    if (window.scrollY > 2 || document.documentElement.scrollTop > 2) {
      this.isTrackingTouch = false;
      this.pullDistance.set(0);
      return;
    }
    const currentY = event.touches[0].clientY;
    const currentX = event.touches[0].clientX;
    const deltaY = currentY - this.startY;
    const deltaX = Math.abs(currentX - this.startX);

    if (deltaY > 0 && deltaY > deltaX) {
      const dist = Math.min(deltaY * 0.45, 90);
      this.pullDistance.set(dist);
      if (dist >= this.pullThreshold && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try { navigator.vibrate(8); } catch {}
      }
    } else if (deltaY < 0) {
      this.pullDistance.set(0);
    }
  }

  @HostListener('window:touchend')
  onTouchEnd() {
    if (!this.isTrackingTouch) return;
    this.isTrackingTouch = false;
    if (this.pullDistance() >= this.pullThreshold) {
      this.triggerRefresh();
    } else {
      this.pullDistance.set(0);
    }
  }

  triggerRefresh() {
    if (this.refreshing()) return;
    this.refreshing.set(true);

    const comp = this.activeComponent;
    if (comp) {
      if (typeof comp.load === 'function') {
        comp.load();
      } else if (typeof comp.loadJobs === 'function') {
        comp.loadJobs();
      } else if (typeof comp.loadDashboard === 'function') {
        comp.loadDashboard();
      } else if (typeof comp.refresh === 'function') {
        comp.refresh();
      } else if (typeof comp.ngOnInit === 'function') {
        comp.ngOnInit();
      }
    }

    setTimeout(() => {
      this.refreshing.set(false);
      this.pullDistance.set(0);
    }, 750);
  }

  readonly workspaceName = computed(() => this.workspace()?.business.name ?? this.auth.businessName());
  readonly workspaceInitials = computed(() => {
    const words = this.workspaceName().trim().split(/\s+/).filter(Boolean);
    return words.slice(0, 2).map(word => word[0]).join('').toUpperCase() || 'W';
  });
  readonly workspaceDescription = computed(() => {
    const business = this.workspace()?.business;
    if (!business) return 'Loading workspace…';
    return `${business.industry} · ${business.soloMode ? 'Solo' : 'Team'}`;
  });

  readonly userInitials = computed(() => {
    const name = this.auth.fullName();
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    return parts.length >= 2
      ? (parts[0][0] + parts[1][0]).toUpperCase()
      : name.substring(0, 2).toUpperCase();
  });

  private readonly allNavigation = [
    {
      title: 'Operate',
      items: [
        { label: 'Overview', path: '/app/overview', icon: 'overview' },
        { label: 'Customers', path: '/app/customers', icon: 'customers' },
        { label: 'Jobs', path: '/app/jobs', icon: 'jobs' },
        { label: 'Schedule', path: '/app/schedule', icon: 'schedule' }
      ]
    },
    {
      title: 'Money',
      items: [
        { label: 'Estimates', path: '/app/estimates', icon: 'estimates' },
        { label: 'Invoices', path: '/app/invoices', icon: 'invoices' },
        { label: 'Services & parts', path: '/app/catalog', icon: 'catalog' },
        { label: 'Reports', path: '/app/reports', icon: 'reports' }
      ]
    },
    {
      title: 'Manage',
      items: [
        { label: 'Team & permissions', path: '/app/team', icon: 'team' },
        { label: 'Subscription', path: '/app/subscription', icon: 'subscription' },
        { label: 'Business settings', path: '/app/settings', icon: 'settings' }
      ]
    }
  ];

  readonly navigation = computed(() => this.allNavigation.map(group => ({
    ...group,
    items: group.items.filter(item =>
      item.path !== '/app/team' || this.workspace()?.business.soloMode !== true)
  })));

  ngOnInit(): void {
    const businessId = this.auth.businessId();
    if (!businessId) return;

    this.http.get<WorkspaceContext>(`/api/v1/businesses/${businessId}/workspace`).subscribe({
      next: workspace => {
        this.workspace.set(workspace);
        this.auth.activateWorkspace(workspace.businessId, workspace.businessName, workspace.role);
      }
    });
  }

  open() {
    this.drawer.set(true);
    afterNextRender(() => this.closeMenuButton?.nativeElement.focus(), { injector: this.injector });
  }
  close(returnFocus = false) {
    this.drawer.set(false);
    if (returnFocus) {
      afterNextRender(() => this.menuButton?.nativeElement.focus(), { injector: this.injector });
    }
  }

  @HostListener('document:keydown.escape')
  closeOnEscape(): void {
    if (this.drawer()) this.close(true);
  }

  logout() {
    this.auth.logout();
    void this.router.navigate(['/login']);
  }
}
