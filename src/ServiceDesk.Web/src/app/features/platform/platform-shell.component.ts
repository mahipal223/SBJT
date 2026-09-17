import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { PlatformContextService } from '../../core/platform-context.service';

@Component({
  selector: 'app-platform-shell',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  template: `
<div class="shell-layout">
  @if (drawerOpen()) {
    <button class="scrim" aria-label="Close menu" (click)="drawerOpen.set(false)"></button>
  }

  <!-- Sidebar -->
  <aside class="sidebar" [class.open]="drawerOpen()">
    <div class="brand-row">
      <div class="brand">
        <span class="brand-badge">🛡️</span>
        <div class="brand-text">
          <strong>Platform Operations</strong>
          <small>Control Plane</small>
        </div>
      </div>
      <button class="close-btn" (click)="drawerOpen.set(false)">×</button>
    </div>

    <div class="operator-card">
      <div class="op-avatar">
        {{ operatorInitials() }}
      </div>
      <div class="op-meta">
        <strong>{{ platformContext.fullName() || 'Platform Operator' }}</strong>
        <span class="op-email">{{ platformContext.email() }}</span>
        <span class="role-badge" [class.super]="platformContext.role() === 'OperationsAdmin'">
          {{ platformContext.role() === 'OperationsAdmin' ? 'Superadmin (Ops)' : platformContext.role() }}
        </span>
      </div>
    </div>

    <!-- Quick dev role switcher (development testing) -->
    <div class="dev-switcher">
      <p class="dev-title">Dev Role Switcher:</p>
      <div class="dev-buttons">
        <button
          type="button"
          class="btn-dev-role"
          [class.active]="platformContext.role() === 'OperationsAdmin'"
          (click)="switchRole('99999999-9999-9999-9999-999999999999')">
          SuperAdmin
        </button>
        <button
          type="button"
          class="btn-dev-role"
          [class.active]="platformContext.role() === 'BillingAdmin'"
          (click)="switchRole('77777777-7777-7777-7777-777777777777')">
          Billing
        </button>
        <button
          type="button"
          class="btn-dev-role"
          [class.active]="platformContext.role() === 'Support'"
          (click)="switchRole('88888888-8888-8888-8888-888888888888')">
          Support
        </button>
      </div>
    </div>

    <!-- Navigation -->
    <nav class="nav-tree">
      <p class="nav-section">Operations</p>

      @if (platformContext.canViewMetrics()) {
        <a routerLink="/platform-admin/overview" routerLinkActive="active" (click)="drawerOpen.set(false)">
          <span class="nav-icon">📊</span> Overview & Telemetry
        </a>
      }

      @if (platformContext.canViewWorkspaces()) {
        <a routerLink="/platform-admin/workspaces" routerLinkActive="active" (click)="drawerOpen.set(false)">
          <span class="nav-icon">🏢</span> Tenant Workspaces
        </a>
      }

      @if (platformContext.canViewPlans()) {
        <a routerLink="/platform-admin/plans" routerLinkActive="active" (click)="drawerOpen.set(false)">
          <span class="nav-icon">💳</span> Plans & Entitlements
        </a>
      }

      @if (platformContext.canViewBackups()) {
        <a routerLink="/platform-admin/backups" routerLinkActive="active" (click)="drawerOpen.set(false)">
          <span class="nav-icon">🛡️</span> Backups & DR
        </a>
      }

      @if (platformContext.canViewAudit()) {
        <a routerLink="/platform-admin/audit" routerLinkActive="active" (click)="drawerOpen.set(false)">
          <span class="nav-icon">📋</span> Platform Audit Log
        </a>
      }
    </nav>

    <!-- Footer actions -->
    <div class="sidebar-footer">
      <button type="button" class="btn-tenant-exit" (click)="exitToTenant()">
        ↗ Exit to Business App
      </button>
      <button type="button" class="btn-signout" (click)="signout()">
        Sign Out Operator
      </button>
    </div>
  </aside>

  <!-- Main Content Shell -->
  <main class="main-content">
    <header class="topbar">
      <button class="mobile-menu-btn" (click)="drawerOpen.set(true)">☰</button>
      <div class="topbar-title">
        <span class="indicator">●</span> Platform Operations Console
      </div>
      <div class="topbar-actions">
        <span class="role-pill">{{ platformContext.role() }}</span>
        <button type="button" class="btn-top-exit" (click)="exitToTenant()">Exit</button>
        <button type="button" class="btn-top-signout" (click)="signout()">Sign Out</button>
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
.shell-layout { min-height: 100vh; display: grid; grid-template-columns: 248px minmax(0, 1fr); }
.sidebar { position: sticky; top: 0; height: 100vh; background: var(--navy); border-right: 1px solid #1c4653; display: flex; flex-direction: column; padding: 20px 14px; overflow-y: auto; scrollbar-width: thin; scrollbar-color: #274d5d transparent; color: #e9f0f3; }
.sidebar::-webkit-scrollbar { width: 6px; }
.sidebar::-webkit-scrollbar-track { background: transparent; }
.sidebar::-webkit-scrollbar-thumb { background: #274d5d; border-radius: 3px; }
.brand-row { display: flex; align-items: center; justify-content: space-between; padding: 0 6px 16px; border-bottom: 1px solid #204554; }
.brand { display: flex; align-items: center; gap: 10px; }
.brand-badge { width: 32px; height: 32px; display: grid; place-items: center; border-radius: 8px; background: #65d0c5; color: var(--navy); font-size: 16px; font-weight: 800; }
.brand-text strong { display: block; font-size: 14px; font-weight: 800; color: #fff; font-family: 'Manrope', sans-serif; }
.brand-text small { font-size: 10px; color: #65d0c5; text-transform: uppercase; font-weight: 800; letter-spacing: .05em; }
.close-btn { display: none; background: transparent; border: 0; color: #aac0c9; font-size: 24px; cursor: pointer; }
.operator-card { margin: 16px 0 12px; padding: 10px 12px; border-radius: 10px; background: #173846; border: 1px solid #31505d; display: flex; align-items: center; gap: 10px; }
.op-avatar { width: 34px; height: 34px; border-radius: 8px; background: var(--teal); color: #fff; font-size: 11px; font-weight: 800; display: grid; place-items: center; flex-shrink: 0; }
.op-meta { min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.op-meta strong { font-size: 12px; color: #fff; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.op-email { font-size: 10px; color: #aac0c9; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.role-badge { display: inline-block; font-size: 9px; font-weight: 700; padding: 2px 6px; border-radius: 4px; background: #224b5a; color: #9edbd4; align-self: flex-start; margin-top: 2px; }
.role-badge.super { background: rgba(101, 208, 197, 0.2); color: #65d0c5; border: 1px solid rgba(101, 208, 197, 0.4); }
.dev-switcher { margin-bottom: 14px; padding: 10px; border-radius: 8px; background: #14323e; border: 1px dashed #31505d; }
.dev-title { font-size: 9px; font-weight: 800; text-transform: uppercase; color: #78939e; margin: 0 0 6px; letter-spacing: .1em; }
.dev-buttons { display: grid; grid-template-columns: repeat(3, 1fr); gap: 5px; }
.btn-dev-role { padding: 4px 2px; font-size: 10px; font-weight: 700; border-radius: 5px; border: 1px solid #31505d; background: #1b3d4b; color: #aac0c9; cursor: pointer; transition: all 0.15s; text-align: center; }
.btn-dev-role:hover { background: #234f62; color: #fff; }
.btn-dev-role.active { background: var(--teal); color: #fff; border-color: var(--teal); }
.nav-tree { display: flex; flex-direction: column; gap: 4px; flex: 1; margin: 6px 0; }
.nav-section { margin: 12px 8px 4px; color: #78939e; font-size: 9px; font-weight: 800; letter-spacing: .13em; text-transform: uppercase; }
.nav-tree a { position: relative; display: flex; align-items: center; gap: 11px; padding: 9px 12px; border-radius: 8px; font-size: 13px; font-weight: 600; color: #c9d7dd; text-decoration: none; transition: all 0.15s; }
.nav-tree a:hover { color: #fff; background: #1c4653; }
.nav-tree a.active { color: #fff; background: #1c4653; }
.nav-tree a.active::before { content: ''; position: absolute; left: -14px; width: 3px; height: 22px; border-radius: 0 4px 4px 0; background: #59c7bc; }
.nav-icon { width: 18px; text-align: center; font-size: 14px; }
.sidebar-footer { margin-top: auto; padding-top: 14px; border-top: 1px solid #204554; display: flex; flex-direction: column; gap: 8px; }
.btn-tenant-exit { width: 100%; padding: 8px 10px; border-radius: 6px; background: #173846; border: 1px solid #31505d; color: #c9d7dd; font-size: 11px; font-weight: 700; cursor: pointer; transition: background 0.15s, color 0.15s; }
.btn-tenant-exit:hover { background: #1c4653; color: #fff; border-color: #4a7587; }
.btn-signout { width: 100%; padding: 8px 10px; border-radius: 6px; background: transparent; border: 1px solid #5a3030; color: #e57373; font-size: 11px; font-weight: 700; cursor: pointer; transition: background 0.15s; }
.btn-signout:hover { background: rgba(177, 75, 69, 0.2); border-color: #b14b45; color: #ff8a80; }
.main-content { min-width: 0; display: flex; flex-direction: column; background: var(--bg); }
.topbar { height: 66px; border-bottom: 1px solid var(--line); background: #fff; padding: 0 32px; display: flex; align-items: center; justify-content: space-between; }
.mobile-menu-btn { display: none; background: transparent; border: 0; color: var(--ink); font-size: 20px; cursor: pointer; }
.topbar-title { font-size: 14px; font-weight: 700; color: var(--ink); display: flex; align-items: center; gap: 8px; font-family: 'Manrope', sans-serif; }
.indicator { color: var(--teal); font-size: 12px; }
.topbar-actions { display: flex; align-items: center; gap: 10px; }
.role-pill { font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 12px; background: var(--teal-tint); color: var(--teal-dark); border: 1px solid #b7e8de; }
.btn-top-exit { height: 34px; padding: 0 12px; border-radius: 6px; background: #f0f4f6; border: 1px solid var(--line); color: var(--navy); font-size: 12px; font-weight: 600; cursor: pointer; transition: background 0.15s; }
.btn-top-exit:hover { background: #e2ebef; }
.btn-top-signout { height: 34px; padding: 0 12px; border-radius: 6px; background: #fff; border: 1px solid #fed2d2; color: var(--red); font-size: 12px; font-weight: 600; cursor: pointer; transition: background 0.15s; }
.btn-top-signout:hover { background: var(--red-bg); }
.content-body { padding: 32px; width: 100%; box-sizing: border-box; }
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
  private readonly router = inject(Router);

  readonly drawerOpen = signal(false);

  operatorInitials(): string {
    const name = this.platformContext.fullName();
    if (!name) return 'PO';
    const parts = name.trim().split(/\s+/);
    return parts.length >= 2
      ? (parts[0][0] + parts[1][0]).toUpperCase()
      : name.substring(0, 2).toUpperCase();
  }

  async switchRole(adminId: string): Promise<void> {
    await this.platformContext.switchDevRole(adminId);
    // Route to first permitted section
    if (this.platformContext.canViewMetrics()) {
      void this.router.navigate(['/platform-admin/overview']);
    } else if (this.platformContext.canViewWorkspaces()) {
      void this.router.navigate(['/platform-admin/workspaces']);
    }
  }

  exitToTenant(): void {
    this.platformContext.exitToTenant();
  }

  signout(): void {
    this.platformContext.logout();
  }
}
