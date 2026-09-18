import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';

interface OnboardingState {
  // Step 1 — Industry
  industry: string;
  // Step 2 — Business profile
  businessName: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  timeZone: string;
  // Step 3 — Team size
  teamSize: 'solo' | 'team';
}

const INDUSTRIES = [
  { code: 'plumbing',   label: 'Plumbing',           icon: '🔧' },
  { code: 'electrical', label: 'Electrical',          icon: '⚡' },
  { code: 'hvac',       label: 'HVAC',                icon: '❄️' },
  { code: 'automotive', label: 'Automotive Service',  icon: '🚗' },
  { code: 'general',    label: 'General Trade',       icon: '🏗️' },
  { code: 'landscaping',label: 'Landscaping',         icon: '🌿' },
  { code: 'cleaning',   label: 'Cleaning Services',   icon: '🧹' },
  { code: 'roofing',    label: 'Roofing',             icon: '🏠' },
];

const TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Phoenix',
  'America/Anchorage',
  'Pacific/Honolulu',
];

@Component({
  selector: 'app-onboarding',
  imports: [FormsModule],
  template: `
    <div class="onboard-root">
      <!-- Progress header -->
      <header class="onboard-header">
        <a class="brand" href="/">servicedesk</a>
        <div class="progress-steps" aria-label="Setup steps">
          @for (s of steps; track s.num) {
            <div class="step" [class.done]="step() > s.num" [class.active]="step() === s.num">
              <div class="step-dot">{{ step() > s.num ? '✓' : s.num }}</div>
              <span class="step-label hide-sm">{{ s.label }}</span>
            </div>
            @if (!$last) { <div class="step-line" [class.done]="step() > s.num"></div> }
          }
        </div>
        <div style="width: 120px"></div><!-- spacer -->
      </header>

      <main class="onboard-body">

        <!-- ── Step 1: Industry ─────────────────────────────────── -->
        @if (step() === 1) {
          <section class="onboard-card" aria-labelledby="step1-title">
            <h1 id="step1-title">What kind of business do you run?</h1>
            <p class="sub">We'll set up your workspace with the right defaults for your trade.</p>
            <div class="industry-grid">
              @for (ind of industries; track ind.code) {
                <button
                  type="button"
                  class="industry-tile"
                  [class.selected]="form.industry === ind.code"
                  (click)="form.industry = ind.code"
                  [id]="'industry-' + ind.code"
                  [attr.aria-pressed]="form.industry === ind.code">
                  <span class="tile-icon">{{ ind.icon }}</span>
                  <span class="tile-label">{{ ind.label }}</span>
                </button>
              }
            </div>
            <div class="step-footer">
              <button
                id="btn-step1-next"
                type="button"
                class="btn-primary"
                [disabled]="!form.industry"
                (click)="next()">
                Continue →
              </button>
            </div>
          </section>
        }

        <!-- ── Step 2: Business profile ─────────────────────────── -->
        @if (step() === 2) {
          <section class="onboard-card" aria-labelledby="step2-title">
            <h1 id="step2-title">Tell us about your business</h1>
            <p class="sub">This information appears on estimates, invoices and customer receipts.</p>
            <form class="profile-form" #profileForm="ngForm">
              <div class="field-full">
                <label for="biz-name">Business name <span class="req">*</span></label>
                <input id="biz-name" type="text" [(ngModel)]="form.businessName" name="businessName"
                       placeholder="Northstar Services LLC" autocomplete="organization" required />
              </div>
              <div class="field">
                <label for="biz-phone">Business phone</label>
                <input id="biz-phone" type="tel" [(ngModel)]="form.phone" name="phone"
                       #phone="ngModel" pattern="[0-9()+ .-]{7,20}"
                       placeholder="(512) 555-0100" autocomplete="tel" />
                @if (phone.invalid && phone.touched) {
                  <small class="field-error">Enter a valid US phone number.</small>
                }
              </div>
              <div class="field">
                <label for="biz-tz">Time zone</label>
                <select id="biz-tz" [(ngModel)]="form.timeZone" name="timeZone">
                  @for (tz of timezones; track tz) {
                    <option [value]="tz">{{ tz.replace('_', ' ').replace('America/', '') }}</option>
                  }
                </select>
              </div>
              <div class="field-full">
                <label for="biz-addr">Street address</label>
                <input id="biz-addr" type="text" [(ngModel)]="form.address" name="address"
                       placeholder="1200 South Lamar Blvd" autocomplete="street-address" />
              </div>
              <div class="field">
                <label for="biz-city">City</label>
                <input id="biz-city" type="text" [(ngModel)]="form.city" name="city"
                       placeholder="Austin" autocomplete="address-level2" />
              </div>
              <div class="field field-sm">
                <label for="biz-state">State</label>
                <input id="biz-state" type="text" [(ngModel)]="form.state" name="state"
                       #state="ngModel" pattern="[A-Za-z]{2}"
                       placeholder="TX" maxlength="2" autocomplete="address-level1" />
                @if (state.invalid && state.touched) {
                  <small class="field-error">Use a two-letter state code.</small>
                }
              </div>
              <div class="field field-sm">
                <label for="biz-zip">ZIP</label>
                <input id="biz-zip" type="text" [(ngModel)]="form.zip" name="zip"
                       #zip="ngModel" pattern="[0-9]{5}(-[0-9]{4})?"
                       placeholder="78704" maxlength="10" autocomplete="postal-code" />
                @if (zip.invalid && zip.touched) {
                  <small class="field-error">Use a 5-digit ZIP or ZIP+4.</small>
                }
              </div>
            </form>
            <div class="step-footer">
              <button type="button" class="btn-back" (click)="back()">← Back</button>
              <button
                id="btn-step2-next"
                type="button"
                class="btn-primary"
                [disabled]="profileForm.invalid || !form.businessName.trim()"
                (click)="next()">
                Continue →
              </button>
            </div>
          </section>
        }

        <!-- ── Step 3: Team size ─────────────────────────────────── -->
        @if (step() === 3) {
          <section class="onboard-card" aria-labelledby="step3-title">
            <h1 id="step3-title">How do you currently operate?</h1>
            <p class="sub">You can change this at any time — no data migration needed.</p>
            <div class="team-tiles">
              <button
                id="tile-solo"
                type="button"
                class="team-tile"
                [class.selected]="form.teamSize === 'solo'"
                (click)="form.teamSize = 'solo'"
                [attr.aria-pressed]="form.teamSize === 'solo'">
                <span class="team-icon">👤</span>
                <strong>Just me</strong>
                <p>Solo operator. Jobs auto-assign to you. Team menus stay hidden.</p>
              </button>
              <button
                id="tile-team"
                type="button"
                class="team-tile"
                [class.selected]="form.teamSize === 'team'"
                (click)="form.teamSize = 'team'"
                [attr.aria-pressed]="form.teamSize === 'team'">
                <span class="team-icon">👥</span>
                <strong>I have a team</strong>
                <p>Multi-technician dispatch, assignments and role-based access unlocked.</p>
              </button>
            </div>

            @if (errorMsg()) {
              <div class="error-banner" role="alert">{{ errorMsg() }}</div>
            }

            <div class="step-footer">
              <button type="button" class="btn-back" (click)="back()">← Back</button>
              <button
                id="btn-create-workspace"
                type="button"
                class="btn-primary"
                [class.loading]="saving()"
                [disabled]="saving() || !form.teamSize"
                (click)="createWorkspace()">
                @if (!saving()) {
                  Create my workspace →
                } @else {
                  <span class="spinner"></span> Setting up…
                }
              </button>
            </div>
          </section>
        }

      </main>
    </div>
  `,
  styles: `
    /* ── Root ────────────────────────────────────────────────────── */
    :host { display: block; min-height: 100vh; background: #f4f7fa; }
    .onboard-root { min-height: 100vh; display: flex; flex-direction: column; }

    /* ── Header / progress ───────────────────────────────────────── */
    .onboard-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 32px;
      height: 68px;
      border-bottom: 1px solid #dce5ea;
      background: #fff;
    }
    .brand {
      color: #087f74;
      font-family: Manrope, sans-serif;
      font-size: 20px;
      font-weight: 800;
      text-decoration: none;
      width: 120px;
    }
    .progress-steps { display: flex; align-items: center; gap: 0; }
    .step { display: flex; align-items: center; gap: 8px; }
    .step-dot {
      width: 30px; height: 30px;
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-size: 13px; font-weight: 700;
      border: 2px solid #dce5ea;
      background: #fff;
      color: #aabcc5;
    }
    .step.active .step-dot { border-color: #087f74; color: #087f74; }
    .step.done .step-dot { border-color: #087f74; background: #087f74; color: #fff; }
    .step-label { font-size: 13px; font-weight: 600; color: #aabcc5; }
    .step.active .step-label { color: #087f74; }
    .step.done .step-label { color: #3d5462; }
    .step-line { width: 40px; height: 2px; background: #dce5ea; margin: 0 4px; }
    .step-line.done { background: #087f74; }
    .hide-sm { display: none; }
    @media (min-width: 680px) { .hide-sm { display: inline; } }

    /* ── Body / card ─────────────────────────────────────────────── */
    .onboard-body { flex: 1; display: flex; align-items: flex-start; justify-content: center; padding: 48px 24px; }
    .onboard-card {
      width: min(640px, 100%);
      padding: 44px 40px;
      border: 1px solid #dce5ea;
      border-radius: 18px;
      background: #fff;
      box-shadow: 0 12px 40px rgba(16,41,54,.07);
    }
    h1 { margin: 0 0 8px; color: #142d3b; font-family: Manrope, sans-serif; font-size: 26px; }
    .sub { margin: 0 0 28px; color: #5c7180; line-height: 1.55; }
    @media (max-width: 500px) { .onboard-card { padding: 28px 18px; } }

    /* ── Industry grid ───────────────────────────────────────────── */
    .industry-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
      gap: 12px;
      margin-bottom: 32px;
    }
    .industry-tile {
      display: flex; flex-direction: column; align-items: center; gap: 8px;
      padding: 20px 12px;
      border: 1.5px solid #dce5ea;
      border-radius: 12px;
      background: #fff;
      cursor: pointer;
      transition: border-color 0.15s, background 0.15s, box-shadow 0.15s;
    }
    .industry-tile:hover { border-color: #087f74; background: #f0faf9; }
    .industry-tile.selected { border-color: #087f74; background: #e4f5f1; }
    .tile-icon { font-size: 30px; }
    .tile-label { font-size: 13px; font-weight: 600; color: #142d3b; text-align: center; }

    /* ── Profile form ────────────────────────────────────────────── */
    .profile-form {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-bottom: 32px;
    }
    .field-full { grid-column: 1 / -1; }
    .field { display: grid; gap: 6px; }
    .field-sm { }
    .field-full, .field, .field-sm { display: grid; gap: 6px; }
    label { font-size: 13px; font-weight: 600; color: #3d5462; }
    .req { color: #b43b3b; }
    .field-error { color: #991b1b; font-size: 12px; }
    input, select {
      height: 42px;
      padding: 0 12px;
      border: 1.5px solid #dce5ea;
      border-radius: 8px;
      font: inherit; font-size: 14px;
      color: #142d3b;
      background: #fff;
      width: 100%; box-sizing: border-box;
      transition: border-color 0.15s;
    }
    input:focus, select:focus { outline: none; border-color: #087f74; box-shadow: 0 0 0 3px rgba(8,127,116,.1); }
    @media (max-width: 540px) { .profile-form { grid-template-columns: 1fr; } }

    /* ── Team tiles ──────────────────────────────────────────────── */
    .team-tiles { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 28px; }
    .team-tile {
      display: flex; flex-direction: column; align-items: center; gap: 10px;
      padding: 28px 20px;
      border: 1.5px solid #dce5ea;
      border-radius: 14px;
      background: #fff;
      cursor: pointer;
      text-align: center;
      transition: border-color 0.15s, background 0.15s;
    }
    .team-tile:hover { border-color: #087f74; }
    .team-tile.selected { border-color: #087f74; background: #e4f5f1; }
    .team-icon { font-size: 36px; }
    .team-tile strong { font-size: 16px; color: #142d3b; }
    .team-tile p { margin: 0; font-size: 13px; color: #5c7180; line-height: 1.4; }
    @media (max-width: 500px) { .team-tiles { grid-template-columns: 1fr; } }

    /* ── Footer / buttons ────────────────────────────────────────── */
    .step-footer { display: flex; justify-content: flex-end; align-items: center; gap: 12px; }
    .btn-primary {
      min-height: 46px; padding: 0 28px;
      border: 0; border-radius: 10px;
      background: #087f74; color: #fff;
      font: inherit; font-size: 15px; font-weight: 700;
      cursor: pointer; display: flex; align-items: center; gap: 8px;
      transition: background 0.15s;
    }
    .btn-primary:hover { background: #066b63; }
    .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-back {
      border: 0; background: transparent;
      color: #5c7180; font: inherit; font-size: 14px;
      cursor: pointer; margin-right: auto;
    }
    .btn-back:hover { color: #142d3b; }

    /* ── Error / spinner ─────────────────────────────────────────── */
    .error-banner {
      margin-bottom: 16px; padding: 12px 16px;
      border-radius: 8px; background: #fef2f2;
      border: 1px solid #fca5a5; color: #991b1b; font-size: 14px;
    }
    .spinner {
      width: 18px; height: 18px;
      border: 2.5px solid rgba(255,255,255,0.35);
      border-top-color: #fff;
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
      display: inline-block;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  `,
})
export class OnboardingPage {
  private readonly http   = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly auth   = inject(AuthService);

