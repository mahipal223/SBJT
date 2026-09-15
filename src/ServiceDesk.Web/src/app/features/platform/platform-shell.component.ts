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
:host { display: block; min-height: 100vh; background: #0f172a; color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
.shell-layout { min-height: 100vh; display: grid; grid-template-columns: 270px minmax(0, 1fr); }
.sidebar { position: sticky; top: 0; height: 100vh; background: #1e293b; border-right: 1px solid #334155; display: flex; flex-direction: column; padding: 1.25rem 1rem; overflow-y: auto; }
.brand-row { display: flex; align-items: center; justify-content: space-between; padding-bottom: 1rem; border-bottom: 1px solid #334155; }
.brand { display: flex; align-items: center; gap: 0.75rem; }
.brand-badge { font-size: 1.5rem; }
.brand-text strong { display: block; font-size: 0.95rem; font-weight: 700; color: #f8fafc; }
.brand-text small { font-size: 0.75rem; color: #818cf8; text-transform: uppercase; font-weight: 700; }
.close-btn { display: none; background: transparent; border: 0; color: #94a3b8; font-size: 1.5rem; cursor: pointer; }
.operator-card { margin: 1rem 0; padding: 0.85rem; border-radius: 8px; background: #0f172a; border: 1px solid #334155; display: flex; align-items: center; gap: 0.75rem; }
.op-avatar { width: 38px; height: 38px; border-radius: 8px; background: #6366f1; color: #fff; font-size: 0.85rem; font-weight: 800; display: grid; place-items: center; }
.op-meta { min-width: 0; display: flex; flex-direction: column; gap: 0.15rem; }
.op-meta strong { font-size: 0.85rem; color: #f8fafc; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.op-email { font-size: 0.75rem; color: #94a3b8; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.role-badge { display: inline-block; font-size: 0.7rem; font-weight: 700; padding: 0.15rem 0.5rem; border-radius: 4px; background: #334155; color: #cbd5e1; align-self: flex-start; margin-top: 0.2rem; }
.role-badge.super { background: rgba(99, 102, 241, 0.25); color: #a5b4fc; border: 1px solid #6366f1; }
.dev-switcher { margin-bottom: 1rem; padding: 0.75rem; border-radius: 8px; background: #182234; border: 1px dashed #475569; }
.dev-title { font-size: 0.7rem; font-weight: 700; text-transform: uppercase; color: #818cf8; margin: 0 0 0.5rem; letter-spacing: 0.05em; }
.dev-buttons { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.35rem; }
.btn-dev-role { padding: 0.35rem 0.25rem; font-size: 0.7rem; font-weight: 700; border-radius: 5px; border: 1px solid #334155; background: #0f172a; color: #94a3b8; cursor: pointer; transition: all 0.15s; text-align: center; }
.btn-dev-role.active { background: #6366f1; color: #fff; border-color: #6366f1; }
.nav-tree { display: flex; flex-direction: column; gap: 0.25rem; flex: 1; margin: 0.5rem 0; }
.nav-section { font-size: 0.75rem; font-weight: 700; text-transform: uppercase; color: #64748b; margin: 0.5rem 0.5rem 0.25rem; letter-spacing: 0.05em; }
.nav-tree a { display: flex; align-items: center; gap: 0.75rem; padding: 0.65rem 0.85rem; border-radius: 8px; font-size: 0.875rem; font-weight: 600; color: #94a3b8; text-decoration: none; transition: all 0.15s; }
.nav-tree a:hover { color: #f8fafc; background: #334155; }
.nav-tree a.active { color: #fff; background: #312e81; border: 1px solid #6366f1; }
.nav-icon { font-size: 1rem; }
.sidebar-footer { margin-top: auto; padding-top: 1rem; border-top: 1px solid #334155; display: flex; flex-direction: column; gap: 0.5rem; }
.btn-tenant-exit { width: 100%; padding: 0.6rem; border-radius: 6px; background: #0f172a; border: 1px solid #334155; color: #cbd5e1; font-size: 0.8rem; font-weight: 600; cursor: pointer; transition: background 0.15s; }
.btn-tenant-exit:hover { background: #1e293b; color: #fff; }
.btn-signout { width: 100%; padding: 0.6rem; border-radius: 6px; background: transparent; border: 1px solid #475569; color: #f87171; font-size: 0.8rem; font-weight: 600; cursor: pointer; transition: background 0.15s; }
.btn-signout:hover { background: rgba(239, 68, 68, 0.15); border-color: #ef4444; }
.main-content { min-width: 0; display: flex; flex-direction: column; }
.topbar { height: 60px; border-bottom: 1px solid #334155; background: #1e293b; padding: 0 1.75rem; display: flex; align-items: center; justify-content: space-between; }
.mobile-menu-btn { display: none; background: transparent; border: 0; color: #f8fafc; font-size: 1.4rem; cursor: pointer; }
.topbar-title { font-size: 0.9rem; font-weight: 600; color: #cbd5e1; display: flex; align-items: center; gap: 0.5rem; }
.indicator { color: #22c55e; font-size: 0.8rem; }
.topbar-actions { display: flex; align-items: center; gap: 0.75rem; }
.role-pill { font-size: 0.75rem; font-weight: 700; padding: 0.2rem 0.6rem; border-radius: 12px; background: #0f172a; color: #818cf8; border: 1px solid #334155; }
.btn-top-exit { padding: 0.35rem 0.75rem; border-radius: 5px; background: #334155; border: 0; color: #cbd5e1; font-size: 0.8rem; font-weight: 600; cursor: pointer; }
.btn-top-signout { padding: 0.35rem 0.75rem; border-radius: 5px; background: rgba(239, 68, 68, 0.15); border: 1px solid #ef4444; color: #fca5a5; font-size: 0.8rem; font-weight: 600; cursor: pointer; }
.content-body { padding: 1.75rem; max-width: 1400px; width: 100%; box-sizing: border-box; }
.scrim { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 30; border: 0; }
@media (max-width: 880px) {
  .shell-layout { grid-template-columns: 1fr; }
  .sidebar { position: fixed; left: 0; top: 0; bottom: 0; width: 280px; z-index: 40; transform: translateX(-105%); transition: transform 0.25s ease; box-shadow: 20px 0 30px rgba(0,0,0,0.5); }
  .sidebar.open { transform: translateX(0); }
  .close-btn { display: block; }
  .scrim { display: block; }
  .mobile-menu-btn { display: block; }
  .topbar { padding: 0 1rem; }
  .content-body { padding: 1rem; }
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
