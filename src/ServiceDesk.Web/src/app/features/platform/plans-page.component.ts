import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  PlatformAdminApiService,
  PlatformPlanDetailResponse,
  CreatePlatformPlanRequest,
} from '../../core/platform-admin-api.service';
import { PlatformContextService } from '../../core/platform-context.service';

@Component({
  selector: 'app-platform-plans',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
<div class="page-container">
  <div class="page-header">
    <div>
      <h2>Plans & Subscription Entitlements</h2>
      <p class="subtitle">Platform pricing tiers, feature toggles, quota limits, and billing intervals.</p>
    </div>
    @if (platformContext.canViewPlans()) {
      <button type="button" class="btn-create" (click)="openCreateModal()">
        + Create Plan
      </button>
    }
  </div>

  @if (loading()) {
    <div class="state-card loading">
      <div class="spinner"></div>
      <p>Loading plans and entitlements…</p>
    </div>
  } @else if (error()) {
    <div class="state-card error">
      <p class="error-msg">⚠️ {{ error() }}</p>
      <button type="button" class="btn-retry" (click)="loadPlans()">Try Again</button>
    </div>
  } @else {
    <div class="plans-grid">
      @for (plan of plans(); track plan.id) {
        <div class="plan-card">
          <div class="plan-head">
            <div>
              <span class="plan-code">{{ plan.code }} · Rev {{ plan.revision }}</span>
              <h3>{{ plan.name }}</h3>
            </div>
            <span class="pub-badge" [class.live]="plan.isPublished">
              {{ plan.isPublished ? 'Published' : 'Draft' }}
            </span>
          </div>

          <div class="plan-price">
            <span class="amount">\${{ plan.price | number:'1.2-2' }}</span>
            <span class="interval">/ {{ plan.billingInterval }}</span>
          </div>

          <div class="entitlements-list">
            <h4>Feature Entitlements</h4>
            @for (e of plan.entitlements; track e.featureCode) {
              <div class="ent-row">
                <span class="ent-icon">{{ e.enabled ? '✓' : '✕' }}</span>
                <span class="ent-text" [class.disabled]="!e.enabled">{{ e.displayText }}</span>
              </div>
            }
          </div>
        </div>
      }
    </div>
  }

  <!-- Create Plan Modal -->
  @if (createModalOpen()) {
    <div class="modal-backdrop">
      <div class="modal-card">
        <h3>Create New Subscription Plan</h3>
        <p class="modal-desc">Define a new subscription tier with quotas and feature entitlements.</p>

        <div class="form-row">
          <div class="form-group">
            <label>Plan Code (e.g. ENTERPRISE):</label>
            <input type="text" [(ngModel)]="newPlanCode" class="modal-input" placeholder="ENTERPRISE" />
          </div>
          <div class="form-group">
            <label>Display Name:</label>
            <input type="text" [(ngModel)]="newPlanName" class="modal-input" placeholder="Enterprise Tier" />
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>Price (USD):</label>
            <input type="number" [(ngModel)]="newPlanPrice" class="modal-input" min="0" step="0.01" />
          </div>
          <div class="form-group">
            <label>Billing Interval:</label>
            <select [(ngModel)]="newPlanInterval" class="modal-input">
              <option value="Month">Monthly</option>
              <option value="Year">Annual</option>
            </select>
          </div>
        </div>

        <div class="form-group">
          <label>
            <input type="checkbox" [(ngModel)]="newPlanPublished" />
            Publish immediately for tenant checkout
          </label>
        </div>

        @if (modalError()) {
          <div class="modal-alert">{{ modalError() }}</div>
        }

        <div class="modal-actions">
          <button type="button" class="btn-cancel" (click)="closeCreateModal()">Cancel</button>
          <button
            type="button"
            class="btn-confirm"
            [disabled]="submitting() || !newPlanCode.trim() || !newPlanName.trim()"
            (click)="submitCreatePlan()">
            @if (submitting()) { Creating… } @else { Save Plan }
          </button>
        </div>
      </div>
    </div>
  }
</div>
  `,
  styles: `
.page-container { display: flex; flex-direction: column; gap: 1.5rem; }
.page-header { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem; }
h2 { font-size: 1.35rem; font-weight: 700; color: #f8fafc; margin: 0; }
.subtitle { font-size: 0.85rem; color: #94a3b8; margin: 0.25rem 0 0; }
.btn-create { padding: 0.5rem 1rem; border-radius: 6px; background: #6366f1; color: #fff; border: 0; font-weight: 600; cursor: pointer; }
.plans-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1.25rem; }
.plan-card { background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 1.5rem; display: flex; flex-direction: column; gap: 1rem; }
.plan-head { display: flex; justify-content: space-between; align-items: flex-start; }
.plan-code { font-size: 0.75rem; font-weight: 700; color: #818cf8; text-transform: uppercase; letter-spacing: 0.05em; }
.plan-card h3 { font-size: 1.25rem; font-weight: 700; color: #f8fafc; margin: 0.25rem 0 0; }
.pub-badge { font-size: 0.7rem; font-weight: 700; padding: 0.2rem 0.5rem; border-radius: 6px; background: #334155; color: #cbd5e1; }
.pub-badge.live { background: rgba(34, 197, 94, 0.15); color: #4ade80; border: 1px solid #22c55e; }
.plan-price { display: flex; align-items: baseline; gap: 0.35rem; }
.plan-price .amount { font-size: 2rem; font-weight: 800; color: #f8fafc; }
.plan-price .interval { font-size: 0.9rem; color: #94a3b8; }
.entitlements-list { border-top: 1px solid #334155; padding-top: 1rem; display: flex; flex-direction: column; gap: 0.5rem; }
.entitlements-list h4 { font-size: 0.8rem; font-weight: 700; text-transform: uppercase; color: #94a3b8; margin: 0 0 0.25rem; }
.ent-row { display: flex; align-items: center; gap: 0.5rem; font-size: 0.85rem; }
.ent-icon { font-weight: 700; color: #22c55e; width: 14px; }
.ent-text { color: #cbd5e1; }
.ent-text.disabled { color: #64748b; text-decoration: line-through; }
.state-card { background: #1e293b; border: 1px solid #334155; border-radius: 10px; padding: 3rem 1.5rem; text-align: center; color: #94a3b8; }
.spinner { width: 28px; height: 28px; border: 3px solid #334155; border-top-color: #6366f1; border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto 0.75rem; }
@keyframes spin { to { transform: rotate(360deg); } }
.modal-backdrop { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.65); display: grid; place-items: center; z-index: 50; padding: 1rem; }
.modal-card { width: 100%; max-width: 500px; background: #1e293b; border: 1px solid #475569; border-radius: 12px; padding: 1.75rem; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5); }
.modal-card h3 { margin: 0 0 0.5rem; font-size: 1.2rem; color: #f8fafc; }
.modal-desc { font-size: 0.85rem; color: #94a3b8; margin-bottom: 1.25rem; }
.form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
.form-group { margin-bottom: 1rem; }
.form-group label { display: block; font-size: 0.8rem; font-weight: 600; color: #cbd5e1; margin-bottom: 0.35rem; }
.modal-input { width: 100%; padding: 0.6rem; border-radius: 6px; background: #0f172a; border: 1px solid #334155; color: #f8fafc; font-size: 0.85rem; box-sizing: border-box; }
.modal-alert { margin-top: 0.75rem; font-size: 0.8rem; color: #f87171; }
.modal-actions { display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1.5rem; }
.btn-cancel { padding: 0.5rem 1rem; border-radius: 6px; background: transparent; border: 1px solid #475569; color: #cbd5e1; cursor: pointer; }
.btn-confirm { padding: 0.5rem 1rem; border-radius: 6px; background: #6366f1; border: 0; color: #fff; font-weight: 600; cursor: pointer; }
.btn-confirm:disabled { opacity: 0.5; cursor: not-allowed; }
  `
})
export class PlatformPlansComponent implements OnInit {
  private readonly api = inject(PlatformAdminApiService);
  readonly platformContext = inject(PlatformContextService);

  readonly plans = signal<PlatformPlanDetailResponse[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly createModalOpen = signal(false);
  newPlanCode = '';
  newPlanName = '';
  newPlanPrice = 49.0;
  newPlanInterval = 'Month';
  newPlanPublished = true;
  readonly submitting = signal(false);
  readonly modalError = signal<string | null>(null);

  ngOnInit(): void {
    this.loadPlans();
  }

  loadPlans(): void {
    this.loading.set(true);
    this.error.set(null);

    this.api.getPlans().subscribe({
      next: items => {
        this.plans.set(items);
        this.loading.set(false);
      },
      error: err => {
        this.error.set(err?.error?.detail || err?.message || 'Failed to load platform plans.');
        this.loading.set(false);
      }
    });
  }

  openCreateModal(): void {
    this.newPlanCode = '';
    this.newPlanName = '';
    this.newPlanPrice = 49.0;
    this.newPlanInterval = 'Month';
    this.newPlanPublished = true;
    this.modalError.set(null);
    this.createModalOpen.set(true);
  }

  closeCreateModal(): void {
    this.createModalOpen.set(false);
  }

  submitCreatePlan(): void {
    if (!this.newPlanCode.trim() || !this.newPlanName.trim()) return;

    this.submitting.set(true);
    this.modalError.set(null);

    const request: CreatePlatformPlanRequest = {
      code: this.newPlanCode.trim().toUpperCase(),
      name: this.newPlanName.trim(),
      billingInterval: this.newPlanInterval,
      price: this.newPlanPrice,
      currency: 'USD',
      isPublished: this.newPlanPublished,
      entitlements: [
        { featureCode: 'staff.seats', enabled: true, limitValue: 5, displayText: '5 staff seats' },
        { featureCode: 'storage.bytes', enabled: true, limitValue: 5368709120, displayText: '5 GB storage' },
        { featureCode: 'jobs.per_period', enabled: true, limitValue: 500, displayText: '500 jobs per billing period' },
        { featureCode: 'estimates.enabled', enabled: true, displayText: 'Estimates enabled' },
        { featureCode: 'exports.enabled', enabled: true, displayText: 'Data export enabled' },
      ]
    };

    this.api.createPlan(request).subscribe({
      next: () => {
        this.submitting.set(false);
        this.closeCreateModal();
        this.loadPlans();
      },
      error: err => {
        this.modalError.set(err?.error?.detail || err?.message || 'Failed to create plan.');
        this.submitting.set(false);
      }
    });
  }
}