  readonly step    = signal(1);
  readonly saving  = signal(false);
  readonly errorMsg = signal('');

  readonly industries = INDUSTRIES;
  readonly timezones  = TIMEZONES;
  readonly steps      = [
    { num: 1, label: 'Your industry' },
    { num: 2, label: 'Business profile' },
    { num: 3, label: 'Team size' },
  ];

  form: OnboardingState = {
    industry:     '',
    businessName: '',
    phone:        '',
    address:      '',
    city:         '',
    state:        '',
    zip:          '',
    timeZone:     'America/Chicago',
    teamSize:     'solo',
  };

  next(): void {
    if (this.step() < 3) {
      this.step.update(s => s + 1);
    }
  }

  back(): void {
    if (this.step() > 1) {
      this.step.update(s => s - 1);
    }
  }

  createWorkspace(): void {
    this.errorMsg.set('');
    this.saving.set(true);

    // POST /api/v1/businesses — create the tenant workspace atomically.
    this.http.post<{ businessId: string; businessName: string }>('/api/v1/businesses', {
      name:        this.form.businessName.trim(),
      industry:    this.form.industry,
      phone:       this.form.phone || null,
      address:     this.form.address || null,
      city:        this.form.city || null,
      state:       this.form.state || null,
      zip:         this.form.zip || null,
      timeZone:    this.form.timeZone,
      soloMode:    this.form.teamSize === 'solo',
    }).subscribe({
      next: (result) => {
        this.auth.activateWorkspace(result.businessId, result.businessName, 'Owner');
        this.saving.set(false);
        void this.router.navigate(['/app/overview']);
      },
      error: (err) => {
        this.saving.set(false);
        const detail = err?.error?.detail || err?.error?.title || err?.message;
        const status = err?.status ? `[${err.status}] ` : '';
        this.errorMsg.set(
          detail ? `${status}${detail}` : 'Could not create your workspace. Please try again.'
        );
      },
    });
  }
}
