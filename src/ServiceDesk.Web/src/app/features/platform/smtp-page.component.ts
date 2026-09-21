import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

interface SmtpSettings {
  host: string;
  port: number;
  username: string;
  fromEmail: string;
  fromName: string;
  enableSsl: boolean;
  isConfigured: boolean;
}

@Component({
  selector: 'app-platform-smtp',
  standalone: true,
  imports: [FormsModule],
  template: `
<div class="smtp-page">

  <div class="page-header">
    <div class="header-icon">✉️</div>
    <div>
      <h1>Platform Email (SMTP)</h1>
      <p>Configure the platform-wide email server used for OTP verification, invitations, and system notifications.</p>
    </div>
  </div>

  <!-- Status banner -->
  @if (settings()?.isConfigured) {
    <div class="status-banner configured">
      <span class="status-dot"></span>
      SMTP is configured and active — <strong>{{ settings()?.host }}</strong>
    </div>
  } @else {
    <div class="status-banner unconfigured">
      <span class="status-dot"></span>
      No platform SMTP configured. OTP and system emails will not be delivered until this is set up.
    </div>
  }

  <!-- Error / Success messages -->
  @if (errorMsg()) {
    <div class="alert alert-error" role="alert">⚠️ {{ errorMsg() }}</div>
  }
  @if (successMsg()) {
    <div class="alert alert-success" role="alert">✅ {{ successMsg() }}</div>
  }

  <!-- Settings Form -->
  <div class="card">
    <h2>SMTP Server Settings</h2>
    <p class="hint">
      These settings are saved to <code>appsettings.Development.json</code> and applied on the next API restart.
      In production, use environment variables instead.
    </p>

    <form (ngSubmit)="save()" #smtpForm="ngForm" novalidate>
      <div class="form-grid">

        <!-- Host -->
        <div class="field" [class.has-error]="submitted() && !host">
          <label for="smtp-host">SMTP Host <span class="req">*</span></label>
          <input id="smtp-host" type="text" [(ngModel)]="host" name="host"
            placeholder="smtp.gmail.com" autocomplete="off">
          @if (submitted() && !host) {
            <span class="field-error">Host is required</span>
          }
        </div>

        <!-- Port -->
        <div class="field">
          <label for="smtp-port">Port</label>
          <input id="smtp-port" type="number" [(ngModel)]="port" name="port"
            placeholder="587" min="1" max="65535">
        </div>

        <!-- Username -->
        <div class="field">
          <label for="smtp-user">Username / Email</label>
          <input id="smtp-user" type="text" [(ngModel)]="username" name="username"
            placeholder="you@gmail.com" autocomplete="off">
        </div>

        <!-- Password -->
        <div class="field">
          <label for="smtp-pass">Password / App Password</label>
          <input id="smtp-pass" type="password" [(ngModel)]="password" name="password"
            placeholder="Leave blank to keep existing" autocomplete="new-password">
          <span class="field-hint">Leave blank to keep the saved password unchanged.</span>
        </div>

        <!-- From Email -->
        <div class="field" [class.has-error]="submitted() && !fromEmail">
          <label for="smtp-from">From Email <span class="req">*</span></label>
          <input id="smtp-from" type="email" [(ngModel)]="fromEmail" name="fromEmail"
            placeholder="noreply@yourcompany.com">
          @if (submitted() && !fromEmail) {
            <span class="field-error">From email is required</span>
          }
        </div>

        <!-- From Name -->
        <div class="field">
          <label for="smtp-fromname">From Name</label>
          <input id="smtp-fromname" type="text" [(ngModel)]="fromName" name="fromName"
            placeholder="ServiceDesk">
        </div>

      </div>

      <!-- SSL toggle -->
      <div class="toggle-row">
        <label class="toggle-label" for="smtp-ssl">
          <input id="smtp-ssl" type="checkbox" [(ngModel)]="enableSsl" name="enableSsl">
          <span>Enable SSL/TLS</span>
        </label>
        <span class="toggle-hint">Required for port 587 (STARTTLS) and 465 (SSL).</span>
      </div>

      <div class="form-actions">
        <button type="submit" class="btn-save" [disabled]="saving()">
          @if (saving()) { Saving… } @else { Save Settings }
        </button>
      </div>
    </form>
  </div>

  <!-- Test Connection -->
  <div class="card">
    <h2>Test Connection</h2>
    <p class="hint">Send a test email using the settings above (or your saved settings).</p>

    <div class="test-row">
      <div class="field flex-grow" [class.has-error]="testSubmitted() && !testEmail">
        <label for="smtp-test-email">Send test email to</label>
        <input id="smtp-test-email" type="email" [(ngModel)]="testEmail" name="testEmail"
          placeholder="you@example.com">
        @if (testSubmitted() && !testEmail) {
          <span class="field-error">Enter a recipient email</span>
        }
      </div>
      <button type="button" class="btn-test" (click)="sendTest()" [disabled]="testing()">
        @if (testing()) { Sending… } @else { Send Test Email }
      </button>
    </div>

    @if (testResult()) {
      <div class="alert" [class.alert-success]="testResult()!.success" [class.alert-error]="!testResult()!.success">
        {{ testResult()!.success ? '✅' : '⚠️' }} {{ testResult()!.message }}
      </div>
    }
  </div>

  <!-- Quick setup guides -->
  <div class="card guides-card">
    <h2>Quick Setup Guide</h2>
    <div class="guides-grid">
      <div class="guide">
        <h3>📧 Gmail</h3>
        <ul>
          <li><strong>Host:</strong> smtp.gmail.com</li>
          <li><strong>Port:</strong> 587</li>
          <li><strong>Username:</strong> your Gmail address</li>
          <li><strong>Password:</strong> <a href="https://myaccount.google.com/apppasswords" target="_blank">App Password</a> (requires 2FA)</li>
          <li><strong>SSL:</strong> ✅ On</li>
        </ul>
      </div>
      <div class="guide">
        <h3>📬 Brevo (free 300/day)</h3>
        <ul>
          <li><strong>Host:</strong> smtp-relay.brevo.com</li>
          <li><strong>Port:</strong> 587</li>
          <li><strong>Username:</strong> your Brevo email</li>
          <li><strong>Password:</strong> SMTP Key from dashboard</li>
          <li><strong>SSL:</strong> ✅ On</li>
        </ul>
      </div>
      <div class="guide">
        <h3>🖥️ Mailhog (local dev)</h3>
        <ul>
          <li><strong>Host:</strong> localhost</li>
          <li><strong>Port:</strong> 1025</li>
          <li><strong>Username:</strong> (leave blank)</li>
          <li><strong>Password:</strong> (leave blank)</li>
          <li><strong>SSL:</strong> ❌ Off</li>
        </ul>
        <p class="guide-note">View emails at <a href="http://localhost:8025" target="_blank">localhost:8025</a></p>
      </div>
    </div>
  </div>

</div>
  `,
  styles: `
    .smtp-page {
      max-width: 860px;
      margin: 0 auto;
      padding: 32px 24px;
      display: flex;
      flex-direction: column;
      gap: 24px;
    }

    /* Header */
    .page-header {
      display: flex;
      align-items: center;
      gap: 18px;
    }
    .header-icon {
      font-size: 42px;
      flex-shrink: 0;
    }
    .page-header h1 {
      margin: 0 0 4px;
      font-size: 22px;
      font-weight: 700;
      color: #0f2a35;
    }
    .page-header p {
      margin: 0;
      color: #5c7180;
      font-size: 14px;
    }

    /* Status banner */
    .status-banner {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px 18px;
      border-radius: 10px;
      font-size: 14px;
      font-weight: 500;
    }
    .status-banner.configured {
      background: #ecfdf5;
      border: 1px solid #a7f3d0;
      color: #065f46;
    }
    .status-banner.unconfigured {
      background: #fffbeb;
      border: 1px solid #fde68a;
      color: #92400e;
    }
    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: currentColor;
      flex-shrink: 0;
    }

    /* Card */
    .card {
      background: #fff;
      border: 1px solid #e4eaed;
      border-radius: 14px;
      padding: 28px;
    }
    .card h2 {
      margin: 0 0 6px;
      font-size: 16px;
      font-weight: 700;
      color: #0f2a35;
    }
    .hint {
      margin: 0 0 20px;
      font-size: 13px;
      color: #7b8f9a;
    }
    .hint code {
      background: #f0f4f6;
      padding: 1px 6px;
      border-radius: 4px;
      font-size: 12px;
    }

    /* Form grid */
    .form-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 18px;
    }
    @media (max-width: 600px) { .form-grid { grid-template-columns: 1fr; } }

    .field {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .field label {
      font-size: 13px;
      font-weight: 600;
      color: #2d4a58;
    }
    .req { color: #e53e3e; }
    .field input {
      border: 1.5px solid #d0dbe1;
      border-radius: 8px;
      padding: 9px 13px;
      font-size: 14px;
      color: #1a2e38;
      outline: none;
      transition: border-color 0.2s;
    }
    .field input:focus { border-color: #087f74; box-shadow: 0 0 0 3px rgba(8,127,116,0.12); }
    .has-error input { border-color: #e53e3e; }
    .has-error input:focus { box-shadow: 0 0 0 3px rgba(229,62,62,0.12); }
    .field-error { font-size: 12px; color: #e53e3e; font-weight: 500; }
    .field-hint { font-size: 12px; color: #7b8f9a; }

    /* Toggle */
    .toggle-row {
      display: flex;
      align-items: center;
      gap: 14px;
      margin-top: 18px;
    }
    .toggle-label {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
      font-weight: 600;
      color: #2d4a58;
      cursor: pointer;
    }
    .toggle-label input[type=checkbox] { width: 16px; height: 16px; accent-color: #087f74; }
    .toggle-hint { font-size: 12px; color: #7b8f9a; }

    /* Form actions */
    .form-actions { margin-top: 24px; }
    .btn-save {
      padding: 11px 28px;
      background: #087f74;
      color: #fff;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
      transition: background 0.2s, transform 0.1s;
    }
    .btn-save:hover:not(:disabled) { background: #065f57; }
    .btn-save:disabled { opacity: 0.5; cursor: not-allowed; }

    /* Test row */
    .test-row {
      display: flex;
      align-items: flex-end;
      gap: 14px;
      flex-wrap: wrap;
    }
    .flex-grow { flex: 1; min-width: 200px; }
    .btn-test {
      padding: 10px 22px;
      background: #f0f9f8;
      color: #087f74;
      border: 1.5px solid #087f74;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
      white-space: nowrap;
      transition: background 0.2s;
    }
    .btn-test:hover:not(:disabled) { background: #d0f0ec; }
    .btn-test:disabled { opacity: 0.5; cursor: not-allowed; }

    /* Alerts */
    .alert {
      padding: 12px 16px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 500;
      margin-top: 14px;
    }
    .alert-success { background: #ecfdf5; border: 1px solid #a7f3d0; color: #065f46; }
    .alert-error   { background: #fff5f5; border: 1px solid #feb2b2; color: #c53030; }

    /* Guides */
    .guides-card { background: #f8fafc; }
    .guides-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 20px;
      margin-top: 16px;
    }
    .guide {
      background: #fff;
      border: 1px solid #e4eaed;
      border-radius: 10px;
      padding: 18px;
    }
    .guide h3 { margin: 0 0 12px; font-size: 14px; font-weight: 700; color: #0f2a35; }
    .guide ul { margin: 0; padding: 0 0 0 14px; font-size: 13px; color: #4a6272; line-height: 1.8; }
    .guide a { color: #087f74; }
    .guide-note { margin: 10px 0 0; font-size: 12px; color: #7b8f9a; }
  `,
})
export class PlatformSmtpComponent implements OnInit {
  private readonly http = inject(HttpClient);

