import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { isAuth0Configured } from '../../app.config';

@Component({
  selector: 'app-login-page',
  imports: [FormsModule],
  template: `
    <main class="login-root">
      <aside class="login-brand">
        <div class="brand-inner">
          <a class="brand-logo" href="/">servicedesk</a>
          <p class="brand-tagline">Run your trade business from one place.<br>Jobs, invoices, customers — all connected.</p>
          <ul class="brand-bullets">
            <li>✓ Manage jobs, customers and estimates</li>
            <li>✓ Send professional invoices and get paid</li>
            <li>✓ Works on desktop, tablet and mobile</li>
            <li>✓ Solo operator or growing team — no migration needed</li>
          </ul>
        </div>
      </aside>

      <section class="login-panel" aria-labelledby="login-title">
        <div class="login-card">
          <a class="card-logo" href="/">servicedesk</a>
          <p class="eyebrow">SERVICE BUSINESS SOFTWARE</p>

          @if (mode() === 'login') {
            <h1 id="login-title">Welcome back</h1>
            <p class="supporting">Sign in to manage your jobs, customers and invoices.</p>
          } @else {
            <h1 id="login-title">Create your account</h1>
            <p class="supporting">Start your 14-day free trial. No credit card required.</p>
          }

          @if (errorMsg()) {
            <div class="error-banner" role="alert">{{ errorMsg() }}</div>
          }

          <!-- Google Sign-In -->
          <button
            id="btn-google-signin"
            type="button"
            class="google-btn"
            [class.loading]="googleLoading()"
            [disabled]="googleLoading()"
            (click)="signInWithGoogle()"
            aria-label="Continue with Google">
            @if (!googleLoading()) {
              <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.36-8.16 2.36-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
              </svg>
              Continue with Google
            } @else {
              <span class="spinner"></span> Connecting…
            }
          </button>

          <div class="divider"><span>or</span></div>

          <!-- Email / Password form -->
          <form class="email-form" (ngSubmit)="submitEmail()" #loginForm="ngForm" novalidate>
            @if (mode() === 'signup') {
              <div class="field">
                <label for="full-name">Full name</label>
                <input
                  id="full-name"
                  type="text"
                  name="fullName"
                  [(ngModel)]="fullName"
                  placeholder="Alex Johnson"
                  autocomplete="name"
                  required />
              </div>
            }

            <div class="field">
              <label for="email">Email address</label>
              <input
                id="email"
                type="email"
                name="email"
                [(ngModel)]="email"
                placeholder="alex@yourbusiness.com"
                autocomplete="email"
                required />
            </div>

            <div class="field">
              <label for="password">
                Password
                @if (mode() === 'login') {
                  <a class="forgot-link" tabindex="0" (click)="forgotPassword()">Forgot password?</a>
                }
              </label>
              <div class="input-group">
                <input
                  id="password"
                  [type]="showPassword() ? 'text' : 'password'"
                  name="password"
                  [(ngModel)]="password"
                  [placeholder]="mode() === 'signup' ? 'Min. 8 characters' : ''"
                  autocomplete="current-password"
                  required />
                <button
                  type="button"
                  class="toggle-pw"
                  [attr.aria-label]="showPassword() ? 'Hide password' : 'Show password'"
                  (click)="showPassword.set(!showPassword())">
                  {{ showPassword() ? '🙈' : '👁' }}
                </button>
              </div>
            </div>

            <button
              id="btn-email-submit"
              type="submit"
              class="primary-action"
              [class.loading]="emailLoading()"
              [disabled]="emailLoading()">
              @if (!emailLoading()) {
                {{ mode() === 'login' ? 'Sign in' : 'Create account' }}
              } @else {
                <span class="spinner"></span> Please wait…
              }
            </button>
          </form>

          <p class="switch-mode">
            @if (mode() === 'login') {
              Don't have an account?
              <button type="button" class="link-btn" (click)="mode.set('signup')">Create one →</button>
            } @else {
              Already have an account?
              <button type="button" class="link-btn" (click)="mode.set('login')">Sign in →</button>
            }
          </p>

          <!-- Dev mode fallback shown only when Auth0 is not configured -->
          @if (!isAuth0Configured) {
            <div class="dev-zone" id="dev-login-section">
              <div class="dev-badge">⚡ LOCAL DEV MODE</div>
              <p class="dev-label">Auth0 is not configured yet. Sign in instantly below:</p>
              <button id="btn-dev-login" type="button" class="dev-btn" (click)="continueAsDemo()">
                Log in as Demo Owner (Northstar Services) →
              </button>
              <div class="dev-creds">
                <div class="dev-cred-row"><span class="cred-k">Business:</span> <span class="cred-v">Northstar Services</span></div>
                <div class="dev-cred-row"><span class="cred-k">Role:</span> <span class="cred-v">Owner (Full Access)</span></div>
                <div class="dev-cred-row"><span class="cred-k">Email:</span> <span class="cred-v">owner@northstar.example</span></div>
              </div>
              <p class="dev-hint">
                To enable live Google / Email authentication, fill in <code>AUTH0_DOMAIN</code> and <code>AUTH0_CLIENT_ID</code> in <code>app.config.ts</code>.
              </p>
            </div>
          }
        </div>
      </section>
    </main>
  `,
  styles: `
    /* ── Layout ──────────────────────────────────────────────────── */
    :host { display: block; min-height: 100vh; }
    .login-root {
      display: grid;
      grid-template-columns: 1fr 1fr;
      min-height: 100vh;
    }
    @media (max-width: 900px) {
      .login-root { grid-template-columns: 1fr; }
      .login-brand { display: none; }
    }

    /* ── Left brand panel ────────────────────────────────────────── */
    .login-brand {
      display: flex;
      align-items: center;
      padding: 60px 56px;
      background: linear-gradient(145deg, #0d2b38 0%, #0f3d50 60%, #087f74 100%);
      color: #fff;
    }
    .brand-logo {
      display: inline-block;
      margin-bottom: 32px;
      color: #fff;
      font-family: Manrope, sans-serif;
      font-size: 28px;
      font-weight: 800;
      text-decoration: none;
      letter-spacing: -0.03em;
    }
    .brand-tagline {
      margin: 0 0 32px;
      font-size: 22px;
      font-weight: 600;
      line-height: 1.4;
      color: rgba(255,255,255,0.9);
    }
    .brand-bullets {
      padding: 0;
      margin: 0;
      list-style: none;
      display: grid;
      gap: 14px;
    }
    .brand-bullets li {
      font-size: 15px;
      color: rgba(255,255,255,0.78);
      letter-spacing: 0.01em;
    }

    /* ── Right login panel ───────────────────────────────────────── */
    .login-panel {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 40px 24px;
      background: #f4f7fa;
    }
    .login-card {
      width: min(460px, 100%);
      padding: 44px 40px;
      border: 1px solid #dce5ea;
      border-radius: 18px;
      background: #fff;
      box-shadow: 0 20px 60px rgba(16, 41, 54, .09);
    }
    @media (max-width: 500px) {
      .login-card { padding: 32px 22px; border-radius: 14px; }
    }

    /* ── Typography ──────────────────────────────────────────────── */
    .card-logo {
      display: inline-block;
      color: #087f74;
      font-family: Manrope, sans-serif;
      font-size: 22px;
      font-weight: 800;
      text-decoration: none;
      letter-spacing: -0.03em;
    }
    .eyebrow {
      margin: 20px 0 8px;
      color: #087f74;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.1em;
      text-transform: uppercase;
    }
    h1 { margin: 0 0 6px; color: #142d3b; font-size: 28px; font-family: Manrope, sans-serif; }
    .supporting { margin: 0 0 24px; color: #5c7180; line-height: 1.55; font-size: 15px; }

    /* ── Error banner ────────────────────────────────────────────── */
    .error-banner {
      padding: 12px 16px;
      margin-bottom: 16px;
      border-radius: 8px;
      background: #fef2f2;
      border: 1px solid #fca5a5;
      color: #991b1b;
      font-size: 14px;
    }

    /* ── Google button ───────────────────────────────────────────── */
    .google-btn {
      width: 100%;
      min-height: 48px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      border: 1.5px solid #dce5ea;
      border-radius: 10px;
      background: #fff;
      color: #142d3b;
      font: inherit;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      transition: border-color 0.15s, box-shadow 0.15s;
    }
    .google-btn:hover { border-color: #aabcc5; box-shadow: 0 2px 8px rgba(16,41,54,.07); }
    .google-btn:focus-visible { outline: 3px solid rgba(8, 127, 116, .25); outline-offset: 3px; }
    .google-btn:disabled { opacity: 0.6; cursor: not-allowed; }

    /* ── Divider ─────────────────────────────────────────────────── */
    .divider {
      display: flex;
      align-items: center;
      gap: 12px;
      margin: 22px 0;
      color: #aabcc5;
      font-size: 13px;
    }
    .divider::before, .divider::after {
      content: '';
      flex: 1;
      height: 1px;
      background: #dce5ea;
    }

    /* ── Email form ──────────────────────────────────────────────── */
    .email-form { display: grid; gap: 16px; }
    .field { display: grid; gap: 6px; }
    .field label {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 13px;
      font-weight: 600;
      color: #3d5462;
    }
    .field input {
      width: 100%;
      min-height: 44px;
      padding: 0 12px;
      border: 1.5px solid #dce5ea;
      border-radius: 8px;
      font: inherit;
      font-size: 15px;
      color: #142d3b;
      background: #fff;
      box-sizing: border-box;
      transition: border-color 0.15s;
    }
    .field input:focus { outline: none; border-color: #087f74; box-shadow: 0 0 0 3px rgba(8,127,116,.12); }
    .input-group { position: relative; }
    .input-group input { padding-right: 44px; width: 100%; }
    .toggle-pw {
      position: absolute;
      right: 10px;
      top: 50%;
      transform: translateY(-50%);
      border: 0;
      background: transparent;
      cursor: pointer;
      font-size: 16px;
      padding: 4px;
    }
    .forgot-link {
      color: #087f74;
      font-weight: 500;
      font-size: 12px;
      cursor: pointer;
      text-decoration: none;
    }
    .forgot-link:hover { text-decoration: underline; }

    /* ── Primary action button ───────────────────────────────────── */
    .primary-action {
      width: 100%;
      min-height: 48px;
      margin-top: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      border: 0;
      border-radius: 10px;
      color: #fff;
      background: #087f74;
      font: inherit;
      font-size: 15px;
      font-weight: 700;
      cursor: pointer;
      transition: background 0.15s;
    }
    .primary-action:hover { background: #066b63; }
    .primary-action:focus-visible { outline: 3px solid rgba(8, 127, 116, .25); outline-offset: 3px; }
    .primary-action:disabled { opacity: 0.6; cursor: not-allowed; }

    /* ── Switch mode ─────────────────────────────────────────────── */
    .switch-mode {
      margin: 20px 0 0;
      text-align: center;
      color: #5c7180;
      font-size: 14px;
    }
    .link-btn {
      border: 0;
      background: transparent;
      color: #087f74;
      font: inherit;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      text-decoration: underline;
      padding: 0;
    }

    /* ── Spinner ─────────────────────────────────────────────────── */
    .spinner {
      width: 18px;
      height: 18px;
      border: 2.5px solid rgba(255,255,255,0.35);
      border-top-color: #fff;
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
      display: inline-block;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* ── Dev-mode zone ───────────────────────────────────────────── */
    .dev-zone {
      margin-top: 24px;
      padding: 18px;
      border-radius: 12px;
      background: #f8fafc;
      border: 1.5px dashed #087f74;
    }
    .dev-badge {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 4px;
      background: #e0f2f1;
      color: #087f74;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.05em;
      margin-bottom: 8px;
    }
    .dev-label {
      margin: 0 0 12px;
      font-size: 13px;
      font-weight: 600;
      color: #1e293b;
    }
    .dev-btn {
      width: 100%;
      min-height: 44px;
      border: none;
      border-radius: 8px;
      background: #087f74;
      color: #fff;
      font: inherit;
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      transition: background 0.15s ease, transform 0.05s ease;
    }
    .dev-btn:hover { background: #066960; }
    .dev-btn:active { transform: scale(0.99); }
    .dev-creds {
      margin-top: 12px;
      padding: 10px 12px;
      border-radius: 6px;
      background: #edf2f7;
      font-size: 12px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .dev-cred-row {
      display: flex;
      justify-content: space-between;
    }
    .cred-k { color: #64748b; font-weight: 500; }
    .cred-v { color: #0f172a; font-weight: 600; font-family: monospace; }
    .dev-hint {
      margin: 12px 0 0;
      font-size: 11px;
      color: #64748b;
      line-height: 1.5;
    }
    code { background: rgba(0,0,0,0.06); padding: 1px 4px; border-radius: 3px; font-size: 11px; }
  `,
})
export class LoginPage {
  protected readonly auth = inject(AuthService);
  protected readonly router = inject(Router);

