import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { NgSelectComponent } from '@ng-select/ng-select';
import { AuthService } from '../../core/auth.service';
import { TIMEZONES, US_STATES_AND_PROVINCES, STATE_CITIES } from '../../core/reference-data';

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
  { code: 'plumbing',   label: 'Plumbing',           icon: 'plumbing' },
  { code: 'electrical', label: 'Electrical',          icon: 'electrical' },
  { code: 'hvac',       label: 'HVAC',                icon: 'hvac' },
  { code: 'automotive', label: 'Automotive Service',  icon: 'automotive' },
  { code: 'general',    label: 'General Trade',       icon: 'general' },
  { code: 'landscaping',label: 'Landscaping',         icon: 'landscaping' },
  { code: 'cleaning',   label: 'Cleaning Services',   icon: 'cleaning' },
  { code: 'roofing',    label: 'Roofing',             icon: 'roofing' },
];

@Component({
  selector: 'app-onboarding',
  imports: [FormsModule, NgSelectComponent],
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
                  <span class="tile-icon" aria-hidden="true">
                    @switch (ind.icon) {
                      @case ('plumbing') {
                        <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
                      }
                      @case ('electrical') {
                        <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                      }
                      @case ('hvac') {
                        <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="2" x2="12" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/><line x1="19.07" y1="4.93" x2="4.93" y2="19.07"/></svg>
                      }
                      @case ('automotive') {
                        <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13" rx="2"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
                      }
                      @case ('general') {
                        <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 20h20"/><path d="M5 20V8l7-5 7 5v12"/></svg>
                      }
                      @case ('landscaping') {
                        <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L8 6v5a4 4 0 0 0 8 0V6z"/><path d="M12 17v5"/></svg>
                      }
                      @case ('cleaning') {
                        <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 4-3 3 6 6 3-3z"/><path d="m3 21 9-9"/><path d="M12.2 6.8 4 15l-1 5 5-1 8.2-8.2"/></svg>
                      }
                      @case ('roofing') {
                        <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
                      }
                    }
                  </span>
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
              <div class="field-full" [class.has-error]="nameModel.invalid && (nameModel.touched || step2Submitted())">
                <label for="biz-name">Business name <span class="req">*</span></label>
                <input id="biz-name" type="text" [(ngModel)]="form.businessName" name="businessName" #nameModel="ngModel"
                       placeholder="Northstar Services LLC" autocomplete="organization" required />
                @if (nameModel.invalid && (nameModel.touched || step2Submitted())) {
                  <span class="field-error">Business name is required.</span>
                }
              </div>
              <div class="field" [class.has-error]="phoneModel.invalid && (phoneModel.touched || step2Submitted())">
                <label for="biz-phone">Business phone</label>
                <input id="biz-phone" type="tel" [(ngModel)]="form.phone" name="phone"
                       #phoneModel="ngModel" pattern="[0-9()+ .-]{7,20}"
                       placeholder="(512) 555-0100" autocomplete="tel" />
                @if (phoneModel.invalid && (phoneModel.touched || step2Submitted())) {
                  <span class="field-error">Enter a valid US phone number.</span>
                }
              </div>
              <div class="field">
                <label for="biz-tz">Time zone</label>
                <ng-select id="biz-tz" [(ngModel)]="form.timeZone" name="timeZone" [items]="timezones" bindLabel="label" bindValue="id" [clearable]="false"></ng-select>
              </div>
              <div class="field-full">
                <label for="biz-addr">Street address</label>
                <input id="biz-addr" type="text" [(ngModel)]="form.address" name="address"
                       placeholder="1200 South Lamar Blvd" autocomplete="street-address" />
              </div>
              <div class="field field-sm">
                <label for="biz-state">State</label>
                <ng-select id="biz-state" [(ngModel)]="form.state" name="state" [items]="states" bindLabel="label" bindValue="code" placeholder="TX - Texas" [clearable]="true" (change)="onStateChange($event)"></ng-select>
              </div>
              <div class="field">
                <label for="biz-city">City</label>
                <ng-select id="biz-city" [(ngModel)]="form.city" name="city" [items]="citySuggestions()" [addTag]="true" placeholder="Select or type city..." [clearable]="true"></ng-select>
              </div>
              <div class="field field-sm" [class.has-error]="zipModel.invalid && (zipModel.touched || step2Submitted())">
                <label for="biz-zip">ZIP</label>
                <input id="biz-zip" type="text" [(ngModel)]="form.zip" name="zip"
                       #zipModel="ngModel" pattern="[0-9]{5}(-[0-9]{4})?"
                       placeholder="78704" maxlength="10" autocomplete="postal-code" />
                @if (zipModel.invalid && (zipModel.touched || step2Submitted())) {
                  <span class="field-error">Use a 5-digit ZIP or ZIP+4.</span>
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
            <p class="sub">You can change this at any time - no data migration needed.</p>
            <div class="team-tiles">
              <button
                id="tile-solo"
                type="button"
                class="team-tile"
                [class.selected]="form.teamSize === 'solo'"
                (click)="form.teamSize = 'solo'"
                [attr.aria-pressed]="form.teamSize === 'solo'">
                <span class="team-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                </span>
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
                <span class="team-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                </span>
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
      border-radius: 5px;
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
      border-radius: 5px;
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
    .field-error { color: #991b1b; font-size: 12px; font-weight: 500; }
    .field-full.has-error input, .field.has-error input {
      border-color: #b43b3b !important;
      box-shadow: 0 0 0 3px rgba(180,59,59,.12) !important;
    }
    input, select {
      height: 42px;
      padding: 0 12px;
      border: 1.5px solid #dce5ea;
      border-radius: 5px;
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
      border-radius: 5px;
      background: #fff;
      cursor: pointer;
      text-align: center;
      transition: border-color 0.15s, background 0.15s;
    }
    .team-tile:hover { border-color: #087f74; }
    .team-tile.selected { border-color: #087f74; background: #e4f5f1; }
    .team-icon { font-size: 32px; color: #087f74; }
    .team-tile strong { font-size: 16px; color: #142d3b; }
    .team-tile p { margin: 0; font-size: 13px; color: #5c7180; line-height: 1.4; }
    @media (max-width: 500px) { .team-tiles { grid-template-columns: 1fr; } }

    /* ── Footer / buttons ────────────────────────────────────────── */
    .step-footer { display: flex; justify-content: flex-end; align-items: center; gap: 12px; }
    .btn-primary {
      min-height: 46px; padding: 0 28px;
      border: 0; border-radius: 5px;
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
      border-radius: 5px; background: #fef2f2;
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
  readonly states     = US_STATES_AND_PROVINCES;
  readonly step2Submitted = signal(false);
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

  citySuggestions(): string[] {
    return (STATE_CITIES as Record<string, string[]>)[this.form.state] || [];
  }

  onStateChange(st: any): void {
    if (st?.code) {
      this.form.state = st.code;
      const cities = (STATE_CITIES as Record<string, string[]>)[st.code] || [];
      if (cities.length > 0 && !this.form.city) {
        this.form.city = cities[0];
      }
    }
  }

  next(): void {
    if (this.step() === 2) {
      this.step2Submitted.set(true);
      if (!this.form.businessName.trim()) return;
    }
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
