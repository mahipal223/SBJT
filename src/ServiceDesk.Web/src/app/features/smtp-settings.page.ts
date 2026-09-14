import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { WorkApiService } from '../core/work-api.service';

const getErrorMessage = (error: unknown) => {
  if (error instanceof HttpErrorResponse) {
    return error.error?.detail || error.error?.title || 'An error occurred while communicating with the server.';
  }
  return 'Something went wrong. Please try again.';
};

@Component({
  selector: 'app-smtp-settings',
  imports: [FormsModule, RouterLink],
  template: `
    <main class="page">
      <header class="page-head">
        <div>
          <nav class="breadcrumb">
            <a routerLink="/app/settings">Settings</a>
            <span class="crumb-sep">/</span>
            <span class="crumb-current">Outbound Email (SMTP)</span>
          </nav>
          <h1>Outbound Email & Custom SMTP</h1>
          <p>Configure custom SMTP mail servers so estimates and invoices are sent from your business's domain.</p>
        </div>
        <div class="page-actions">
          <button class="btn primary" [disabled]="saving() || loading()" (click)="save()">
            {{ saving() ? 'Saving…' : 'Save SMTP Settings' }}
          </button>
        </div>
      </header>

      @if(successMessage()){
        <div class="callout section-gap" style="border-color:var(--teal);background:var(--teal-tint);color:var(--navy)">
          <strong>Success:</strong> {{ successMessage() }}
        </div>
      }

      @if(error()){
        <div class="callout error-text section-gap">
          {{ error() }}
        </div>
      }

      @if(loading()){
        <section class="card card-body muted">Loading email configuration…</section>
      } @else {
        <section class="split">
          <div class="grid">
            <article class="card">
              <div class="card-head">
                <div>
                  <h2>Custom Mail Server</h2>
                  <p class="muted">Send billing documents using your company's own mail provider.</p>
                </div>
                <label class="toggle-container" style="display:flex;align-items:center;gap:8px;cursor:pointer">
                  <input type="checkbox" [(ngModel)]="isEnabled" style="width:18px;height:18px;accent-color:var(--teal)">
                  <span style="font-weight:700;font-size:13px">{{ isEnabled ? 'Active' : 'Disabled' }}</span>
                </label>
              </div>

              <div class="card-body">
                @if(!isEnabled){
                  <div class="callout" style="margin-bottom:18px;background:#f8fafb">
                    <strong>Custom SMTP is disabled:</strong> System messages, estimates, and invoices will use the default platform mail service.
                  </div>
                } @else {
                  <div class="callout" style="margin-bottom:18px;border-color:var(--teal);background:var(--teal-tint)">
                    <strong>Custom SMTP is enabled:</strong> Outbound customer communications will be dispatched directly through your mail server.
                  </div>
                }

                <form class="form-grid" (ngSubmit)="save()">
                  <div class="field wide">
                    <label>SMTP Host</label>
                    <input [(ngModel)]="host" name="host" placeholder="smtp.mailgun.org or smtp.office365.com" [disabled]="saving()">
                  </div>

                  <div class="field">
                    <label>SMTP Port</label>
                    <input type="number" [(ngModel)]="port" name="port" placeholder="587" [disabled]="saving()">
                  </div>

                  <div class="field">
                    <label>Security</label>
                    <div style="display:flex;align-items:center;gap:8px;height:42px">
                      <input type="checkbox" id="sslCheckbox" [(ngModel)]="enableSsl" name="enableSsl" style="width:18px;height:18px;accent-color:var(--teal)">
                      <label for="sslCheckbox" style="margin:0;cursor:pointer;font-weight:600">Enable SSL / TLS</label>
                    </div>
                  </div>

                  <div class="field">
                    <label>SMTP Username</label>
                    <input [(ngModel)]="username" name="username" placeholder="postmaster@yourdomain.com" [disabled]="saving()">
                  </div>

                  <div class="field">
                    <label>SMTP Password</label>
                    <input type="password" [(ngModel)]="password" name="password" [placeholder]="maskedPassword ? 'Leave empty to keep saved password' : 'Enter password'" [disabled]="saving()">
                    @if(maskedPassword){
                      <small class="muted" style="margin-top:4px;display:block">Current: {{ maskedPassword }} (enter new password only to change)</small>
                    }
                  </div>

                  <div class="field">
                    <label>From Email Address</label>
                    <input type="email" [(ngModel)]="fromEmail" name="fromEmail" placeholder="billing@yourdomain.com" [disabled]="saving()">
                  </div>

                  <div class="field">
                    <label>From Display Name</label>
                    <input [(ngModel)]="fromName" name="fromName" placeholder="Northstar Services Billing" [disabled]="saving()">
                  </div>
                </form>
              </div>
            </article>
          </div>

          <aside class="grid">
            <article class="card">
              <div class="card-head">
                <h2>Test Connection</h2>
              </div>
              <div class="card-body grid">
                <p class="muted" style="font-size:13px;line-height:1.5">
                  Verify your SMTP credentials and delivery by sending a live test message to your inbox.
                </p>

                <div class="field">
                  <label>Recipient Email</label>
                  <input type="email" [(ngModel)]="testRecipientEmail" placeholder="you@company.com" [disabled]="testing()">
                </div>

                <button class="btn" [disabled]="testing() || !testRecipientEmail" (click)="sendTest()">
                  {{ testing() ? 'Sending Test…' : 'Send Test Email' }}
                </button>

                @if(testMessage()){
                  <div class="callout" [class.error-text]="!testSuccess" [style.border-color]="testSuccess ? 'var(--teal)' : ''" [style.background]="testSuccess ? 'var(--teal-tint)' : ''" style="margin-top:10px">
                    {{ testMessage() }}
                  </div>
                }
              </div>
            </article>

            <article class="card">
              <div class="card-head">
                <h2>Recommended Settings</h2>
              </div>
              <div class="card-body list">
                <div class="list-row">
                  <span class="cell-main">
                    <strong>Port 587 (STARTTLS)</strong>
                    <small>Standard for Mailgun, SendGrid, Office 365, AWS SES</small>
                  </span>
                </div>
                <div class="list-row">
                  <span class="cell-main">
                    <strong>Port 465 (SMTPS)</strong>
                    <small>Direct TLS connection standard</small>
                  </span>
                </div>
                <div class="list-row">
                  <span class="cell-main">
                    <strong>DKIM & SPF Records</strong>
                    <small>Verify DNS records on your domain for optimal deliverability</small>
                  </span>
                </div>
              </div>
            </article>
          </aside>
        </section>
      }
    </main>
  `,
  styles: `
    .toggle-container input {
      margin: 0;
    }
  `
})
export class SmtpSettingsPage {
  private readonly api = inject(WorkApiService);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly testing = signal(false);
  readonly error = signal('');
  readonly successMessage = signal('');
  readonly testMessage = signal('');
  testSuccess = false;

