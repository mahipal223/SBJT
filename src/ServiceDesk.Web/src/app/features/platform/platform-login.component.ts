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
:host { display: block; min-height: 100vh; background: var(--bg); color: var(--ink); font-family: 'DM Sans', system-ui, sans-serif; }
.login-wrapper { min-height: 100vh; display: grid; place-items: center; padding: 2rem 1rem; }
.login-card { width: 100%; max-width: 480px; background: #fff; border: 1px solid var(--line); border-radius: 16px; padding: 2.5rem 2rem; box-shadow: var(--shadow); }
.header { text-align: center; margin-bottom: 2rem; }
.badge-icon { width: 48px; height: 48px; margin: 0 auto 0.75rem; display: grid; place-items: center; border-radius: 12px; background: var(--teal-tint); font-size: 1.6rem; border: 1px solid #b7e8de; }
h1 { font-size: 1.5rem; font-weight: 800; color: var(--ink); margin: 0 0 0.5rem; font-family: 'Manrope', sans-serif; }
.subtitle { font-size: 0.875rem; color: var(--muted); line-height: 1.4; margin: 0; }
.alert { padding: 0.85rem 1rem; border-radius: 8px; font-size: 0.875rem; margin-bottom: 1.5rem; }
.alert.error { background: var(--red-bg); border: 1px solid #fed2d2; color: var(--red); }
.roles-section { margin-bottom: 1.5rem; }
.section-label { font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); margin-bottom: 0.75rem; }
.role-btn { width: 100%; display: flex; align-items: center; justify-content: space-between; text-align: left; background: #f8fafb; border: 1.5px solid var(--line); border-radius: 10px; padding: 1rem; margin-bottom: 0.75rem; cursor: pointer; transition: all 0.15s ease; color: inherit; }
.role-btn:hover { border-color: var(--teal); background: #f0f7f6; }
.role-btn.selected { border-color: var(--teal); background: var(--teal-tint); outline: 2px solid rgba(8, 127, 116, 0.25); }
.role-meta { display: flex; flex-direction: column; gap: 0.25rem; }
.role-name { font-size: 0.925rem; font-weight: 700; color: var(--ink); }
.role-desc { font-size: 0.775rem; color: var(--muted); }
.role-tag { font-size: 0.7rem; font-weight: 700; padding: 0.2rem 0.6rem; border-radius: 6px; background: #e9f0f3; color: var(--navy); }
.role-tag.super { background: #ccebe5; color: var(--teal-dark); border: 1px solid #65d0c5; }
.submit-btn { width: 100%; height: 46px; border: 0; border-radius: 8px; background: var(--teal); color: #fff; font-size: 0.95rem; font-weight: 700; cursor: pointer; transition: background 0.15s; display: flex; align-items: center; justify-content: center; gap: 0.5rem; }
.submit-btn:hover:not(:disabled) { background: var(--teal-dark); }
.submit-btn:disabled { opacity: 0.6; cursor: not-allowed; }
.spinner { width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.footer-links { margin-top: 1.75rem; text-align: center; }
.back-link { font-size: 0.85rem; color: var(--muted); text-decoration: none; transition: color 0.15s; font-weight: 600; }
.back-link:hover { color: var(--teal); }
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
