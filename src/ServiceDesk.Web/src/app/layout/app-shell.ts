import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/auth.service';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
<div class="app-layout">
  @if (drawer()) {
    <button class="scrim" aria-label="Close menu" (click)="drawer.set(false)"></button>
  }
  <aside class="app-sidebar" [class.open]="drawer()">
    <div class="brand-row">
      <a class="brand" routerLink="/app/overview" (click)="close()"><span>S</span> ServiceDesk</a>
      <button class="close-menu" (click)="close()">×</button>
    </div>
    <button class="workspace-picker">
      <span class="workspace-logo">NS</span>
      <span><strong>Northstar Services</strong><small>Austin, TX · Team</small></span>
      <b>⌄</b>
    </button>
    <nav aria-label="Workspace navigation">
      @for (group of navigation; track group.title) {
        <p>{{ group.title }}</p>
        @for (item of group.items; track item.path) {
          <a [routerLink]="item.path" routerLinkActive="active" (click)="close()">
            <span class="nav-icon">{{ item.icon }}</span>{{ item.label }}
            @if (item.count) {
              <em>{{ item.count }}</em>
            }
          </a>
        }
      }
    </nav>
    <div class="sidebar-footer">
      <div class="plan-mini">
        <span><b>Team plan</b><small>3 of 5 seats used</small></span>
        <a routerLink="/app/subscription" (click)="close()">Manage</a>
      </div>
      <button class="user-card" type="button" (click)="logout()" title="Click to sign out">
        <span class="avatar">{{ userInitials() }}</span>
        <span><strong>{{ auth.fullName() }}</strong><small>Owner · Sign out</small></span>
      </button>
    </div>
  </aside>
  <section class="app-content">
    <header class="topbar">
      <button class="menu-button" (click)="open()" aria-label="Open menu">☰</button>
      <div class="top-search">
        ⌕ <span>Search customers, jobs, invoices…</span><kbd>⌘ K</kbd>
      </div>
      <div class="top-actions">
        <button title="Help">?</button>
        <button title="Notifications">♢<i></i></button>
        <button class="btn-logout" type="button" (click)="logout()" title="Sign out">Sign out</button>
        <span class="avatar" (click)="logout()" title="Sign out">{{ userInitials() }}</span>
      </div>
    </header>
    <router-outlet />
  </section>
  <nav class="mobile-nav" aria-label="Mobile navigation">
    @for (item of mobileNavigation; track item.path) {
      <a [routerLink]="item.path" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }">
        <span>{{ item.icon }}</span>{{ item.label }}
      </a>
    }
  </nav>
</div>`,
  styles: `
