import { Component, inject, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService, AuthTokenResponse } from '../../core/auth.service';
import { GOOGLE_CLIENT_ID } from '../../app.config';

// Declare the global Google Identity Services API loaded via index.html
declare const google: {
  accounts: {
    id: {
      initialize(config: {
        client_id: string;
        callback: (response: { credential: string }) => void;
        auto_select?: boolean;
        cancel_on_tap_outside?: boolean;
      }): void;
      prompt(notification?: (n: { isNotDisplayed(): boolean; isSkippedMoment(): boolean }) => void): void;
      renderButton(parent: HTMLElement, options: object): void;
    };
  };
};

interface ProblemDetails {
  title?: string;
  detail?: string;
  extensions?: { code?: string };
}

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
          } @else if (mode() === 'signup') {
            <h1 id="login-title">Create your account</h1>
            <p class="supporting">Start your 14-day free trial. No credit card required.</p>
          } @else {
            <h1 id="login-title">Verify your email</h1>
            <p class="supporting">We sent a 6-digit verification code to <strong>{{ email }}</strong>.</p>
          }

          @if (errorMsg()) {
            <div class="error-banner" role="alert">{{ errorMsg() }}</div>
          }

          @if (infoMsg()) {
            <div class="info-banner" role="status">{{ infoMsg() }}</div>
          }

          @if (mode() !== 'verify_otp') {
            <!-- Social Identity Buttons -->
            <div class="social-buttons">
              <!-- Google Sign-In -->
              <button
                id="btn-google-signin"
                type="button"
                class="social-btn google-btn"
                [class.loading]="googleLoading()"
                [disabled]="googleLoading() || emailLoading()"
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

              <!-- Apple Sign-In — hidden until Apple developer account is configured.
                   The method and button are preserved for future implementation.
                   To enable: remove the 'apple-btn-hidden' class below. -->
              <button
                id="btn-apple-signin"
                type="button"
                class="social-btn apple-btn apple-btn-hidden"
                [disabled]="emailLoading() || googleLoading()"
                (click)="signInWithApple()"
                aria-label="Continue with Apple"
                aria-hidden="true"
                tabindex="-1">
                <svg width="20" height="20" viewBox="0 0 170 170" aria-hidden="true" fill="currentColor">
                  <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.35.13-9.16-1.9-14.42-6.08-3.69-3.05-7.64-7.85-11.87-14.42-6.3-9.77-11.16-20.78-14.57-33.02-3.41-12.24-5.12-23.75-5.12-34.52 0-14.13 3.68-26.04 11.05-35.73 7.37-9.68 16.59-14.6 27.67-14.75 4.35 0 9.28 1.13 14.79 3.4 5.51 2.27 9.17 3.44 10.98 3.52 1.63 0 5.48-1.25 11.55-3.76 6.07-2.5 11.16-3.65 15.27-3.45 15.65.88 27.31 6.58 35 17.11-13.72 8.35-20.44 19.53-20.15 33.56.29 11.08 4.35 20.35 12.18 27.81 7.83 7.46 17.07 11.57 27.71 12.33-2.61 7.72-5.77 15.54-9.48 23.47zM119.22 33.02c0-7.39 2.67-14.32 8.01-20.78 5.34-6.46 12-10.74 19.98-12.24.22 1.96.33 3.7.33 5.22 0 7.39-2.72 14.39-8.16 21-5.44 6.61-12.18 10.98-20.22 12.07-.15-1.96-.22-3.72-.22-5.27z"/>
                </svg>
                Continue with Apple
              </button>
            </div>

            <div class="divider"><span>or with email</span></div>

            <!-- Email / Password form -->
            <form class="email-form" (ngSubmit)="submitEmail()" #loginForm="ngForm" novalidate>
              @if (mode() === 'signup') {
                <div class="field" [class.has-error]="hasFieldError('fullName')">
                  <label for="full-name">Full name</label>
                  <input
                    id="full-name"
                    type="text"
                    name="fullName"
                    [(ngModel)]="fullName"
                    (blur)="markTouched('fullName')"
                    (input)="onInput('fullName')"
                    placeholder="Alex Johnson"
                    autocomplete="name"
                    required />
                  @if (hasFieldError('fullName')) {
                    <span class="field-error" role="alert">{{ getFieldError('fullName') }}</span>
                  }
                </div>
              }

              <div class="field" [class.has-error]="hasFieldError('email')">
                <label for="email">Email address</label>
                <input
                  id="email"
                  type="email"
                  name="email"
                  [(ngModel)]="email"
                  (blur)="markTouched('email')"
                  (input)="onInput('email')"
                  placeholder="alex@yourbusiness.com"
                  autocomplete="email"
                  required />
                @if (hasFieldError('email')) {
                  <span class="field-error" role="alert">{{ getFieldError('email') }}</span>
                }
              </div>

              <div class="field" [class.has-error]="hasFieldError('password')">
                <label for="password">Password</label>
                <div class="input-group">
                  <input
                    id="password"
                    [type]="showPassword() ? 'text' : 'password'"
                    name="password"
                    [(ngModel)]="password"
                    (blur)="markTouched('password')"
                    (input)="onInput('password')"
                    [placeholder]="mode() === 'signup' ? 'Create a strong password' : 'Enter your password'"
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
                @if (hasFieldError('password')) {
                  <span class="field-error" role="alert">{{ getFieldError('password') }}</span>
                }

                @if (mode() === 'signup' && password) {
                  <div class="password-checklist">
                    <span [class.valid]="hasLength()">{{ hasLength() ? '✓' : '•' }} 8+ characters</span>
                    <span [class.valid]="hasUpper()">{{ hasUpper() ? '✓' : '•' }} Uppercase letter</span>
                    <span [class.valid]="hasNumber()">{{ hasNumber() ? '✓' : '•' }} Number</span>
                    <span [class.valid]="hasSpecial()">{{ hasSpecial() ? '✓' : '•' }} Symbol (!@#$)</span>
                  </div>
                }
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
                <button type="button" class="link-btn" (click)="switchMode('signup')">Create one →</button>
              } @else {
                Already have an account?
                <button type="button" class="link-btn" (click)="switchMode('login')">Sign in →</button>
              }
            </p>
          } @else {
            <!-- Email OTP Verification Form -->
            <form class="email-form" (ngSubmit)="submitOtp()" novalidate>
              <div class="field" [class.has-error]="hasFieldError('otp')">
                <label for="otp-code">6-Digit Verification Code</label>
                <input
                  id="otp-code"
                  type="text"
                  name="otp"
                  [(ngModel)]="otp"
                  (blur)="markTouched('otp')"
                  (input)="onInput('otp')"
                  maxlength="6"
                  placeholder="123456"
                  class="otp-input"
                  autocomplete="one-time-code"
                  required />
                @if (hasFieldError('otp')) {
                  <span class="field-error" role="alert">{{ getFieldError('otp') }}</span>
                }
              </div>

              <button
                id="btn-verify-otp"
                type="submit"
                class="primary-action"
                [class.loading]="otpLoading()"
                [disabled]="otpLoading() || otp.length < 6">
                @if (!otpLoading()) {
                  Verify & Continue →
                } @else {
                  <span class="spinner"></span> Verifying code…
                }
              </button>

              <div class="otp-actions">
                <button
                  type="button"
                  class="link-btn"
                  [disabled]="resendCooldown() > 0"
                  (click)="resendOtp()">
                  {{ resendCooldown() > 0 ? 'Resend code in ' + resendCooldown() + 's' : 'Resend verification code' }}
                </button>
                <button type="button" class="link-btn secondary-link" (click)="switchMode('login')">
                  Back to Sign In
                </button>
              </div>
            </form>
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
      font-family: system-ui, -apple-system, sans-serif;
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
      background: #f8fafc;
    }
    .login-card {
      width: 100%;
      max-width: 440px;
      padding: 40px;
      background: #ffffff;
      border-radius: 16px;
      box-shadow: 0 4px 20px -2px rgba(15, 23, 42, 0.08), 0 2px 6px -1px rgba(15, 23, 42, 0.04);
      border: 1px solid #e2e8f0;
    }
    .card-logo {
      display: none;
      font-size: 24px;
      font-weight: 800;
      color: #0f172a;
      text-decoration: none;
      margin-bottom: 20px;
    }
    @media (max-width: 900px) {
      .card-logo { display: inline-block; }
    }
    .eyebrow {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.08em;
      color: #087f74;
      margin: 0 0 8px;
    }
    h1 {
      font-size: 26px;
      font-weight: 700;
      color: #0f172a;
      margin: 0 0 8px;
      letter-spacing: -0.02em;
    }
    .supporting {
      font-size: 14px;
      color: #64748b;
      margin: 0 0 24px;
      line-height: 1.5;
    }

    /* ── Alerts ──────────────────────────────────────────────────── */
    .error-banner {
      background: #fef2f2;
      border: 1px solid #fecaca;
      color: #b91c1c;
      padding: 12px 16px;
      border-radius: 8px;
      font-size: 13px;
      margin-bottom: 20px;
      line-height: 1.4;
    }
    .info-banner {
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      color: #1d4ed8;
      padding: 12px 16px;
      border-radius: 8px;
      font-size: 13px;
      margin-bottom: 20px;
      line-height: 1.4;
    }

    /* ── Social Buttons ──────────────────────────────────────────── */
    .social-buttons {
      display: grid;
      gap: 12px;
      margin-bottom: 20px;
    }
    .social-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      width: 100%;
      height: 46px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      text-decoration: none;
    }
    .google-btn {
      background: #ffffff;
      border: 1px solid #cbd5e1;
      color: #1e293b;
    }
    .google-btn:hover:not(:disabled) {
      background: #f8fafc;
      border-color: #94a3b8;
      box-shadow: 0 2px 4px rgba(0,0,0,0.05);
    }
    .apple-btn {
      background: #000000;
      border: 1px solid #000000;
      color: #ffffff;
    }
    .apple-btn:hover:not(:disabled) {
      background: #1e293b;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    /* Hidden until Apple developer account is configured.
       Remove this rule to show the Apple Sign-In button. */
    .apple-btn-hidden {
      display: none !important;
    }
    .social-btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    /* ── Divider ─────────────────────────────────────────────────── */
    .divider {
      position: relative;
      text-align: center;
      margin: 20px 0;
    }
    .divider::before {
      content: '';
      position: absolute;
      left: 0;
      top: 50%;
      width: 100%;
      height: 1px;
      background: #e2e8f0;
    }
    .divider span {
      position: relative;
      background: #ffffff;
      padding: 0 12px;
      font-size: 12px;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    /* ── Form Fields ─────────────────────────────────────────────── */
    .email-form {
      display: grid;
      gap: 18px;
    }
    .field {
      display: grid;
      gap: 6px;
    }
    label {
      font-size: 13px;
      font-weight: 600;
      color: #334155;
    }
    input {
      width: 100%;
      height: 44px;
      padding: 0 14px;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      font-size: 14px;
      color: #0f172a;
      background: #fff;
      box-sizing: border-box;
      transition: border-color 0.2s;
    }
    input:focus {
      outline: none;
      border-color: #087f74;
      box-shadow: 0 0 0 3px rgba(8, 127, 116, 0.15);
    }
    .field.has-error input {
      border-color: #ef4444;
      background-color: #fff8f8;
    }
    .field.has-error input:focus {
      border-color: #dc2626;
      box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.18);
    }
    .field-error {
      color: #dc2626;
      font-size: 12px;
      font-weight: 500;
      margin-top: 2px;
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .otp-input {
      text-align: center;
      font-size: 24px;
      letter-spacing: 10px;
      font-weight: 700;
      font-family: monospace;
    }
    .input-group {
      position: relative;
      display: flex;
      align-items: center;
    }
    .toggle-pw {
      position: absolute;
      right: 12px;
      background: none;
      border: none;
      cursor: pointer;
      font-size: 16px;
      padding: 4px;
    }

    /* ── Password Checklist ──────────────────────────────────────── */
    .password-checklist {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 4px 8px;
      margin-top: 8px;
      font-size: 11px;
      color: #94a3b8;
    }
    .password-checklist span.valid {
      color: #16a34a;
      font-weight: 600;
    }

    /* ── Primary Action Button ───────────────────────────────────── */
    .primary-action {
      height: 46px;
      width: 100%;
      background: #087f74;
      color: #fff;
      border: none;
      border-radius: 8px;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      transition: background 0.2s;
      margin-top: 6px;
    }
    .primary-action:hover:not(:disabled) {
      background: #06675e;
    }
    .primary-action:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    /* ── Switch Mode & Footer ────────────────────────────────────── */
    .switch-mode {
      margin: 24px 0 0;
      text-align: center;
      font-size: 14px;
      color: #64748b;
    }
    .link-btn {
      background: none;
      border: none;
      color: #087f74;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      padding: 0 4px;
    }
    .link-btn:hover {
      text-decoration: underline;
    }
    .link-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .otp-actions {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      margin-top: 16px;
    }
    .secondary-link {
      color: #64748b;
      font-size: 13px;
    }

    /* ── Spinner ─────────────────────────────────────────────────── */
    .spinner {
      width: 16px;
      height: 16px;
      border: 2px solid rgba(255,255,255,0.3);
      border-top-color: #fff;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  `,
})
export class LoginPage implements OnInit {
  protected readonly auth = inject(AuthService);
  protected readonly router = inject(Router);
  protected readonly http = inject(HttpClient);
  private  readonly route = inject(ActivatedRoute);

  readonly mode = signal<'login' | 'signup' | 'verify_otp'>('login');
  readonly showPassword = signal(false);
  readonly googleLoading = signal(false);
  readonly emailLoading = signal(false);
  readonly otpLoading = signal(false);
  readonly resendCooldown = signal(0);
  readonly errorMsg = signal('');
  readonly infoMsg = signal('');
  readonly submitted = signal(false);
  readonly fieldErrors = signal<Record<string, string>>({});
  readonly fieldTouched = signal<Record<string, boolean>>({});

  email = '';
  password = '';
  fullName = '';
  otp = '';

  ngOnInit(): void {
    // Show a friendly error if Google cancelled or failed during callback.
    const err = this.route.snapshot.queryParamMap.get('error');
    if (err === 'google_cancelled') {
      this.errorMsg.set('Google Sign-In was cancelled. Please try again.');
    } else if (err === 'google_failed') {
      this.errorMsg.set('Google Sign-In failed. Please try again or use email.');
    }
  }

  // Real-time password complexity checklist
  hasLength(): boolean { return this.password.length >= 8; }
  hasUpper(): boolean { return /[A-Z]/.test(this.password); }
  hasNumber(): boolean { return /[0-9]/.test(this.password); }
  hasSpecial(): boolean { return /[^A-Za-z0-9]/.test(this.password); }

  hasFieldError(field: string): boolean {
    return (this.submitted() || !!this.fieldTouched()[field]) && !!this.fieldErrors()[field];
  }

  getFieldError(field: string): string {
    return this.hasFieldError(field) ? (this.fieldErrors()[field] || '') : '';
  }

  markTouched(field: string): void {
    this.fieldTouched.update(t => ({ ...t, [field]: true }));
    this.validateForm();
  }

  onInput(field: string): void {
    if (this.submitted() || this.fieldTouched()[field]) {
      this.validateForm();
    }
  }

  validateField(field: string): string {
    switch (field) {
      case 'fullName':
        if (this.mode() === 'signup') {
          if (!this.fullName.trim()) return 'Please enter your full name.';
          if (this.fullName.trim().length < 2) return 'Full name must be at least 2 characters.';
        }
        return '';
      case 'email':
        if (!this.email.trim()) return 'Email address is required.';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email.trim())) return 'Please enter a valid email address (e.g. name@example.com).';
        return '';
      case 'password':
        if (!this.password) return 'Please enter your password.';
        if (this.mode() === 'signup') {
          if (!this.hasLength() || !this.hasUpper() || !this.hasNumber() || !this.hasSpecial()) {
            return 'Password does not meet platform policy requirements.';
          }
        }
        return '';
      case 'otp':
        if (this.mode() === 'verify_otp') {
          if (!this.otp || !this.otp.trim()) return 'Verification code is required.';
          if (!/^\d{6}$/.test(this.otp.trim())) return 'Please enter the 6-digit numeric verification code.';
        }
        return '';
      default:
        return '';
    }
  }

  validateForm(): boolean {
    const errs: Record<string, string> = {};
    const fields = this.mode() === 'verify_otp'
      ? ['otp']
      : this.mode() === 'signup'
      ? ['fullName', 'email', 'password']
      : ['email', 'password'];

    for (const f of fields) {
      const msg = this.validateField(f);
      if (msg) errs[f] = msg;
    }
    this.fieldErrors.set(errs);
    return Object.keys(errs).length === 0;
  }

  switchMode(newMode: 'login' | 'signup' | 'verify_otp'): void {
    this.errorMsg.set('');
    this.infoMsg.set('');
    this.fieldErrors.set({});
    this.fieldTouched.set({});
    this.submitted.set(false);
    this.mode.set(newMode);
  }

  submitEmail(): void {
    this.errorMsg.set('');
    this.infoMsg.set('');
    this.submitted.set(true);

    if (!this.validateForm()) {
      return;
    }

    if (this.mode() === 'signup') {
      this.emailLoading.set(true);
      this.http.post<{ userId: string; email: string; status: string }>(
        '/api/v1/auth/register',
        { email: this.email, password: this.password, fullName: this.fullName }
      ).subscribe({
        next: () => {
          this.emailLoading.set(false);
          this.infoMsg.set('Account created! Please check your email for the 6-digit verification code.');
          this.mode.set('verify_otp');
          this.startCooldown();
        },
        error: (err) => {
          this.emailLoading.set(false);
          this.handleApiError(err);
        }
      });
    } else {
      // Login mode
      this.emailLoading.set(true);
      this.http.post<AuthTokenResponse>(
        '/api/v1/auth/login',
        { email: this.email, password: this.password }
      ).subscribe({
        next: (res) => {
          this.emailLoading.set(false);
          this.auth.handleAuthSuccess(res);
        },
        error: (err) => {
          this.emailLoading.set(false);
          const pd = err.error as ProblemDetails;
          if (pd?.extensions?.code === 'email_not_verified') {
            this.infoMsg.set('Email not verified. A verification code has been dispatched.');
            this.mode.set('verify_otp');
            this.startCooldown();
          } else {
            this.handleApiError(err);
          }
        }
      });
    }
  }

  submitOtp(): void {
    this.errorMsg.set('');
    this.infoMsg.set('');
    this.submitted.set(true);

    if (!this.validateForm()) {
      return;
    }

    this.otpLoading.set(true);
    this.http.post<AuthTokenResponse>(
      '/api/v1/auth/verify-email-otp',
      { email: this.email, otp: this.otp.trim() }
    ).subscribe({
      next: (res) => {
        this.otpLoading.set(false);
        this.auth.handleAuthSuccess(res);
      },
      error: (err) => {
        this.otpLoading.set(false);
        this.handleApiError(err);
      }
    });
  }

  resendOtp(): void {
    if (this.resendCooldown() > 0) return;
    this.errorMsg.set('');
    this.infoMsg.set('');

    this.http.post<{ message: string }>(
      '/api/v1/auth/resend-email-otp',
      { email: this.email }
    ).subscribe({
      next: (res) => {
        this.infoMsg.set(res.message || 'Verification code resent.');
        this.startCooldown();
      },
      error: (err) => {
        this.handleApiError(err);
      }
    });
  }

  signInWithGoogle(): void {
    this.errorMsg.set('');
    this.googleLoading.set(true);

    // Standard OAuth 2.0 Authorization Code Flow.
    // Google redirects back to /callback?code=...&state=google_oauth
    // The CallbackPage will POST { code, redirectUri } to /api/v1/auth/google.
    const redirectUri = `${window.location.origin}/callback`;
    const params = new URLSearchParams({
      client_id:     GOOGLE_CLIENT_ID,
      redirect_uri:  redirectUri,
      response_type: 'code',
      scope:         'openid email profile',
      state:         'google_oauth',
      access_type:   'online',
      prompt:        'select_account',
    });

    window.location.href =
      `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  // TODO: Apple Sign-In — future implementation.
  // Requires Apple Developer account + Sign in with Apple capability.
  // Backend endpoint is ready at POST /api/v1/auth/apple.
  // When implementing: load AppleID.auth JS SDK, call AppleID.auth.signIn(),
  // extract identityToken from response, POST to /api/v1/auth/apple.
  signInWithApple(): void {
    this.errorMsg.set('');
    // Apple Sign-In not yet enabled — button is hidden in UI.
  }

  private startCooldown(): void {
    this.resendCooldown.set(60);
    const interval = setInterval(() => {
      const current = this.resendCooldown();
      if (current <= 1) {
        clearInterval(interval);
        this.resendCooldown.set(0);
      } else {
        this.resendCooldown.set(current - 1);
      }
    }, 1000);
  }

  private handleApiError(err: { error?: ProblemDetails }): void {
    const pd = err.error;
    if (pd?.detail) {
      this.errorMsg.set(pd.detail);
    } else if (pd?.title) {
      this.errorMsg.set(pd.title);
    } else {
      this.errorMsg.set('An error occurred during authentication. Please try again.');
    }
  }
}
