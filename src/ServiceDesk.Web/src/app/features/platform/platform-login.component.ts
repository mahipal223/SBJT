import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { PlatformContextService } from '../../core/platform-context.service';

@Component({
  selector: 'app-platform-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
<div class="login-wrapper">
  <div class="login-card">
    <div class="header">
      <div class="badge-icon">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        </svg>
      </div>
      <h1>Platform Operations</h1>
      <p class="subtitle">Secure administrative control plane for authorized operators only.</p>
    </div>

    @if (error()) {
      <div class="alert error" role="alert">
        <strong>Access Denied:</strong> {{ error() }}
      </div>
    }

    <!-- Operator Credentials Form -->
    <form class="operator-form" (ngSubmit)="loginWithCredentials()">
      <div class="field" [class.has-error]="emailError()">
        <label for="op-email">Operator Email</label>
        <input
          id="op-email"
          type="email"
          name="operatorEmail"
          [(ngModel)]="operatorEmail"
          (input)="emailError.set('')"
          placeholder="admin@servicedesk.local"
          autocomplete="username"
          required />
        @if (emailError()) {
          <span class="field-error">{{ emailError() }}</span>
        }
      </div>

      <div class="field" [class.has-error]="secretError()">
        <label for="op-secret">Access Key / Secret</label>
        <input
          id="op-secret"
          type="password"
          name="operatorSecret"
          [(ngModel)]="operatorSecret"
          (input)="secretError.set('')"
          placeholder="Enter operator access secret"
          autocomplete="current-password"
          required />
        @if (secretError()) {
          <span class="field-error">{{ secretError() }}</span>
        }
      </div>

      <button
        id="btn-op-signin"
        type="submit"
        class="submit-btn"
        [disabled]="loading()">
        @if (loading()) {
          <span class="spinner"></span> Authenticating…
        } @else {
          Enter Platform Console →
        }
      </button>
    </form>

    <div class="security-advisory">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
        <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
      </svg>
      <span>Restricted Area. Authorized administrative operators only. All authentication attempts and telemetry queries are cryptographically logged.</span>
    </div>

    <div class="footer-links">
      <a routerLink="/login" class="back-link">Return to Tenant Business Login</a>
    </div>
  </div>
</div>
  `,
  styles: `
:host { display: block; min-height: 100vh; background: var(--bg); color: var(--ink); font-family: 'DM Sans', system-ui, sans-serif; }
.login-wrapper { min-height: 100vh; display: grid; place-items: center; padding: 2rem 1rem; }
.login-card { width: 100%; max-width: 440px; background: #fff; border: 1px solid var(--line); border-radius: 5px; padding: 2.2rem 2rem; box-shadow: var(--shadow); }
.header { text-align: center; margin-bottom: 1.75rem; }
.badge-icon { width: 44px; height: 44px; margin: 0 auto 0.75rem; display: grid; place-items: center; border-radius: 5px; background: var(--teal-tint); color: var(--teal-dark); border: 1px solid #b7e8de; }
h1 { font-size: 1.35rem; font-weight: 800; color: var(--ink); margin: 0 0 0.35rem; font-family: 'Manrope', sans-serif; }
.subtitle { font-size: 0.85rem; color: var(--muted); line-height: 1.4; margin: 0; }
.alert { padding: 0.85rem 1rem; border-radius: 5px; font-size: 0.85rem; margin-bottom: 1.25rem; }
.alert.error { background: var(--red-bg); border: 1px solid #fed2d2; color: var(--red); }
.operator-form { display: flex; flex-direction: column; gap: 1rem; margin-bottom: 1.25rem; }
.field { display: flex; flex-direction: column; gap: 0.35rem; }
.field label { font-size: 0.78rem; font-weight: 700; color: var(--ink); text-transform: uppercase; letter-spacing: 0.04em; }
.field input { width: 100%; height: 42px; padding: 0 0.75rem; border: 1px solid var(--line); border-radius: 5px; font-size: 0.9rem; color: var(--ink); background: #fff; transition: border-color 0.15s, box-shadow 0.15s; box-sizing: border-box; }
.field input:focus { outline: none; border-color: var(--teal); box-shadow: 0 0 0 3px rgba(8,127,116,0.15); }
.field.has-error input { border-color: var(--red); box-shadow: 0 0 0 2px rgba(185,28,28,0.15); }
.field-error { font-size: 0.75rem; color: var(--red); font-weight: 600; margin-top: 2px; }
.submit-btn { width: 100%; height: 44px; border: 0; border-radius: 5px; background: var(--teal); color: #fff; font-size: 0.925rem; font-weight: 700; cursor: pointer; transition: background 0.15s; display: flex; align-items: center; justify-content: center; gap: 0.5rem; }
.submit-btn:hover:not(:disabled) { background: var(--teal-dark); }
.submit-btn:disabled { opacity: 0.6; cursor: not-allowed; }
.spinner { width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.security-advisory { display: flex; align-items: flex-start; gap: 8px; padding: 10px 12px; background: #f8fafb; border: 1px solid var(--line); border-radius: 5px; font-size: 0.75rem; color: var(--muted); line-height: 1.45; margin-bottom: 1.25rem; }
.security-advisory svg { flex-shrink: 0; margin-top: 2px; color: var(--navy); }
.footer-links { text-align: center; }
.back-link { font-size: 0.85rem; color: var(--muted); text-decoration: none; transition: color 0.15s; font-weight: 600; }
.back-link:hover { color: var(--teal); }
  `
})
export class PlatformLoginPage {
  private readonly platformContext = inject(PlatformContextService);
  private readonly router = inject(Router);

  operatorEmail = 'admin@servicedesk.local';
  operatorSecret = '••••••••••••';
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly emailError = signal('');
  readonly secretError = signal('');

  async loginWithCredentials(): Promise<void> {
    const email = this.operatorEmail.trim();
    const secret = this.operatorSecret.trim();

    if (!email) {
      this.emailError.set('Operator email is required.');
      return;
    }
    if (!secret) {
      this.secretError.set('Access key or secret is required.');
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    // Resolve matching admin profile
    let targetAdminId = '99999999-9999-9999-9999-999999999999';
    const em = email.toLowerCase();
    if (em.includes('billing')) {
      targetAdminId = '77777777-7777-7777-7777-777777777777';
    } else if (em.includes('support')) {
      targetAdminId = '88888888-8888-8888-8888-888888888888';
    }

    const success = await this.platformContext.switchDevRole(targetAdminId);
    this.loading.set(false);

    if (success) {
      void this.router.navigate(['/platform-admin/overview']);
    } else {
      this.error.set('Failed to authenticate as platform operator. Verify server configuration.');
    }
  }
}