:host { display: block; min-height: 100vh; }
.app-layout { min-height: 100vh; display: grid; grid-template-columns: 248px minmax(0, 1fr); }
.app-sidebar { position: sticky; top: 0; z-index: 30; height: 100vh; display: flex; flex-direction: column; padding: 20px 14px; color: #e9f0f3; background: var(--navy); overflow: auto; }
.brand-row { display: flex; align-items: center; justify-content: space-between; padding: 0 9px; }
.brand { display: flex; align-items: center; gap: 10px; color: #fff; font-size: 19px; font-weight: 800; text-decoration: none; }
.brand > span { width: 29px; height: 29px; display: grid; place-items: center; border-radius: 8px; color: var(--navy); background: #65d0c5; font-size: 16px; }
.close-menu { display: none; border: 0; color: #fff; background: transparent; font-size: 28px; cursor: pointer; }
.workspace-picker { width: 100%; display: grid; grid-template-columns: 35px 1fr auto; align-items: center; gap: 10px; margin: 22px 0; padding: 10px; border: 1px solid #31505d; border-radius: 10px; color: #fff; background: #173846; text-align: left; cursor: pointer; }
.workspace-logo { width: 35px; height: 35px; display: grid; place-items: center; border-radius: 8px; color: #14323e; background: #ccebe5; font-size: 11px; font-weight: 800; }
.workspace-picker span:nth-child(2) { min-width: 0; display: grid; gap: 2px; }
.workspace-picker strong { overflow: hidden; font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
.workspace-picker small { color: #aac0c9; font-size: 10px; }
nav p { margin: 16px 10px 6px; color: #78939e; font-size: 9px; font-weight: 800; letter-spacing: .13em; text-transform: uppercase; }
nav a { position: relative; display: flex; align-items: center; gap: 11px; padding: 10px 11px; border-radius: 8px; color: #c9d7dd; font-size: 13px; font-weight: 600; text-decoration: none; }
nav a:hover, nav a.active { color: #fff; background: #1c4653; }
nav a.active::before { content: ''; position: absolute; left: -14px; width: 3px; height: 22px; border-radius: 0 4px 4px 0; background: #59c7bc; }
.nav-icon { width: 19px; text-align: center; font-size: 15px; }
nav em { margin-left: auto; min-width: 20px; padding: 2px 6px; border-radius: 10px; color: #fff; background: #b14b45; font-size: 9px; font-style: normal; text-align: center; }
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
.app-content { min-width: 0; }
.topbar { height: 66px; display: flex; align-items: center; justify-content: space-between; padding: 0 28px; border-bottom: 1px solid var(--line); background: #fff; }
.menu-button { display: none; border: 0; background: transparent; font-size: 21px; cursor: pointer; line-height: 1; }
.top-search { width: min(440px, 50vw); height: 38px; display: flex; align-items: center; gap: 9px; padding: 0 11px; border: 1px solid var(--line); border-radius: 8px; color: #84959d; background: #f8fafb; font-size: 12px; }
.top-search kbd { margin-left: auto; padding: 2px 6px; border: 1px solid var(--line); border-radius: 4px; background: #fff; font-size: 9px; }
.top-actions { display: flex; align-items: center; gap: 9px; }
.top-actions button { position: relative; width: 36px; height: 36px; border: 1px solid var(--line); border-radius: 50%; color: var(--muted); background: #fff; cursor: pointer; }
.top-actions i { position: absolute; right: 4px; top: 3px; width: 7px; height: 7px; border: 2px solid #fff; border-radius: 50%; background: #e05252; }
.btn-logout { width: auto !important; height: 34px !important; border-radius: 6px !important; padding: 0 12px !important; font-size: 12px !important; font-weight: 600; color: var(--navy) !important; background: #f0f4f6 !important; border: 1px solid var(--line) !important; cursor: pointer; transition: background .15s; }
.btn-logout:hover { background: #e2ebef !important; }
.avatar { width: 32px; height: 32px; display: grid; place-items: center; border-radius: 50%; background: var(--teal); color: #fff; font-size: 11px; font-weight: 800; cursor: pointer; }
.mobile-nav, .scrim { display: none; }
@media (max-width: 880px) {
  .app-layout { grid-template-columns: 1fr; }
  .app-sidebar { position: fixed; left: 0; top: 0; bottom: 0; transform: translateX(-105%); width: 270px; transition: transform .22s ease; box-shadow: 18px 0 50px rgba(0,0,0,.2); }
  .app-sidebar.open { transform: translateX(0); }
  .close-menu { display: block; }
  .scrim { display: block; position: fixed; inset: 0; z-index: 20; border: 0; background: rgba(10,28,36,.55); }
  .topbar { height: 60px; padding: 0 16px; }
  .menu-button { display: block; }
  .top-search { width: auto; flex: 1; margin: 0 12px; }
  .top-search kbd { display: none; }
  .mobile-nav { position: fixed; left: 0; right: 0; bottom: 0; z-index: 15; display: grid; grid-template-columns: repeat(5,1fr); padding: 7px 5px max(7px,env(safe-area-inset-bottom)); border-top: 1px solid var(--line); background: rgba(255,255,255,.97); box-shadow: 0 -8px 30px rgba(16,41,54,.07); }
  .mobile-nav a { display: grid; place-items: center; gap: 2px; padding: 3px; color: #70848e; font-size: 9px; text-decoration: none; }
  .mobile-nav a span { font-size: 16px; }
  .mobile-nav a.active { color: var(--teal); font-weight: 800; }
}
@media (max-width: 520px) {
  .top-search span { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
  .top-actions button:not(.btn-logout) { display: none; }
}
`
})
export class AppShell {
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly drawer = signal(false);

  readonly userInitials = computed(() => {
    const name = this.auth.fullName();
    if (!name) return 'AJ';
    const parts = name.trim().split(/\s+/);
    return parts.length >= 2
      ? (parts[0][0] + parts[1][0]).toUpperCase()
      : name.substring(0, 2).toUpperCase();
  });

  readonly navigation = [
    {
      title: 'Operate',
      items: [
        { label: 'Overview', path: '/app/overview', icon: '⌂' },
        { label: 'Customers', path: '/app/customers', icon: '◎' },
        { label: 'Jobs', path: '/app/jobs', icon: '▣', count: '6' },
        { label: 'Schedule', path: '/app/schedule', icon: '□' }
      ]
    },
    {
      title: 'Money',
      items: [
        { label: 'Estimates', path: '/app/estimates', icon: '≋' },
        { label: 'Invoices', path: '/app/invoices', icon: '＄', count: '3' },
        { label: 'Services & parts', path: '/app/catalog', icon: '◇' },
        { label: 'Reports', path: '/app/reports', icon: '↗' }
      ]
    },
    {
      title: 'Manage',
      items: [
        { label: 'Team & permissions', path: '/app/team', icon: '♙' },
        { label: 'Subscription', path: '/app/subscription', icon: '☆' },
        { label: 'Business settings', path: '/app/settings', icon: '⚙' },
        { label: 'Platform admin', path: '/app/admin', icon: '⌘' }
      ]
    }
  ];

  readonly mobileNavigation = [
    { label: 'Home', path: '/app/overview', icon: '⌂' },
    { label: 'Jobs', path: '/app/jobs', icon: '▣' },
    { label: 'New job', path: '/app/jobs/new', icon: '＋' },
    { label: 'Customers', path: '/app/customers', icon: '◎' },
    { label: 'More', path: '/app/settings', icon: '•••' }
  ];

  open() { this.drawer.set(true); }
  close() { this.drawer.set(false); }

  logout() {
    this.auth.logout();
    void this.router.navigate(['/login']);
  }
}