  host = '';
  port = 587;
  username = '';
  password = '';
  maskedPassword = '';
  fromEmail = '';
  fromName = '';
  enableSsl = true;
  isEnabled = false;

  testRecipientEmail = '';

  constructor() {
    this.load();
  }

  load() {
    this.loading.set(true);
    this.error.set('');
    this.api.getSmtpSettings().subscribe({
      next: settings => {
        this.host = settings.host || '';
        this.port = settings.port || 587;
        this.username = settings.username || '';
        this.maskedPassword = settings.maskedPassword || '';
        this.fromEmail = settings.fromEmail || '';
        this.fromName = settings.fromName || '';
        this.enableSsl = settings.enableSsl;
        this.isEnabled = settings.isEnabled;
        if (!this.testRecipientEmail && settings.fromEmail) {
          this.testRecipientEmail = settings.fromEmail;
        }
        this.loading.set(false);
      },
      error: err => {
        this.error.set(getErrorMessage(err));
        this.loading.set(false);
      }
    });
  }

  save() {
    this.saving.set(true);
    this.error.set('');
    this.successMessage.set('');

    this.api.saveSmtpSettings({
      host: this.host,
      port: Number(this.port),
      username: this.username,
      password: this.password ? this.password : undefined,
      fromEmail: this.fromEmail,
      fromName: this.fromName,
      enableSsl: this.enableSsl,
      isEnabled: this.isEnabled
    }).subscribe({
      next: updated => {
        this.maskedPassword = updated.maskedPassword || '';
        this.password = '';
        this.saving.set(false);
        this.successMessage.set('SMTP settings saved successfully.');
      },
      error: err => {
        this.error.set(getErrorMessage(err));
        this.saving.set(false);
      }
    });
  }

  sendTest() {
    if (!this.testRecipientEmail) return;
    this.testing.set(true);
    this.testMessage.set('');

    this.api.testSmtpSettings(this.testRecipientEmail).subscribe({
      next: res => {
        this.testing.set(false);
        this.testSuccess = res.success;
        this.testMessage.set(res.message);
      },
      error: err => {
        this.testing.set(false);
        this.testSuccess = false;
        this.testMessage.set(getErrorMessage(err));
      }
    });
  }
}