  readonly mode = signal<'login' | 'signup'>('login');
  readonly showPassword = signal(false);
  readonly googleLoading = signal(false);
  readonly emailLoading = signal(false);
  readonly errorMsg = signal('');

  email = '';
  password = '';
  fullName = '';

  /** True when Auth0 Domain/ClientID have been filled in app.config.ts */
  readonly isAuth0Configured = isAuth0Configured;

  signInWithGoogle(): void {
    if (!this.isAuth0Configured) {
      // In local dev mode without Auth0, log in directly as demo
      this.continueAsDemo();
      return;
    }
    this.errorMsg.set('');
    this.googleLoading.set(true);

    try {
      // Import Auth0 service lazily to avoid errors when not configured.
      import('@auth0/auth0-angular').then(({ AuthService: Auth0Service }) => {
        // This only works if Auth0 is configured. If not, show dev hint.
        this.googleLoading.set(false);
        this.errorMsg.set('Auth0 is not configured yet. Fill in app.config.ts first.');
      }).catch(() => {
        this.googleLoading.set(false);
        this.errorMsg.set('Auth0 is not configured. Use the dev login below.');
      });
    } catch {
      this.googleLoading.set(false);
      this.errorMsg.set('Auth0 is not configured. Use the dev login below.');
    }
  }

  submitEmail(): void {
    this.errorMsg.set('');
    if (!this.email || !this.password) {
      this.errorMsg.set('Please enter your email and password.');
      return;
    }
    this.emailLoading.set(true);

    if (!this.isAuth0Configured) {
      // In dev mode, clicking submit logs the developer directly in as demo owner!
      setTimeout(() => {
        this.emailLoading.set(false);
        this.continueAsDemo();
      }, 300);
      return;
    }

    // Auth0 Universal Login handles email+password on the /callback redirect.
    setTimeout(() => {
      this.emailLoading.set(false);
      this.errorMsg.set('Auth0 is not configured yet. Use the dev login below.');
    }, 600);
  }

  forgotPassword(): void {
    this.errorMsg.set('Password reset is handled by Auth0. Configure Auth0 to enable it.');
  }

  continueAsDemo(): void {
    this.auth.loginAsDemo();
    void this.router.navigate(['/app/overview']);
  }
}
