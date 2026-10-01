import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { PlatformContextService } from '../../core/platform-context.service';

@Component({
  selector: 'app-platform-shell',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, RouterOutlet],
  template: `
<div class="shell-layout">
  <!-- Backdrop for mobile drawer -->
  @if (drawerOpen()) {
    <div class="scrim" (click)="drawerOpen.set(false)"></div>
  }

  <!-- Sidebar -->
  <aside class="sidebar" [class.open]="drawerOpen()">
    <!-- Brand / Control Plane Tag -->
    <div class="brand-row">
      <div class="brand">
        <div class="brand-badge">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
        </div>
        <div class="brand-text">
          <strong>Platform Control</strong>
          <small>Administration</small>
        </div>
      </div>
      <button class="close-btn" (click)="drawerOpen.set(false)">×</button>
    </div>

    <!-- Navigation -->
    <nav class="nav-tree">
      <p class="nav-section">Management</p>

      @if (platformContext.canViewMetrics()) {
        <a routerLink="/platform-admin/overview" routerLinkActive="active" (click)="drawerOpen.set(false)">
          <svg class="nav-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
          </svg>
          Overview & Telemetry
        </a>
      }

      @if (platformContext.canViewWorkspaces()) {
        <a routerLink="/platform-admin/workspaces" routerLinkActive="active" (click)="drawerOpen.set(false)">
          <svg class="nav-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18M15 3v18M3 9h18M3 15h18"/>
          </svg>
          Tenant Workspaces
        </a>
      }

      @if (platformContext.canViewPlans()) {
        <a routerLink="/platform-admin/plans" routerLinkActive="active" (click)="drawerOpen.set(false)">
          <svg class="nav-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>
          </svg>
          Plans & Entitlements
        </a>
      }

      @if (platformContext.canViewUsers()) {
        <a routerLink="/platform-admin/users" routerLinkActive="active" (click)="drawerOpen.set(false)">
          <svg class="nav-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
          Platform Users
        </a>
      }

      @if (platformContext.canViewBackups()) {
        <a routerLink="/platform-admin/backups" routerLinkActive="active" (click)="drawerOpen.set(false)">
          <svg class="nav-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
          Backups & DR
        </a>
      }

      @if (platformContext.canViewAudit()) {
        <a routerLink="/platform-admin/audit" routerLinkActive="active" (click)="drawerOpen.set(false)">
          <svg class="nav-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
          </svg>
          Platform Audit Log
        </a>
      }

      @if (platformContext.canManageSmtp()) {
        <a routerLink="/platform-admin/smtp" routerLinkActive="active" (click)="drawerOpen.set(false)">
          <svg class="nav-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
          </svg>
          Platform SMTP
        </a>
      }

      @if (platformContext.canViewSecurity()) {
        <a routerLink="/platform-admin/security" routerLinkActive="active" (click)="drawerOpen.set(false)">
          <svg class="nav-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
          Security & Policy
        </a>
      }
    </nav>

    <!-- Footer actions -->
    <div class="sidebar-footer">
      <button type="button" class="btn-signout" (click)="signout()">
        Sign Out
      </button>
    </div>
  </aside>

  <!-- Main Content Shell -->
  <main class="main-content">
    <header class="topbar">
      <button class="mobile-menu-btn" (click)="drawerOpen.set(true)">☰</button>
      <div class="topbar-title">
        <span class="indicator">●</span> Platform Console
      </div>
      <div class="topbar-actions">
        <span class="user-greeting">{{ userName() }}</span>
        <button type="button" class="btn-top-signout" (click)="signout()">
          Sign Out
        </button>
      </div>
    </header>

    <div class="content-body">
      <router-outlet />
    </div>
  </main>
</div>
  `,
  styles: `
:host { display: block; min-height: 100vh; background: var(--bg); color: var(--ink); font-family: 'DM Sans', system-ui, sans-serif; }
.shell-layout { min-height: 100vh; display: grid; grid-template-columns: 240px minmax(0, 1fr); }
.sidebar { position: sticky; top: 0; height: 100vh; background: var(--navy); border-right: 1px solid #1c4653; display: flex; flex-direction: column; padding: 20px 14px; overflow-y: auto; scrollbar-width: thin; scrollbar-color: #274d5d transparent; color: #e9f0f3; }
.sidebar::-webkit-scrollbar { width: 6px; }
.sidebar::-webkit-scrollbar-track { background: transparent; }
.sidebar::-webkit-scrollbar-thumb { background: #274d5d; border-radius: 3px; }
.brand-row { display: flex; align-items: center; justify-content: space-between; padding: 0 6px 16px; border-bottom: 1px solid #204554; }
.brand { display: flex; align-items: center; gap: 10px; }
.brand-badge { width: 32px; height: 32px; display: grid; place-items: center; border-radius: 5px; background: #65d0c5; color: var(--navy); }
.brand-text strong { display: block; font-size: 14px; font-weight: 800; color: #fff; font-family: 'Manrope', sans-serif; }
.brand-text small { font-size: 10px; color: #65d0c5; text-transform: uppercase; font-weight: 800; letter-spacing: .05em; }
.close-btn { display: none; background: transparent; border: 0; color: #aac0c9; font-size: 24px; cursor: pointer; }
.nav-tree { display: flex; flex-direction: column; gap: 4px; flex: 1; margin: 14px 0; }
.nav-section { margin: 12px 8px 4px; color: #78939e; font-size: 9px; font-weight: 800; letter-spacing: .13em; text-transform: uppercase; }
.nav-tree a { position: relative; display: flex; align-items: center; gap: 11px; padding: 9px 12px; border-radius: 5px; font-size: 13px; font-weight: 600; color: #c9d7dd; text-decoration: none; transition: all 0.15s; }
.nav-tree a:hover { color: #fff; background: #1c4653; }
.nav-tree a.active { color: #fff; background: #1c4653; }
.nav-tree a.active::before { content: ''; position: absolute; left: -14px; width: 3px; height: 22px; border-radius: 0 5px 5px 0; background: #59c7bc; }
.nav-icon { width: 16px; height: 16px; flex-shrink: 0; color: #8cb5c2; }
.nav-tree a.active .nav-icon { color: #59c7bc; }
.sidebar-footer { margin-top: auto; padding-top: 14px; border-top: 1px solid #204554; }
.btn-signout { width: 100%; padding: 8px 10px; border-radius: 5px; background: transparent; border: 1px solid #5a3030; color: #e57373; font-size: 11px; font-weight: 700; cursor: pointer; transition: background 0.15s; }
.btn-signout:hover { background: rgba(177, 75, 69, 0.2); border-color: #b14b45; color: #ff8a80; }
.main-content { min-width: 0; display: flex; flex-direction: column; background: var(--bg); }
.topbar { height: 60px; border-bottom: 1px solid var(--line); background: #fff; padding: 0 28px; display: flex; align-items: center; justify-content: space-between; }
.mobile-menu-btn { display: none; background: transparent; border: 0; color: var(--ink); font-size: 20px; cursor: pointer; }
.topbar-title { font-size: 14px; font-weight: 700; color: var(--ink); display: flex; align-items: center; gap: 8px; font-family: 'Manrope', sans-serif; }
.indicator { color: var(--teal); font-size: 12px; }
.topbar-actions { display: flex; align-items: center; gap: 12px; }
.user-greeting { font-size: 13px; font-weight: 700; color: var(--navy); padding: 4px 10px; background: var(--teal-tint); border: 1px solid #b7e8de; border-radius: 5px; font-family: 'Manrope', sans-serif; }
.btn-top-signout { height: 34px; padding: 0 14px; border-radius: 5px; background: #fff; border: 1px solid #fed2d2; color: var(--red); font-size: 12px; font-weight: 600; cursor: pointer; transition: background 0.15s; }
.btn-top-signout:hover { background: var(--red-bg); }
.content-body { padding: 28px; width: 100%; box-sizing: border-box; }
.scrim { display: none; position: fixed; inset: 0; background: rgba(10,28,36,.55); z-index: 30; border: 0; }
@media (max-width: 880px) {
  .shell-layout { grid-template-columns: 1fr; }
  .sidebar { position: fixed; left: 0; top: 0; bottom: 0; width: 270px; z-index: 40; transform: translateX(-105%); transition: transform 0.22s ease; box-shadow: 18px 0 50px rgba(0,0,0,.2); }
  .sidebar.open { transform: translateX(0); }
  .close-btn { display: block; }
  .scrim { display: block; }
  .mobile-menu-btn { display: block; }
  .topbar { padding: 0 16px; height: 58px; }
  .content-body { padding: 16px; }
}
  `
})
export class PlatformShellComponent {
  readonly platformContext = inject(PlatformContextService);

  readonly drawerOpen = signal(false);

  userName(): string {
    const name = this.platformContext.fullName();
    if (name && name.trim()) {
      if (name.toLowerCase().includes('superadmin') || name.toLowerCase().includes('operator') || name.toLowerCase().includes('platform user')) {
        return 'Mahipal';
      }
      return name.trim();
    }
    const email = this.platformContext.email();
    if (email) return email.split('@')[0];
    return 'Mahipal';
  }

  signout(): void {
    this.platformContext.logout();
  }
}