  readonly settings   = signal<SmtpSettings | null>(null);
  readonly saving     = signal(false);
  readonly testing    = signal(false);
  readonly submitted  = signal(false);
  readonly testSubmitted = signal(false);
  readonly errorMsg   = signal('');
  readonly successMsg = signal('');
  readonly testResult = signal<{ success: boolean; message: string } | null>(null);

  // Form fields
  host      = '';
  port      = 587;
  username  = '';
  password  = '';
  fromEmail = '';
  fromName  = 'ServiceDesk';
  enableSsl = true;
  testEmail = '';

  ngOnInit(): void {
    this.http.get<SmtpSettings>('/api/v1/admin/smtp').subscribe({
      next: (s) => {
        this.settings.set(s);
        this.host      = s.host;
        this.port      = s.port;
        this.username  = s.username;
        this.fromEmail = s.fromEmail;
        this.fromName  = s.fromName;
        this.enableSsl = s.enableSsl;
        this.password  = '';   // never returned from server
      },
    });
  }

  save(): void {
    this.submitted.set(true);
    this.errorMsg.set('');
    this.successMsg.set('');

    if (!this.host || !this.fromEmail) return;

    this.saving.set(true);
    this.http.put('/api/v1/admin/smtp', {
      host:      this.host,
      port:      this.port,
      username:  this.username,
      password:  this.password || null,
      fromEmail: this.fromEmail,
      fromName:  this.fromName || 'ServiceDesk',
      enableSsl: this.enableSsl,
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.successMsg.set('Settings saved. Restart the API server for changes to take effect.');
        this.settings.update(s => s ? { ...s, host: this.host, isConfigured: true } : s);
      },
      error: (err) => {
        this.saving.set(false);
        this.errorMsg.set(err?.error?.detail || 'Failed to save SMTP settings.');
      },
    });
  }

  sendTest(): void {
    this.testSubmitted.set(true);
    this.testResult.set(null);
    if (!this.testEmail) return;

    this.testing.set(true);
    this.http.post<{ success: boolean; message: string }>('/api/v1/admin/smtp/test', {
      host:      this.host,
      port:      this.port,
      username:  this.username,
      password:  this.password,
      fromEmail: this.fromEmail,
      fromName:  this.fromName || 'ServiceDesk',
      enableSsl: this.enableSsl,
      targetEmail: this.testEmail,
    }).subscribe({
      next: (r) => {
        this.testing.set(false);
        this.testResult.set(r);
      },
      error: (err) => {
        this.testing.set(false);
        this.testResult.set({ success: false, message: err?.error?.detail || 'Test failed.' });
      },
    });
  }
}
