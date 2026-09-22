import { Component, computed, ElementRef, HostListener, inject, OnInit, signal, ViewChild } from '@angular/core';
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
      <button class="close-menu" aria-label="Close menu" (click)="close(true)">×</button>
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
            <span class="nav-icon">{{ item.icon }}</span>{{ item.label }}
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
  <section class="app-content">
    <header class="topbar">
      <button #menuButton class="menu-button" (click)="open()" aria-label="Open menu"
              aria-controls="workspace-navigation" [attr.aria-expanded]="drawer()">☰</button>
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
  <nav class="bottom-nav" aria-label="Mobile navigation">
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
:host { display: block; min-height: 100vh; width: 100%; max-width: 100vw; overflow-x: hidden; }
.app-layout { min-height: 100vh; display: grid; grid-template-columns: 248px minmax(0, 1fr); width: 100%; max-width: 100vw; overflow-x: hidden; }
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
.app-content { min-width: 0; max-width: 100%; width: 100%; overflow-x: hidden; }
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
.bottom-nav, .scrim { display: none; }
@media (max-width: 880px) {
  .app-layout { grid-template-columns: 1fr; }
  .app-sidebar { position: fixed; left: 0; top: 0; bottom: 0; transform: translateX(-105%); width: 270px; transition: transform .22s ease; box-shadow: 18px 0 50px rgba(0,0,0,.2); }
  .app-sidebar.open { transform: translateX(0); }
  .close-menu { display: block; }
  .scrim { display: block; position: fixed; inset: 0; z-index: 35; border: 0; background: rgba(10,28,36,.55); }
  .topbar { height: 60px; padding: 0 16px; }
  .menu-button { display: block; }
  .top-search { width: auto; flex: 1; margin: 0 12px; }
  .top-search kbd { display: none; }
  .bottom-nav { position: fixed; bottom: 0; left: 0; right: 0; z-index: 30; display: grid; grid-template-columns: repeat(5, 1fr); background: #fffffff5; backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border-top: 1px solid #dbe5e3; padding: 7px 8px max(9px, env(safe-area-inset-bottom)); box-shadow: 0 -4px 24px rgba(24, 54, 44, 0.05); }
  .bottom-nav a, .bottom-nav button { border: 0 !important; background: transparent !important; background-color: transparent !important; color: var(--muted) !important; display: flex !important; flex-direction: column !important; align-items: center !important; justify-content: center !important; gap: 4px !important; font-size: 9px !important; min-height: 46px !important; text-decoration: none !important; cursor: pointer !important; padding: 0 !important; border-radius: 0 !important; position: static !important; transition: color .15s ease !important; box-shadow: none !important; outline: none !important; }
  .bottom-nav a:hover, .bottom-nav button:hover, .bottom-nav a.active, .bottom-nav button.active { background: transparent !important; background-color: transparent !important; box-shadow: none !important; }
  .bottom-nav a::before, .bottom-nav a::after, .bottom-nav button::before, .bottom-nav button::after { display: none !important; content: none !important; }
  .bottom-nav svg { width: 19px; height: 19px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
  .bottom-nav a.active, .bottom-nav .active { background: transparent !important; background-color: transparent !important; color: var(--teal) !important; font-weight: 700 !important; }
  .bottom-nav a.active svg, .bottom-nav .active svg { color: var(--teal) !important; stroke: var(--teal) !important; }
  .bottom-nav .create { background: transparent !important; background-color: transparent !important; }
  .bottom-nav .create svg { width: 30px !important; height: 30px !important; padding: 5px !important; border-radius: 9px !important; background: var(--teal) !important; color: #fff !important; stroke: #fff !important; stroke-width: 2.4 !important; }
}
@media (max-width: 520px) {
  .top-search span { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
  .top-actions button { display: none; }
  .btn-logout { display: none !important; }
}
`
})
export class AppShell implements OnInit {
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly http = inject(HttpClient);

  @ViewChild('menuButton') private menuButton?: ElementRef<HTMLButtonElement>;

  readonly drawer = signal(false);
  readonly workspace = signal<WorkspaceContext | null>(null);

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
        { label: 'Overview', path: '/app/overview', icon: '⌂' },
        { label: 'Customers', path: '/app/customers', icon: '◎' },
        { label: 'Jobs', path: '/app/jobs', icon: '▣' },
        { label: 'Schedule', path: '/app/schedule', icon: '□' }
      ]
    },
    {
      title: 'Money',
      items: [
        { label: 'Estimates', path: '/app/estimates', icon: '≋' },
        { label: 'Invoices', path: '/app/invoices', icon: '＄' },
        { label: 'Services & parts', path: '/app/catalog', icon: '◇' },
        { label: 'Reports', path: '/app/reports', icon: '↗' }
      ]
    },
    {
      title: 'Manage',
      items: [
        { label: 'Team & permissions', path: '/app/team', icon: '♙' },
        { label: 'Subscription', path: '/app/subscription', icon: '☆' },
        { label: 'Business settings', path: '/app/settings', icon: '⚙' }
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

  open() { this.drawer.set(true); }
  close(returnFocus = false) {
    this.drawer.set(false);
    if (returnFocus) {
      queueMicrotask(() => this.menuButton?.nativeElement.focus());
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
