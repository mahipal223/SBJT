import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  PlatformAdminApiService,
  PasswordPolicyResponse,
  UpdatePasswordPolicyRequest,
} from '../../core/platform-admin-api.service';
import { PlatformContextService } from '../../core/platform-context.service';

@Component({
  selector: 'app-platform-security',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
<div class="page-container">
  <div class="page-header">
    <div class="header-icon-group">
      <div class="header-badge">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        </svg>
      </div>
      <div>
        <h2>Security & Password Policy</h2>
        <p class="subtitle">Platform-wide password complexity, account lockout parameters, and credential lifecycle rules.</p>
      </div>
    </div>
    <button type="button" class="btn-refresh" (click)="loadPolicy()" [disabled]="loading()">
      <svg class="refresh-icon" [class.spin]="loading()" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="23 4 23 10 17 10"></polyline>
        <polyline points="1 20 1 14 7 14"></polyline>
        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
      </svg>
      {{ loading() ? 'Refreshing…' : 'Refresh Policy' }}
    </button>
  </div>

  @if (loading()) {
    <div class="state-card loading">
      <div class="spinner"></div>
      <p>Loading security policy settings…</p>
    </div>
  } @else if (error()) {
    <div class="state-card error">
      <p class="error-msg">
        <svg class="inline-warn" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        {{ error() }}
      </p>
      <button type="button" class="btn-retry" (click)="loadPolicy()">Try Again</button>
    </div>
  } @else {
    <!-- Status / Feedback Messages -->
    @if (serverError()) {
      <div class="alert alert-error" role="alert">
        <svg class="inline-warn" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        {{ serverError() }}
      </div>
    }
    @if (successMessage()) {
      <div class="alert alert-success" role="alert">
        <svg class="inline-ok" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
        {{ successMessage() }}
      </div>
    }

    <!-- Summary KPI cards -->
    <div class="kpi-grid">
      <div class="kpi-card teal">
        <span class="label">Minimum Length</span>
        <span class="value">{{ minLength }} chars</span>
        <span class="meta">Max length: {{ maxLength }} chars</span>
      </div>
      <div class="kpi-card blue">
        <span class="label">Lockout Threshold</span>
        <span class="value">{{ maxFailedAccessAttempts }} attempts</span>
        <span class="meta">{{ lockoutDurationMinutes }} min cooldown</span>
      </div>
      <div class="kpi-card purple">
        <span class="label">Password History</span>
        <span class="value">{{ preventPasswordReuseCount }} passwords</span>
        <span class="meta">Prevent immediate reuse</span>
      </div>
      <div class="kpi-card amber">
        <span class="label">Expiration</span>
        <span class="value">{{ passwordExpirationDays ? passwordExpirationDays + ' days' : 'None' }}</span>
        <span class="meta">{{ passwordExpirationDays ? 'Periodic rotation' : 'Permanent validity' }}</span>
      </div>
    </div>

    <!-- Security Settings Form -->
    <form (ngSubmit)="savePolicy()" novalidate class="settings-form">
      <div class="card-grid">
        <!-- Card 1: Password Complexity Requirements -->
        <div class="card">
          <div class="card-header">
            <h3>Password Complexity Rules</h3>
            <p class="card-desc">Define structural criteria required for all newly created passwords and resets.</p>
          </div>

          <div class="form-row">
            <div class="field" [class.has-error]="minLengthError()">
              <label for="sec-min-length">Minimum Length (chars) <span class="req">*</span></label>
              <input
                id="sec-min-length"
                type="number"
                min="8"
                max="128"
                [(ngModel)]="minLength"
                (ngModelChange)="validateMinLength()"
                name="minLength"
                [disabled]="!platformContext.canManageSecurity() || saving()"
                class="form-control" />
              @if (minLengthError()) {
                <span class="field-error">{{ minLengthError() }}</span>
              }
            </div>

            <div class="field" [class.has-error]="maxLengthError()">
              <label for="sec-max-length">Maximum Length (chars) <span class="req">*</span></label>
              <input
                id="sec-max-length"
                type="number"
                min="8"
                max="128"
                [(ngModel)]="maxLength"
                (ngModelChange)="validateMaxLength()"
                name="maxLength"
                [disabled]="!platformContext.canManageSecurity() || saving()"
                class="form-control" />
              @if (maxLengthError()) {
                <span class="field-error">{{ maxLengthError() }}</span>
              }
            </div>
          </div>

          <div class="checkbox-group">
            <label class="toggle-checkbox" for="sec-req-upper">
              <input
                id="sec-req-upper"
                type="checkbox"
                [(ngModel)]="requireUppercase"
                name="requireUppercase"
                [disabled]="!platformContext.canManageSecurity() || saving()" />
              <div class="checkbox-text">
                <strong>Require uppercase letter</strong>
                <span>Must include at least one capital letter (A-Z)</span>
              </div>
            </label>

            <label class="toggle-checkbox" for="sec-req-lower">
              <input
                id="sec-req-lower"
                type="checkbox"
                [(ngModel)]="requireLowercase"
                name="requireLowercase"
                [disabled]="!platformContext.canManageSecurity() || saving()" />
              <div class="checkbox-text">
                <strong>Require lowercase letter</strong>
                <span>Must include at least one small letter (a-z)</span>
              </div>
            </label>

            <label class="toggle-checkbox" for="sec-req-digit">
              <input
                id="sec-req-digit"
                type="checkbox"
                [(ngModel)]="requireDigit"
                name="requireDigit"
                [disabled]="!platformContext.canManageSecurity() || saving()" />
              <div class="checkbox-text">
                <strong>Require numeric digit</strong>
                <span>Must include at least one number (0-9)</span>
              </div>
            </label>

            <label class="toggle-checkbox" for="sec-req-special">
              <input
                id="sec-req-special"
                type="checkbox"
                [(ngModel)]="requireNonAlphanumeric"
                name="requireNonAlphanumeric"
                [disabled]="!platformContext.canManageSecurity() || saving()" />
              <div class="checkbox-text">
                <strong>Require special symbol</strong>
                <span>Must include at least one non-alphanumeric character (!@#$%^&*)</span>
              </div>
            </label>
          </div>
        </div>

        <!-- Card 2: Account Lockout & Lifecycle -->
        <div class="card">
          <div class="card-header">
            <h3>Account Lockout & Lifecycle</h3>
            <p class="card-desc">Mitigate brute-force attacks and establish credential expiration cycles.</p>
          </div>

          <div class="form-row">
            <div class="field" [class.has-error]="attemptsError()">
              <label for="sec-max-attempts">Max Failed Attempts Before Lockout <span class="req">*</span></label>
              <input
                id="sec-max-attempts"
                type="number"
                min="3"
                max="20"
                [(ngModel)]="maxFailedAccessAttempts"
                (ngModelChange)="validateAttempts()"
                name="maxFailedAccessAttempts"
                [disabled]="!platformContext.canManageSecurity() || saving()"
                class="form-control" />
              @if (attemptsError()) {
                <span class="field-error">{{ attemptsError() }}</span>
              } @else {
                <span class="field-hint">Minimum 3 attempts before temporary lockout.</span>
              }
            </div>

            <div class="field" [class.has-error]="lockoutDurationError()">
              <label for="sec-lockout-duration">Lockout Duration (minutes) <span class="req">*</span></label>
              <input
                id="sec-lockout-duration"
                type="number"
                min="1"
                max="1440"
                [(ngModel)]="lockoutDurationMinutes"
                (ngModelChange)="validateLockoutDuration()"
                name="lockoutDurationMinutes"
                [disabled]="!platformContext.canManageSecurity() || saving()"
                class="form-control" />
              @if (lockoutDurationError()) {
                <span class="field-error">{{ lockoutDurationError() }}</span>
              } @else {
                <span class="field-hint">Duration an account remains locked out.</span>
              }
            </div>
          </div>

          <div class="form-row">
            <div class="field">
              <label for="sec-expiration-days">Password Expiration (days)</label>
              <input
                id="sec-expiration-days"
                type="number"
                min="0"
                max="365"
                [(ngModel)]="passwordExpirationDays"
                name="passwordExpirationDays"
                placeholder="Leave blank for no expiration"
                [disabled]="!platformContext.canManageSecurity() || saving()"
                class="form-control" />
              <span class="field-hint">Optional. Leave empty for passwords that do not expire.</span>
            </div>

            <div class="field" [class.has-error]="historyError()">
              <label for="sec-history-count">Prevent Password Reuse History <span class="req">*</span></label>
              <input
                id="sec-history-count"
                type="number"
                min="0"
                max="24"
                [(ngModel)]="preventPasswordReuseCount"
                (ngModelChange)="validateHistory()"
                name="preventPasswordReuseCount"
                [disabled]="!platformContext.canManageSecurity() || saving()"
                class="form-control" />
              @if (historyError()) {
                <span class="field-error">{{ historyError() }}</span>
              } @else {
                <span class="field-hint">Number of previous passwords user cannot reuse.</span>
              }
            </div>
          </div>

          <!-- Enterprise Advisory Card -->
          <div class="advisory-box">
            <svg class="advisory-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
            </svg>
            <div>
              <strong>Cryptographic Audit Note:</strong>
              <span>Changes to password policies apply immediately to subsequent user sign-ups and credential modifications. Every policy revision is recorded to the platform audit log with your operator ID.</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Actions bar -->
      @if (platformContext.canManageSecurity()) {
        <div class="form-actions-bar">
          <span class="last-updated">
            @if (policy()?.updatedAt) {
              Last updated: {{ policy()!.updatedAt | date:'medium' }}
            }
          </span>
          <button
            type="submit"
            class="btn-save"
            [disabled]="saving() || !isValid()">
            @if (saving()) {
              <span class="spinner-small"></span> Saving Policy…
            } @else {
              Save Security Policy
            }
          </button>
        </div>
      } @else {
        <div class="readonly-notice">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          <span>You have Support (read-only) permissions for security policy. Contact an Operations Administrator to adjust these parameters.</span>
        </div>
      }
    </form>
  }
</div>
  `,
  styles: `
.page-container { display: flex; flex-direction: column; gap: 1.5rem; width: 100%; font-family: 'DM Sans', system-ui, sans-serif; }
.page-header { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem; }
.header-icon-group { display: flex; align-items: center; gap: 0.85rem; }
.header-badge { width: 44px; height: 44px; border-radius: 5px; background: var(--teal-tint); color: var(--teal-dark); border: 1px solid #b7e8de; display: grid; place-items: center; flex-shrink: 0; }
h2 { font-size: 24px; font-weight: 800; color: var(--ink); margin: 0; font-family: 'Manrope', sans-serif; }
.subtitle { font-size: 13px; color: var(--muted); margin: 4px 0 0; }
.btn-refresh { display: inline-flex; align-items: center; gap: 8px; padding: 8px 16px; border-radius: 5px; background: #fff; color: var(--navy); border: 1px solid var(--line); font-size: 13px; font-weight: 700; cursor: pointer; transition: all 0.15s ease; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04); }
.btn-refresh:hover:not(:disabled) { background: #f8fafb; border-color: #cbd5e1; color: var(--teal-dark); }
.btn-refresh:disabled { opacity: 0.6; cursor: not-allowed; }
.refresh-icon.spin { animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

.alert { padding: 0.85rem 1.25rem; border-radius: 5px; font-size: 13px; font-weight: 600; display: flex; align-items: center; gap: 0.65rem; }
.alert-error { background: var(--red-bg); border: 1px solid #fed2d2; color: var(--red); }
.alert-success { background: var(--teal-tint); border: 1px solid #b7e8de; color: var(--teal-dark); }
.inline-warn { color: var(--red); flex-shrink: 0; }
.inline-ok { color: var(--teal); flex-shrink: 0; }

.kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1.25rem; width: 100%; }
.kpi-card { padding: 18px 20px; border-radius: 5px; background: #fff; border: 1px solid var(--line); box-shadow: var(--shadow); display: flex; flex-direction: column; gap: 4px; }
.kpi-card .label { font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--muted); letter-spacing: .05em; }
.kpi-card .value { font-size: 24px; font-weight: 800; color: var(--ink); font-family: 'Manrope', sans-serif; }
.kpi-card .meta { font-size: 12px; color: var(--muted); }
.kpi-card.teal { border-left: 4px solid var(--teal); }
.kpi-card.blue { border-left: 4px solid var(--blue); }
.kpi-card.purple { border-left: 4px solid #6366f1; }
.kpi-card.amber { border-left: 4px solid var(--amber); }

.settings-form { display: flex; flex-direction: column; gap: 1.25rem; width: 100%; }
.card-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(360px, 1fr)); gap: 1.25rem; width: 100%; }
.card { background: #fff; border: 1px solid var(--line); border-radius: 5px; padding: 22px; box-shadow: var(--shadow); display: flex; flex-direction: column; gap: 1.25rem; }
.card-header h3 { font-size: 16px; font-weight: 800; color: var(--ink); margin: 0; font-family: 'Manrope', sans-serif; }
.card-desc { font-size: 12px; color: var(--muted); margin: 4px 0 0; }

.form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
@media (max-width: 500px) {
  .form-row { grid-template-columns: 1fr; }
}

.field { display: flex; flex-direction: column; gap: 0.35rem; }
.field label { font-size: 0.78rem; font-weight: 700; color: var(--ink); }
.field .req { color: var(--red); }
.form-control { width: 100%; height: 42px; padding: 0 0.75rem; border: 1px solid var(--line); border-radius: 5px; font-size: 0.9rem; color: var(--ink); background: #fff; transition: border-color 0.15s, box-shadow 0.15s; box-sizing: border-box; }
.form-control:focus { outline: none; border-color: var(--teal); box-shadow: 0 0 0 3px rgba(8,127,116,0.15); }
.form-control:disabled { background: #f8fafb; color: var(--muted); cursor: not-allowed; }
.field.has-error .form-control { border-color: var(--red); box-shadow: 0 0 0 2px rgba(185,28,28,0.15); }
.field-error { font-size: 0.75rem; color: var(--red); font-weight: 600; margin-top: 2px; }
.field-hint { font-size: 0.75rem; color: var(--muted); }

.checkbox-group { display: flex; flex-direction: column; gap: 0.85rem; border-top: 1px solid var(--line-soft); padding-top: 1rem; }
.toggle-checkbox { display: flex; align-items: flex-start; gap: 0.75rem; cursor: pointer; }
.toggle-checkbox input[type="checkbox"] { width: 18px; height: 18px; margin-top: 2px; accent-color: var(--teal); border-radius: 4px; cursor: pointer; }
.checkbox-text { display: flex; flex-direction: column; gap: 2px; }
.checkbox-text strong { font-size: 13px; font-weight: 700; color: var(--ink); }
.checkbox-text span { font-size: 12px; color: var(--muted); }

.advisory-box { display: flex; align-items: flex-start; gap: 0.75rem; padding: 12px 14px; background: #f8fafb; border: 1px solid var(--line); border-radius: 5px; font-size: 12px; color: var(--muted); line-height: 1.45; }
.advisory-icon { flex-shrink: 0; color: var(--navy); margin-top: 2px; }
.advisory-box strong { color: var(--ink); margin-right: 4px; }

.form-actions-bar { display: flex; align-items: center; justify-content: space-between; background: #fff; border: 1px solid var(--line); border-radius: 5px; padding: 16px 22px; box-shadow: var(--shadow); }
.last-updated { font-size: 12px; color: var(--muted); font-weight: 600; }
.btn-save { padding: 10px 24px; border-radius: 5px; background: var(--teal); color: #fff; border: 0; font-size: 14px; font-weight: 700; cursor: pointer; transition: background 0.15s; display: inline-flex; align-items: center; gap: 0.5rem; }
.btn-save:hover:not(:disabled) { background: var(--teal-dark); }
.btn-save:disabled { opacity: 0.6; cursor: not-allowed; }
.spinner-small { width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.4); border-top-color: #fff; border-radius: 50%; animation: spin 0.8s linear infinite; }

.readonly-notice { display: flex; align-items: center; gap: 0.65rem; background: #f8fafb; border: 1px solid var(--line); border-radius: 5px; padding: 14px 18px; font-size: 13px; color: var(--muted); font-weight: 600; }
.state-card { background: #fff; border: 1px solid var(--line); border-radius: 5px; padding: 3rem 1.5rem; text-align: center; color: var(--muted); box-shadow: var(--shadow); }
.spinner { width: 28px; height: 28px; border: 3px solid var(--line); border-top-color: var(--teal); border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto 0.75rem; }
.btn-retry { margin-top: 1rem; padding: 8px 16px; border-radius: 5px; background: var(--teal); color: #fff; border: 0; font-weight: 700; cursor: pointer; }
.btn-retry:hover { background: var(--teal-dark); }
  `
})
export class PlatformSecurityComponent implements OnInit {
  private readonly api = inject(PlatformAdminApiService);
  readonly platformContext = inject(PlatformContextService);

  readonly policy = signal<PasswordPolicyResponse | null>(null);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly serverError = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);

  // Form values
  minLength = 8;
  maxLength = 128;
  requireUppercase = true;
  requireLowercase = true;
  requireDigit = true;
  requireNonAlphanumeric = true;
  maxFailedAccessAttempts = 5;
  lockoutDurationMinutes = 15;
  passwordExpirationDays?: number;
  preventPasswordReuseCount = 3;

  // Validation signals
  readonly minLengthError = signal('');
  readonly maxLengthError = signal('');
  readonly attemptsError = signal('');
  readonly lockoutDurationError = signal('');
  readonly historyError = signal('');

  ngOnInit(): void {
    this.loadPolicy();
  }

  loadPolicy(): void {
    this.loading.set(true);
    this.error.set(null);
    this.serverError.set(null);
    this.successMessage.set(null);

    this.api.getPasswordPolicy().subscribe({
      next: res => {
        this.policy.set(res);
        this.minLength = res.minLength;
        this.maxLength = res.maxLength;
        this.requireUppercase = res.requireUppercase;
        this.requireLowercase = res.requireLowercase;
        this.requireDigit = res.requireDigit;
        this.requireNonAlphanumeric = res.requireNonAlphanumeric;
        this.maxFailedAccessAttempts = res.maxFailedAccessAttempts;
        this.lockoutDurationMinutes = res.lockoutDurationMinutes;
        this.passwordExpirationDays = res.passwordExpirationDays;
        this.preventPasswordReuseCount = res.preventPasswordReuseCount;
        this.loading.set(false);
      },
      error: err => {
        this.error.set(err?.error?.detail || err?.message || 'Failed to load security policy.');
        this.loading.set(false);
      }
    });
  }

  validateMinLength(): void {
    if (this.minLength < 8) {
      this.minLengthError.set('Minimum length must be at least 8 characters.');
    } else if (this.minLength > this.maxLength) {
      this.minLengthError.set('Minimum length cannot exceed maximum length.');
    } else {
      this.minLengthError.set('');
    }
  }

  validateMaxLength(): void {
    if (this.maxLength > 128) {
      this.maxLengthError.set('Maximum length cannot exceed 128 characters.');
    } else if (this.maxLength < this.minLength) {
      this.maxLengthError.set('Maximum length must be at least minimum length.');
    } else {
      this.maxLengthError.set('');
    }
  }

  validateAttempts(): void {
    if (this.maxFailedAccessAttempts < 3) {
      this.attemptsError.set('Maximum failed attempts must be at least 3.');
    } else {
      this.attemptsError.set('');
    }
  }

  validateLockoutDuration(): void {
    if (this.lockoutDurationMinutes < 1) {
      this.lockoutDurationError.set('Lockout duration must be at least 1 minute.');
    } else {
      this.lockoutDurationError.set('');
    }
  }

  validateHistory(): void {
    if (this.preventPasswordReuseCount < 0) {
      this.historyError.set('Password reuse count cannot be negative.');
    } else {
      this.historyError.set('');
    }
  }

  validateAll(): boolean {
    this.validateMinLength();
    this.validateMaxLength();
    this.validateAttempts();
    this.validateLockoutDuration();
    this.validateHistory();

    return (
      !this.minLengthError() &&
      !this.maxLengthError() &&
      !this.attemptsError() &&
      !this.lockoutDurationError() &&
      !this.historyError()
    );
  }

  isValid(): boolean {
    return (
      this.minLength >= 8 &&
      this.minLength <= this.maxLength &&
      this.maxLength <= 128 &&
      this.maxFailedAccessAttempts >= 3 &&
      this.lockoutDurationMinutes >= 1 &&
      this.preventPasswordReuseCount >= 0 &&
      !this.minLengthError() &&
      !this.maxLengthError() &&
      !this.attemptsError() &&
      !this.lockoutDurationError() &&
      !this.historyError()
    );
  }

  savePolicy(): void {
    if (!this.validateAll()) {
      return;
    }

    this.saving.set(true);
    this.serverError.set(null);
    this.successMessage.set(null);

    const payload: UpdatePasswordPolicyRequest = {
      minLength: this.minLength,
      maxLength: this.maxLength,
      requireUppercase: this.requireUppercase,
      requireLowercase: this.requireLowercase,
      requireDigit: this.requireDigit,
      requireNonAlphanumeric: this.requireNonAlphanumeric,
      maxFailedAccessAttempts: this.maxFailedAccessAttempts,
      lockoutDurationMinutes: this.lockoutDurationMinutes,
      passwordExpirationDays: this.passwordExpirationDays ? Number(this.passwordExpirationDays) : undefined,
      preventPasswordReuseCount: this.preventPasswordReuseCount,
    };

    this.api.updatePasswordPolicy(payload).subscribe({
      next: updated => {
        this.policy.set(updated);
        this.saving.set(false);
        this.successMessage.set('Platform password policy successfully updated and logged.');
      },
      error: err => {
        this.saving.set(false);
        this.serverError.set(err?.error?.detail || err?.message || 'Failed to update password policy.');
      }
    });
  }
}
