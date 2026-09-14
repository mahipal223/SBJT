import { CurrencyPipe, DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { SubscriptionOverview, SubscriptionPlan, WorkApiService } from '../core/work-api.service';

const getErrorMessage = (error: unknown) => {
  if (error instanceof HttpErrorResponse) {
    return error.error?.detail || error.error?.title || 'Failed to complete subscription request.';
  }
  return 'An unexpected error occurred. Please try again.';
};

@Component({
  selector: 'app-subscription-live',
  imports: [CurrencyPipe, DatePipe],
  template: `
    <main class="page">
      <header class="page-head">
        <div>
          <p class="eyebrow">Billing & Entitlements</p>
          <h1>Subscription</h1>
          <p>Manage your SaaS subscription, monitor live usage quotas, and safely transition between plans.</p>
        </div>
        <div class="page-actions">
          <button class="btn" (click)="load()">Refresh</button>
        </div>
      </header>

      @if(message()){
        <div class="callout section-gap" style="border-color:var(--teal);background:var(--teal-tint);color:var(--navy)">
          <strong>Success:</strong> {{ message() }}
        </div>
      }

      @if(blockers().length > 0){
        <div class="callout error-text section-gap" style="border-left:4px solid var(--red);background:var(--red-bg);color:#7b2a2a;margin-bottom:26px">
          <strong style="color:var(--red)">Plan change blocked:</strong>
          <ul style="margin:8px 0 0 16px;padding:0">
            @for(b of blockers(); track b){
              <li style="margin-bottom:4px">{{ b }}</li>
            }
          </ul>
        </div>
      }

      @if(error()){
        <div class="callout error-text section-gap" style="border-left:4px solid var(--red);background:var(--red-bg);color:#7b2a2a;margin-bottom:26px">
          {{ error() }}
        </div>
      }

      @if(loading()){
        <section class="card card-body muted">Loading subscription & quota details…</section>
      } @else if(overview(); as data){
        @if(hasExceededQuota(data)){
          <div class="callout warning-banner section-gap" style="border-left:4px solid var(--amber);background:var(--amber-bg);color:#7a4b0a;padding:16px 20px;border-radius:10px;margin-bottom:20px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px">
            <div>
              <strong style="font-size:15px">⚠️ Plan quota limit reached</strong>
              <p style="margin:4px 0 0;font-size:13px">One or more plan limits have been reached in your workspace. Upgrade your plan to prevent service interruptions.</p>
            </div>
            <button class="btn primary" (click)="scrollToPlans()">Upgrade plan now</button>
          </div>
        }

        <section class="split">
          <div class="grid">
            <article class="card">
              <div class="card-head">
                <div>
                  <p class="eyebrow">Current Active Tier</p>
                  <h2>{{ data.subscription.planName }} Plan</h2>
                </div>
                <span class="badge"
                      [class.amber]="data.subscription.status==='PastDue'"
                      [class.red]="data.subscription.status==='ReadOnly'||data.subscription.status==='Ended'">
                  {{ data.subscription.status }}
                </span>
              </div>

              <div class="card-body">
                <div class="price">
                  <strong>{{ data.subscription.price | currency }}</strong>
                  <span>/ {{ data.subscription.billingInterval.toLowerCase() }}<br><small>Billed monthly</small></span>
                </div>

                <div class="period-info" style="margin:14px 0;font-size:12px;color:var(--muted);display:grid;gap:4px">
                  <span>Period: <b>{{ data.subscription.periodStartsAt | date:'MMM d, y' }}</b> – <b>{{ data.subscription.periodEndsAt | date:'MMM d, y' }}</b></span>
                  @if(data.subscription.graceEndsAt){
                    <span style="color:var(--red);font-weight:700">Payment grace period active through {{ data.subscription.graceEndsAt | date:'medium' }}.</span>
                  }
                  @if(data.subscription.cancelAtPeriodEnd){
                    <span style="color:var(--amber);font-weight:700">Scheduled for cancellation at period end.</span>
                  }
                </div>

                @if(data.subscription.isReadOnly){
                  <div class="callout error-text" style="margin-top:12px">
                    <strong>Workspace is Read-Only:</strong> Operational writes are disabled due to expired billing. Update payment or reactivate to resume work.
                  </div>
                }
              </div>
            </article>

            <article class="card">
              <div class="card-head">
                <h2>Plan Quotas & Live Usage</h2>
                <small class="muted">Updated live from workspace data</small>
              </div>
              <div class="card-body grid">
                @for(u of data.usage; track u.featureCode){
                  <div class="usage">
                    <div class="usage-head" style="display:flex;justify-content:space-between;margin-bottom:6px">
                      <b>{{ u.name }}</b>
                      <span [style.color]="u.isExceeded ? 'var(--red)' : ''" style="font-size:12px;font-weight:600">{{ u.description }}</span>
                    </div>
                    <div class="progress" style="height:8px;border-radius:4px;background:#e9f0f3;overflow:hidden">
                      <span [style.width.%]="u.percentageUsed"
                            [style.background]="u.percentageUsed > 80 ? 'var(--amber)' : 'var(--teal)'"
                            style="display:block;height:100%;transition:width .3s ease"></span>
                    </div>
                  </div>
                }
              </div>
            </article>
          </div>

          <aside class="grid">
            <article class="card">
              <div class="card-head">
                <h2>Included Features</h2>
              </div>
              <div class="card-body list">
                @for(p of data.availablePlans; track p.id){
                  @if(p.id === data.subscription.planId){
                    @for(e of p.entitlements; track e.featureCode){
                      <div class="list-row">
                        <span>{{ e.enabled ? '✓' : '✗' }} {{ e.displayText }}</span>
                        <b [style.color]="e.enabled ? 'var(--teal)' : 'var(--muted)'">{{ e.enabled ? 'Enabled' : 'Disabled' }}</b>
                      </div>
                    }
                  }
                }
              </div>
            </article>

            <article class="card">
              <div class="card-head">
                <h2>Lifecycle Sandbox (Demo)</h2>
              </div>
              <div class="card-body grid">
                <p class="muted" style="font-size:12px;line-height:1.4">
                  Test SaaS webhook and grace period behaviors across states.
                </p>
                <div class="page-actions" style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
                  <button class="btn small" [disabled]="changing()" (click)="simulate('payment_failed')">Simulate Fail</button>
                  <button class="btn small" [disabled]="changing()" (click)="simulate('payment_succeeded')">Simulate Paid</button>
                  <button class="btn small" [disabled]="changing()" (click)="simulate('expire')">Simulate ReadOnly</button>
                  <button class="btn small" [disabled]="changing()" (click)="simulate('reactivate')">Reactivate</button>
                </div>
              </div>
            </article>
          </aside>
        </section>

        <section id="available-plans" class="card section-gap">
          <div class="card-head">
            <h2>Available Plans & Tiers</h2>
            <span class="muted">Safe upgrades and downgrade blocker protections</span>
          </div>

          <div class="grid cols-3" style="padding:20px;gap:18px">
            @for(p of data.availablePlans; track p.id){
              <article class="plan-card" [class.current-plan-card]="p.id === data.subscription.planId"
                       style="display:flex;flex-direction:column;padding:22px;border:1px solid var(--line);border-radius:14px;background:#fff;position:relative">
                @if(p.id === data.subscription.planId){
                  <span class="badge" style="position:absolute;top:16px;right:16px">Current Plan</span>
                }
                <h3 style="margin:0 0 6px 0;font-size:20px">{{ p.name }}</h3>
                <div style="font-size:32px;font-weight:800;font-family:Manrope;margin-bottom:14px;color:var(--navy)">
                  {{ p.price | currency }} <span style="font-size:13px;font-weight:500;color:var(--muted)">/ mo</span>
                </div>

                <ul class="plan-features" style="list-style:none;padding:0;margin:0 0 20px 0;display:grid;gap:8px;font-size:13px;flex:1">
                  @for(e of p.entitlements; track e.featureCode){
                    <li style="display:flex;align-items:center;gap:8px" [style.color]="e.enabled ? 'var(--navy)' : 'var(--muted)'">
                      <span [style.color]="e.enabled ? 'var(--teal)' : '#ccc'" style="font-weight:700">{{ e.enabled ? '✓' : '–' }}</span>
                      {{ e.displayText }}
                    </li>
                  }
                </ul>

                @if(p.id === data.subscription.planId){
                  <button class="btn" disabled style="width:100%;opacity:.7">Current Active Plan</button>
                } @else {
                  <button class="btn primary" [disabled]="changing()" (click)="selectPlan(p)" style="width:100%">
                    {{ changing() ? 'Switching…' : (p.price > data.subscription.price ? 'Upgrade to ' + p.name : 'Switch to ' + p.name) }}
                  </button>
                  <button class="btn stripe-btn" [disabled]="changing()" (click)="checkoutWithStripe(p)"
                          style="margin-top:8px;width:100%;background:#635bff;color:#fff;border:none;font-weight:700">
                    💳 Checkout with Stripe
                  </button>
                }
              </article>
            }
          </div>
        </section>
      }
    </main>
  `,
  styles: `
    .price {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 8px;
    }
    .price > strong {
      font-family: Manrope, sans-serif;
      font-size: 44px;
      color: var(--navy);
    }
    .price span {
      color: var(--muted);
      line-height: 1.2;
    }
    .current-plan-card {
      border-color: var(--teal) !important;
      box-shadow: 0 0 0 2px var(--teal) !important;
    }
  `
})
export class SubscriptionLivePage {
  private readonly api = inject(WorkApiService);

  readonly overview = signal<SubscriptionOverview | null>(null);
  readonly loading = signal(true);
  readonly changing = signal(false);
  readonly error = signal('');
  readonly message = signal('');
  readonly blockers = signal<string[]>([]);

  constructor() {
    this.load();
  }

  load() {
    this.loading.set(true);
    this.error.set('');
    this.api.getSubscriptionOverview().subscribe({
      next: data => {
        this.overview.set(data);
        this.loading.set(false);
      },
      error: err => {
        this.error.set(getErrorMessage(err));
        this.loading.set(false);
      }
    });
  }

  selectPlan(plan: SubscriptionPlan) {
    this.changing.set(true);
    this.error.set('');
    this.message.set('');
    this.blockers.set([]);

    this.api.changePlan(plan.id).subscribe({
      next: res => {
        this.changing.set(false);
        if (res.success) {
          this.message.set(res.message);
          this.load();
        } else {
          this.blockers.set(res.blockers);
        }
      },
      error: err => {
        this.changing.set(false);
        this.error.set(getErrorMessage(err));
      }
    });
  }

  simulate(eventType: string) {
    this.changing.set(true);
    this.error.set('');
    this.message.set('');
    this.blockers.set([]);

    this.api.simulateBillingEvent(eventType).subscribe({
      next: () => {
        this.changing.set(false);
        this.message.set(`Simulated billing event '${eventType}' successfully.`);
        this.load();
      },
      error: err => {
        this.changing.set(false);
        this.error.set(getErrorMessage(err));
      }
    });
  }

  hasExceededQuota(data: SubscriptionOverview): boolean {
    return (
      data.subscription.isReadOnly ||
      data.usage.some(u => u.isExceeded || u.percentageUsed >= 100)
    );
  }

  scrollToPlans(): void {
    const el = document.getElementById('available-plans');
    el?.scrollIntoView({ behavior: 'smooth' });
  }

  checkoutWithStripe(plan: SubscriptionPlan): void {
    this.message.set(
      `Redirecting to secure Stripe Checkout for ${plan.name} (${plan.price}/mo)… (Demo simulation)`
    );
    setTimeout(() => {
      this.selectPlan(plan);
    }, 900);
  }
}
