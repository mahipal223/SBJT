import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { PlatformContextService } from '../../core/platform-context.service';

@Component({
  selector: 'app-platform-login',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
<div class="login-wrapper">
  <div class="login-card">
    <div class="header">
      <div class="badge-icon">🛡️</div>
      <h1>Platform Operations</h1>
      <p class="subtitle">Restricted administrative control plane for authorized operators only.</p>
    </div>

    @if (error()) {
      <div class="alert error">
        <strong>Access Denied:</strong> {{ error() }}
      </div>
    }

    <div class="roles-section">
      <p class="section-label">Select Development Operator Role:</p>

      <button
        type="button"
        class="role-btn"
        [class.selected]="selectedRole() === 'OperationsAdmin'"
        (click)="selectRole('99999999-9999-9999-9999-999999999999', 'OperationsAdmin')">
        <div class="role-meta">
          <span class="role-name">SuperAdmin (OperationsAdmin)</span>
          <span class="role-desc">Full access: Workspaces, Plans, System Metrics, Backups & DR, Audit</span>
        </div>
        <span class="role-tag super">All Access</span>
      </button>

      <button
        type="button"
        class="role-btn"
        [class.selected]="selectedRole() === 'BillingAdmin'"
        (click)="selectRole('77777777-7777-7777-7777-777777777777', 'BillingAdmin')">
        <div class="role-meta">
          <span class="role-name">Billing Administrator</span>
          <span class="role-desc">Access to: Workspaces, Plans & Entitlements</span>
        </div>
        <span class="role-tag">Billing</span>
      </button>

      <button
        type="button"
        class="role-btn"
        [class.selected]="selectedRole() === 'Support'"
        (click)="selectRole('88888888-8888-8888-8888-888888888888', 'Support')">
        <div class="role-meta">
          <span class="role-name">Support Specialist</span>
          <span class="role-desc">Access to: Workspaces summaries (Read-only)</span>
        </div>
        <span class="role-tag">Support</span>
      </button>
    </div>

    <button
      type="button"
      class="submit-btn"
      [disabled]="loading()"
      (click)="login()">
      @if (loading()) {
        <span class="spinner"></span> Connecting…
      } @else {
        Enter Platform Console →
      }
    </button>

    <div class="footer-links">
      <a routerLink="/login" class="back-link">← Return to Tenant Business Login</a>
    </div>
  </div>
</div>
  `,
  styles: `
:host { display: block; min-height: 100vh; background: #0f172a; color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
.login-wrapper { min-height: 100vh; display: grid; place-items: center; padding: 2rem 1rem; }
.login-card { width: 100%; max-width: 480px; background: #1e293b; border: 1px solid #334155; border-radius: 14px; padding: 2.5rem 2rem; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5); }
.header { text-align: center; margin-bottom: 2rem; }
.badge-icon { font-size: 2.2rem; margin-bottom: 0.5rem; }
h1 { font-size: 1.5rem; font-weight: 700; color: #f8fafc; margin: 0 0 0.5rem; }
.subtitle { font-size: 0.875rem; color: #94a3b8; line-height: 1.4; margin: 0; }
.alert { padding: 0.85rem 1rem; border-radius: 8px; font-size: 0.875rem; margin-bottom: 1.5rem; }
.alert.error { background: rgba(239, 68, 68, 0.15); border: 1px solid #ef4444; color: #fca5a5; }
.roles-section { margin-bottom: 1.5rem; }
.section-label { font-size: 0.8rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #94a3b8; margin-bottom: 0.75rem; }
.role-btn { width: 100%; display: flex; align-items: center; justify-content: space-between; text-align: left; background: #0f172a; border: 1.5px solid #334155; border-radius: 10px; padding: 1rem; margin-bottom: 0.75rem; cursor: pointer; transition: all 0.15s ease; color: inherit; }
.role-btn:hover { border-color: #6366f1; background: #182234; }
.role-btn.selected { border-color: #6366f1; background: #1e1b4b; outline: 2px solid #818cf8; }
.role-meta { display: flex; flex-direction: column; gap: 0.25rem; }
.role-name { font-size: 0.925rem; font-weight: 600; color: #f8fafc; }
.role-desc { font-size: 0.775rem; color: #94a3b8; }
.role-tag { font-size: 0.7rem; font-weight: 700; padding: 0.2rem 0.6rem; border-radius: 6px; background: #334155; color: #cbd5e1; }
.role-tag.super { background: rgba(99, 102, 241, 0.25); color: #a5b4fc; border: 1px solid #6366f1; }
.submit-btn { width: 100%; height: 46px; border: 0; border-radius: 8px; background: #6366f1; color: #fff; font-size: 0.95rem; font-weight: 600; cursor: pointer; transition: background 0.15s; display: flex; align-items: center; justify-content: center; gap: 0.5rem; }
.submit-btn:hover:not(:disabled) { background: #4f46e5; }
.submit-btn:disabled { opacity: 0.6; cursor: not-allowed; }
.spinner { width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.footer-links { margin-top: 1.75rem; text-align: center; }
.back-link { font-size: 0.85rem; color: #94a3b8; text-decoration: none; transition: color 0.15s; }
.back-link:hover { color: #f8fafc; }
  `
})
export class PlatformLoginPage {
  private readonly platformContext = inject(PlatformContextService);
  private readonly router = inject(Router);

  readonly selectedAdminId = signal('99999999-9999-9999-9999-999999999999');
  readonly selectedRole = signal('OperationsAdmin');
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  selectRole(id: string, role: string): void {
    this.selectedAdminId.set(id);
    this.selectedRole.set(role);
  }

  async login(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    const success = await this.platformContext.switchDevRole(this.selectedAdminId());
    this.loading.set(false);

    if (success) {
      void this.router.navigate(['/platform-admin/overview']);
    } else {
      this.error.set('Failed to authenticate as platform operator. Verify server configuration.');
    }
  }
}
