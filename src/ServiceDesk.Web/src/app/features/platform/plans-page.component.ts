import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  PlatformAdminApiService,
  PlatformPlanDetailResponse,
  CreatePlatformPlanRequest,
  UpdatePlatformPlanRequest,
  PlatformPlanEntitlementRow
} from '../../core/platform-admin-api.service';
import { PlatformContextService } from '../../core/platform-context.service';

interface PlanFormData {
  code: string;
  name: string;
  price: number;
  interval: string;
  isPublished: boolean;
  staffSeats: number;
  jobsPerPeriod: number;
  storageGb: number;
  estimatesEnabled: boolean;
  exportsEnabled: boolean;
  reportsEnabled: boolean;
  apiEnabled: boolean;
}

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
      <div class="header-actions">
        <button type="button" class="btn-refresh" (click)="loadPlans()" [disabled]="loading()">Refresh</button>
        <button type="button" class="btn-create" (click)="openCreateModal()">+ Create Plan</button>
      </div>
    }
  </div>

  @if (successMessage()) {
    <div class="alert alert-success">{{ successMessage() }}</div>
  }
  @if (actionError()) {
    <div class="alert alert-danger">{{ actionError() }}</div>
  }

  @if (loading()) {
    <div class="state-card loading">
      <div class="spinner"></div>
      <p>Loading plans and entitlements…</p>
    </div>
  } @else if (error()) {
    <div class="state-card error">
      <p class="error-msg">{{ error() }}</p>
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
            <h4>Feature Entitlements & Quotas</h4>
            @for (e of plan.entitlements; track e.featureCode) {
              <div class="ent-row">
                <span class="ent-icon" [class.active]="e.enabled">{{ e.enabled ? '✓' : '✕' }}</span>
                <span class="ent-text" [class.disabled]="!e.enabled">{{ e.displayText }}</span>
              </div>
            }
          </div>

          <div class="plan-card-footer">
            <button type="button" class="btn-card edit" (click)="openEditModal(plan)">
              Edit Plan
            </button>
            <button
              type="button"
              class="btn-card toggle"
              [class.unpub]="plan.isPublished"
              (click)="togglePublish(plan)">
              {{ plan.isPublished ? 'Unpublish' : 'Publish' }}
            </button>
            <button type="button" class="btn-card delete" (click)="confirmDelete(plan)">
              Delete
            </button>
          </div>
        </div>
      }
    </div>
  }

  <!-- Create Plan Modal -->
  @if (createModalOpen()) {
    <div class="modal-backdrop" (click)="closeCreateModal()">
      <div class="modal-card" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h3>Create New Subscription Plan</h3>
          <button type="button" class="btn-close" (click)="closeCreateModal()">×</button>
        </div>
        <p class="modal-desc">Define a new subscription tier with quotas and feature entitlements.</p>

        <div class="modal-body">
          <div class="form-row">
            <div class="form-group" [class.has-error]="formErrors().code">
              <label for="createCode">Plan Code *</label>
              <input id="createCode" type="text" [(ngModel)]="createForm.code" class="modal-input" placeholder="e.g. ENTERPRISE" />
              @if (formErrors().code) { <span class="field-error">{{ formErrors().code }}</span> }
            </div>
            <div class="form-group" [class.has-error]="formErrors().name">
              <label for="createName">Display Name *</label>
              <input id="createName" type="text" [(ngModel)]="createForm.name" class="modal-input" placeholder="e.g. Enterprise Tier" />
              @if (formErrors().name) { <span class="field-error">{{ formErrors().name }}</span> }
            </div>
          </div>

          <div class="form-row">
            <div class="form-group" [class.has-error]="formErrors().price">
              <label for="createPrice">Price (USD) *</label>
              <input id="createPrice" type="number" [(ngModel)]="createForm.price" class="modal-input" min="0" step="0.01" />
              @if (formErrors().price) { <span class="field-error">{{ formErrors().price }}</span> }
            </div>
            <div class="form-group">
              <label for="createInterval">Billing Interval</label>
              <select id="createInterval" [(ngModel)]="createForm.interval" class="modal-input">
                <option value="Month">Monthly</option>
                <option value="Year">Annual</option>
              </select>
            </div>
          </div>

          <div class="section-title">Quota Limits</div>
          <div class="form-row-3">
            <div class="form-group" [class.has-error]="formErrors().seats">
              <label for="createSeats">Staff Seats *</label>
              <input id="createSeats" type="number" [(ngModel)]="createForm.staffSeats" class="modal-input" min="1" />
              @if (formErrors().seats) { <span class="field-error">{{ formErrors().seats }}</span> }
            </div>
            <div class="form-group" [class.has-error]="formErrors().jobs">
              <label for="createJobs">Jobs / Period *</label>
              <input id="createJobs" type="number" [(ngModel)]="createForm.jobsPerPeriod" class="modal-input" min="1" />
              @if (formErrors().jobs) { <span class="field-error">{{ formErrors().jobs }}</span> }
            </div>
            <div class="form-group" [class.has-error]="formErrors().storage">
              <label for="createStorage">Storage (GB) *</label>
              <input id="createStorage" type="number" [(ngModel)]="createForm.storageGb" class="modal-input" min="1" />
              @if (formErrors().storage) { <span class="field-error">{{ formErrors().storage }}</span> }
            </div>
          </div>

          <div class="section-title">Feature Toggles</div>
          <div class="feature-checkboxes">
            <label class="checkbox-label">
              <input type="checkbox" [(ngModel)]="createForm.estimatesEnabled" />
              <span>Estimates & Quotes</span>
            </label>
            <label class="checkbox-label">
              <input type="checkbox" [(ngModel)]="createForm.exportsEnabled" />
              <span>Data Export</span>
            </label>
            <label class="checkbox-label">
              <input type="checkbox" [(ngModel)]="createForm.reportsEnabled" />
              <span>Advanced Reports</span>
            </label>
            <label class="checkbox-label">
              <input type="checkbox" [(ngModel)]="createForm.apiEnabled" />
              <span>API Webhook Access</span>
            </label>
          </div>

          <div class="form-group publish-toggle">
            <label class="checkbox-label">
              <input type="checkbox" [(ngModel)]="createForm.isPublished" />
              <strong>Publish immediately for tenant checkout</strong>
            </label>
          </div>
        </div>

        @if (modalError()) {
          <div class="modal-alert">{{ modalError() }}</div>
        }

        <div class="modal-actions">
          <button type="button" class="btn-cancel" (click)="closeCreateModal()">Cancel</button>
          <button type="button" class="btn-confirm" [disabled]="submitting()" (click)="submitCreatePlan()">
            {{ submitting() ? 'Creating…' : 'Save Plan' }}
          </button>
        </div>
      </div>
    </div>
  }

  <!-- Edit Plan Modal -->
  @if (editModalOpen() && selectedPlan()) {
    <div class="modal-backdrop" (click)="closeEditModal()">
      <div class="modal-card" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h3>Edit Plan: {{ selectedPlan()?.code }}</h3>
          <button type="button" class="btn-close" (click)="closeEditModal()">×</button>
        </div>
        <p class="modal-desc">Update plan pricing, billing interval, and adjust quota entitlements.</p>

        <div class="modal-body">
          <div class="form-row">
            <div class="form-group" [class.has-error]="formErrors().name">
              <label for="editName">Display Name *</label>
              <input id="editName" type="text" [(ngModel)]="editForm.name" class="modal-input" />
              @if (formErrors().name) { <span class="field-error">{{ formErrors().name }}</span> }
            </div>
            <div class="form-group" [class.has-error]="formErrors().price">
              <label for="editPrice">Price (USD) *</label>
              <input id="editPrice" type="number" [(ngModel)]="editForm.price" class="modal-input" min="0" step="0.01" />
              @if (formErrors().price) { <span class="field-error">{{ formErrors().price }}</span> }
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label for="editInterval">Billing Interval</label>
              <select id="editInterval" [(ngModel)]="editForm.interval" class="modal-input">
                <option value="Month">Monthly</option>
                <option value="Year">Annual</option>
              </select>
            </div>
            <div class="form-group publish-toggle-inline">
              <label class="checkbox-label">
                <input type="checkbox" [(ngModel)]="editForm.isPublished" />
                <span>Published on Platform</span>
              </label>
            </div>
          </div>

          <div class="section-title">Quota Limits</div>
          <div class="form-row-3">
            <div class="form-group" [class.has-error]="formErrors().seats">
              <label for="editSeats">Staff Seats *</label>
              <input id="editSeats" type="number" [(ngModel)]="editForm.staffSeats" class="modal-input" min="1" />
              @if (formErrors().seats) { <span class="field-error">{{ formErrors().seats }}</span> }
            </div>
            <div class="form-group" [class.has-error]="formErrors().jobs">
              <label for="editJobs">Jobs / Period *</label>
              <input id="editJobs" type="number" [(ngModel)]="editForm.jobsPerPeriod" class="modal-input" min="1" />
              @if (formErrors().jobs) { <span class="field-error">{{ formErrors().jobs }}</span> }
            </div>
            <div class="form-group" [class.has-error]="formErrors().storage">
              <label for="editStorage">Storage (GB) *</label>
              <input id="editStorage" type="number" [(ngModel)]="editForm.storageGb" class="modal-input" min="1" />
              @if (formErrors().storage) { <span class="field-error">{{ formErrors().storage }}</span> }
            </div>
          </div>

          <div class="section-title">Feature Toggles</div>
          <div class="feature-checkboxes">
            <label class="checkbox-label">
              <input type="checkbox" [(ngModel)]="editForm.estimatesEnabled" />
              <span>Estimates & Quotes</span>
            </label>
            <label class="checkbox-label">
              <input type="checkbox" [(ngModel)]="editForm.exportsEnabled" />
              <span>Data Export</span>
            </label>
            <label class="checkbox-label">
              <input type="checkbox" [(ngModel)]="editForm.reportsEnabled" />
              <span>Advanced Reports</span>
            </label>
            <label class="checkbox-label">
              <input type="checkbox" [(ngModel)]="editForm.apiEnabled" />
              <span>API Webhook Access</span>
            </label>
          </div>
        </div>

        @if (modalError()) {
          <div class="modal-alert">{{ modalError() }}</div>
        }

        <div class="modal-actions">
          <button type="button" class="btn-cancel" (click)="closeEditModal()">Cancel</button>
          <button type="button" class="btn-confirm" [disabled]="submitting()" (click)="submitEditPlan()">
            {{ submitting() ? 'Saving…' : 'Save Changes' }}
          </button>
        </div>
      </div>
    </div>
  }
</div>
  `,
  styles: `
.page-container { display: flex; flex-direction: column; gap: 1.25rem; width: 100%; }
.page-header { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem; }
h2 { font-size: 20px; font-weight: 800; color: var(--navy); margin: 0; font-family: 'Manrope', sans-serif; }
.subtitle { font-size: 13px; color: var(--ink-light); margin: 4px 0 0; }
.header-actions { display: flex; gap: 10px; }
.btn-refresh { padding: 8px 14px; border-radius: 5px; background: #fff; border: 1px solid var(--line); color: var(--navy); font-size: 13px; font-weight: 600; cursor: pointer; }
.btn-refresh:hover:not(:disabled) { background: #f5f8fa; }
.btn-create { padding: 8px 16px; border-radius: 5px; background: var(--teal); color: #fff; border: 0; font-weight: 700; font-size: 13px; cursor: pointer; }
.btn-create:hover { background: var(--teal-dark); }
.plans-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(290px, 1fr)); gap: 1rem; width: 100%; }
.plan-card { background: #fff; border: 1px solid var(--line); border-radius: 5px; padding: 1.25rem; display: flex; flex-direction: column; gap: 0.85rem; }
.plan-head { display: flex; justify-content: space-between; align-items: flex-start; }
.plan-code { font-size: 11px; font-weight: 800; color: var(--teal-dark); text-transform: uppercase; letter-spacing: 0.05em; }
.plan-card h3 { font-size: 17px; font-weight: 800; color: var(--navy); margin: 2px 0 0; font-family: 'Manrope', sans-serif; }
.pub-badge { font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 5px; background: #eef2f5; color: var(--ink-light); border: 1px solid #d5e1e8; }
.pub-badge.live { background: var(--teal-tint); color: var(--teal-dark); border-color: #b7e8de; }
.plan-price { display: flex; align-items: baseline; gap: 0.35rem; }
.plan-price .amount { font-size: 28px; font-weight: 800; color: var(--navy); font-family: 'Manrope', sans-serif; }
.plan-price .interval { font-size: 12px; color: var(--ink-light); }
.entitlements-list { border-top: 1px solid var(--line); padding-top: 0.75rem; display: flex; flex-direction: column; gap: 0.4rem; }
.entitlements-list h4 { font-size: 10px; font-weight: 800; text-transform: uppercase; color: var(--ink-light); margin: 0 0 4px; letter-spacing: .05em; }
.ent-row { display: flex; align-items: center; gap: 0.45rem; font-size: 12px; }
.ent-icon { font-weight: 800; color: #a0aec0; width: 14px; }
.ent-icon.active { color: var(--teal-dark); }
.ent-text { color: var(--ink); }
.ent-text.disabled { color: var(--ink-light); text-decoration: line-through; opacity: 0.55; }
.plan-card-footer { border-top: 1px solid var(--line); padding-top: 0.75rem; display: flex; gap: 6px; margin-top: auto; }
.btn-card { flex: 1; height: 30px; border-radius: 5px; font-size: 11px; font-weight: 600; cursor: pointer; border: 1px solid var(--line); background: #fff; color: var(--navy); }
.btn-card:hover { background: #f0f6fa; }
.btn-card.toggle.unpub { color: #856404; border-color: #ffeeba; }
.btn-card.delete { color: var(--red); border-color: #ffd0d0; flex: 0.8; }
.btn-card.delete:hover { background: var(--red-bg); }
.state-card { background: #fff; border: 1px solid var(--line); border-radius: 5px; padding: 3rem 1.5rem; text-align: center; color: var(--ink-light); }
.spinner { width: 26px; height: 26px; border: 3px solid var(--line); border-top-color: var(--teal); border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto 0.75rem; }
@keyframes spin { to { transform: rotate(360deg); } }
.alert { padding: 10px 14px; border-radius: 5px; font-size: 12px; font-weight: 600; }
.alert-success { background: #e6f7f2; color: #0a735e; border: 1px solid #a9e4d5; }
.alert-danger { background: #fde8e8; color: #9b1c1c; border: 1px solid #f8b4b4; }
.modal-backdrop { position: fixed; inset: 0; background: rgba(10, 28, 36, 0.55); display: flex; align-items: center; justify-content: center; z-index: 50; padding: 1rem; }
.modal-card { width: 100%; max-width: 520px; max-height: 90vh; background: #fff; border: 1px solid var(--line); border-radius: 5px; box-shadow: 0 16px 36px rgba(10,28,36,.22); display: flex; flex-direction: column; overflow: hidden; }
.modal-header { display: flex; align-items: center; justify-content: space-between; padding: 14px 18px; border-bottom: 1px solid var(--line); background: #fafbfc; }
.modal-header h3 { margin: 0; font-size: 15px; font-weight: 800; color: var(--navy); font-family: 'Manrope', sans-serif; }
.btn-close { background: transparent; border: 0; font-size: 20px; color: var(--ink-light); cursor: pointer; }
.modal-desc { font-size: 12px; color: var(--ink-light); margin: 10px 18px 0; }
.modal-body { padding: 14px 18px; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; }
.form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.form-row-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; }
.form-group { display: flex; flex-direction: column; gap: 3px; }
.form-group label { font-size: 11px; font-weight: 700; color: var(--navy); }
.modal-input { height: 34px; padding: 0 10px; border-radius: 5px; border: 1px solid var(--line); font-size: 13px; color: var(--ink); box-sizing: border-box; }
.form-group.has-error .modal-input { border-color: var(--red); box-shadow: 0 0 0 1px var(--red); }
.field-error { font-size: 10px; font-weight: 600; color: var(--red); }
.section-title { font-size: 11px; font-weight: 800; text-transform: uppercase; color: var(--ink-light); border-bottom: 1px solid var(--line); padding-bottom: 3px; margin-top: 4px; letter-spacing: .05em; }
.feature-checkboxes { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
.checkbox-label { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--navy); cursor: pointer; }
.publish-toggle { margin-top: 4px; padding: 6px 10px; background: #f5f8fa; border: 1px solid var(--line); border-radius: 5px; }
.publish-toggle-inline { display: flex; align-items: flex-end; padding-bottom: 6px; }
.modal-alert { margin: 0 18px; padding: 8px 12px; background: #fde8e8; border: 1px solid #f8b4b4; border-radius: 5px; font-size: 11px; color: #9b1c1c; }
.modal-actions { display: flex; justify-content: flex-end; gap: 8px; padding: 12px 18px; border-top: 1px solid var(--line); background: #fafbfc; }
.btn-cancel { height: 34px; padding: 0 14px; border-radius: 5px; background: #fff; border: 1px solid var(--line); color: var(--navy); font-weight: 600; font-size: 12px; cursor: pointer; }
.btn-confirm { height: 34px; padding: 0 16px; border-radius: 5px; background: var(--teal); border: 0; color: #fff; font-weight: 700; font-size: 12px; cursor: pointer; }
.btn-confirm:hover:not(:disabled) { background: var(--teal-dark); }
.btn-confirm:disabled { opacity: 0.5; cursor: not-allowed; }
  `
})
export class PlatformPlansComponent implements OnInit {
  private readonly api = inject(PlatformAdminApiService);
  readonly platformContext = inject(PlatformContextService);

  readonly plans = signal<PlatformPlanDetailResponse[]>([]);
  readonly loading = signal(false);
  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);
  readonly actionError = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);

  // Create Modal
  readonly createModalOpen = signal(false);
  readonly createForm: PlanFormData = {
    code: '',
    name: '',
    price: 49.0,
    interval: 'Month',
    isPublished: true,
    staffSeats: 5,
    jobsPerPeriod: 500,
    storageGb: 5,
    estimatesEnabled: true,
    exportsEnabled: true,
    reportsEnabled: false,
    apiEnabled: false
  };

  // Edit Modal
  readonly editModalOpen = signal(false);
  readonly selectedPlan = signal<PlatformPlanDetailResponse | null>(null);
  readonly editForm: PlanFormData = {
    code: '',
    name: '',
    price: 49.0,
    interval: 'Month',
    isPublished: true,
    staffSeats: 5,
    jobsPerPeriod: 500,
    storageGb: 5,
    estimatesEnabled: true,
    exportsEnabled: true,
    reportsEnabled: false,
    apiEnabled: false
  };

  readonly modalError = signal<string | null>(null);
  readonly formErrors = signal<{ code?: string; name?: string; price?: string; seats?: string; jobs?: string; storage?: string }>({});

  ngOnInit(): void {
    this.loadPlans();
  }

  loadPlans(): void {
    this.loading.set(true);
    this.error.set(null);
    this.actionError.set(null);

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
    this.formErrors.set({});
    this.modalError.set(null);
    this.createForm.code = '';
    this.createForm.name = '';
    this.createForm.price = 49.0;
    this.createForm.interval = 'Month';
    this.createForm.isPublished = true;
    this.createForm.staffSeats = 5;
    this.createForm.jobsPerPeriod = 500;
    this.createForm.storageGb = 5;
    this.createForm.estimatesEnabled = true;
    this.createForm.exportsEnabled = true;
    this.createForm.reportsEnabled = false;
    this.createForm.apiEnabled = false;
    this.createModalOpen.set(true);
  }

  closeCreateModal(): void {
    this.createModalOpen.set(false);
  }

  openEditModal(plan: PlatformPlanDetailResponse): void {
    this.formErrors.set({});
    this.modalError.set(null);
    this.selectedPlan.set(plan);

    // Extract quotas & feature flags from plan entitlements
    const seats = plan.entitlements.find(e => e.featureCode === 'staff.seats')?.limitValue ?? 1;
    const jobs = plan.entitlements.find(e => e.featureCode === 'jobs.per_period')?.limitValue ?? 100;
    const storageBytes = plan.entitlements.find(e => e.featureCode === 'storage.bytes')?.limitValue ?? 1073741824;
    const storageGb = Math.max(1, Math.round(storageBytes / 1073741824));

    const est = plan.entitlements.find(e => e.featureCode === 'estimates.enabled')?.enabled ?? false;
    const exp = plan.entitlements.find(e => e.featureCode === 'exports.enabled')?.enabled ?? false;
    const rep = plan.entitlements.find(e => e.featureCode === 'reports.advanced.enabled')?.enabled ?? false;
    const api = plan.entitlements.find(e => e.featureCode === 'api.access.enabled')?.enabled ?? false;

    this.editForm.code = plan.code;
    this.editForm.name = plan.name;
    this.editForm.price = plan.price;
    this.editForm.interval = plan.billingInterval;
    this.editForm.isPublished = plan.isPublished;
    this.editForm.staffSeats = Number(seats);
    this.editForm.jobsPerPeriod = Number(jobs);
    this.editForm.storageGb = storageGb;
    this.editForm.estimatesEnabled = est;
    this.editForm.exportsEnabled = exp;
    this.editForm.reportsEnabled = rep;
    this.editForm.apiEnabled = api;

    this.editModalOpen.set(true);
  }

  closeEditModal(): void {
    this.editModalOpen.set(false);
    this.selectedPlan.set(null);
  }

  private validateForm(form: PlanFormData, isCreate: boolean): boolean {
    const errors: { code?: string; name?: string; price?: string; seats?: string; jobs?: string; storage?: string } = {};

    if (isCreate) {
      if (!form.code || !form.code.trim()) {
        errors.code = 'Plan code is required.';
      } else if (!/^[A-Z0-9_-]+$/i.test(form.code.trim())) {
        errors.code = 'Alphanumeric and dashes only.';
      }
    }
    if (!form.name || !form.name.trim()) {
      errors.name = 'Display name is required.';
    }
    if (form.price === null || form.price === undefined || form.price < 0) {
      errors.price = 'Price must be $0 or greater.';
    }
    if (!form.staffSeats || form.staffSeats < 1) {
      errors.seats = 'At least 1 staff seat.';
    }
    if (!form.jobsPerPeriod || form.jobsPerPeriod < 1) {
      errors.jobs = 'At least 1 job per period.';
    }
    if (!form.storageGb || form.storageGb < 1) {
      errors.storage = 'At least 1 GB.';
    }

    this.formErrors.set(errors);
    return Object.keys(errors).length === 0;
  }

  private buildEntitlements(form: PlanFormData): PlatformPlanEntitlementRow[] {
    const rows: PlatformPlanEntitlementRow[] = [
      {
        featureCode: 'staff.seats',
        enabled: true,
        limitValue: form.staffSeats,
        displayText: `${form.staffSeats} staff seat${form.staffSeats === 1 ? '' : 's'}`
      },
      {
        featureCode: 'jobs.per_period',
        enabled: true,
        limitValue: form.jobsPerPeriod,
        displayText: `${form.jobsPerPeriod.toLocaleString()} jobs per billing period`
      },
      {
        featureCode: 'storage.bytes',
        enabled: true,
        limitValue: form.storageGb * 1073741824,
        displayText: `${form.storageGb} GB storage`
      },
      {
        featureCode: 'estimates.enabled',
        enabled: form.estimatesEnabled,
        displayText: form.estimatesEnabled ? 'Estimates enabled' : 'Estimates disabled'
      },
      {
        featureCode: 'exports.enabled',
        enabled: form.exportsEnabled,
        displayText: form.exportsEnabled ? 'Data export enabled' : 'Data export disabled'
      },
      {
        featureCode: 'reports.advanced.enabled',
        enabled: form.reportsEnabled,
        displayText: form.reportsEnabled ? 'Advanced reports enabled' : 'Advanced reports disabled'
      }
    ];

    if (form.apiEnabled) {
      rows.push({
        featureCode: 'api.access.enabled',
        enabled: true,
        displayText: 'API webhook access enabled'
      });
    }

    return rows;
  }

  submitCreatePlan(): void {
    if (!this.validateForm(this.createForm, true)) return;

    this.submitting.set(true);
    this.modalError.set(null);

    const request: CreatePlatformPlanRequest = {
      code: this.createForm.code.trim().toUpperCase(),
      name: this.createForm.name.trim(),
      billingInterval: this.createForm.interval,
      price: this.createForm.price,
      currency: 'USD',
      isPublished: this.createForm.isPublished,
      entitlements: this.buildEntitlements(this.createForm)
    };

    this.api.createPlan(request).subscribe({
      next: (created) => {
        this.submitting.set(false);
        this.closeCreateModal();
        this.successMessage.set(`Plan "${created.name}" created successfully.`);
        this.loadPlans();
        setTimeout(() => this.successMessage.set(null), 4000);
      },
      error: err => {
        this.modalError.set(err?.error?.detail || err?.message || 'Failed to create plan.');
        this.submitting.set(false);
      }
    });
  }

  submitEditPlan(): void {
    const plan = this.selectedPlan();
    if (!plan) return;
    if (!this.validateForm(this.editForm, false)) return;

    this.submitting.set(true);
    this.modalError.set(null);

    const request: UpdatePlatformPlanRequest = {
      name: this.editForm.name.trim(),
      billingInterval: this.editForm.interval,
      price: this.editForm.price,
      currency: 'USD',
      isPublished: this.editForm.isPublished,
      entitlements: this.buildEntitlements(this.editForm)
    };

    this.api.updatePlan(plan.id, request).subscribe({
      next: (updated) => {
        this.submitting.set(false);
        this.closeEditModal();
        this.successMessage.set(`Plan "${updated.name}" updated successfully.`);
        this.loadPlans();
        setTimeout(() => this.successMessage.set(null), 4000);
      },
      error: err => {
        this.modalError.set(err?.error?.detail || err?.message || 'Failed to update plan.');
        this.submitting.set(false);
      }
    });
  }

  togglePublish(plan: PlatformPlanDetailResponse): void {
    const nextState = !plan.isPublished;
    this.actionError.set(null);

    this.api.togglePlanPublish(plan.id, nextState).subscribe({
      next: () => {
        this.successMessage.set(`Plan "${plan.name}" ${nextState ? 'published' : 'unpublished'}.`);
        this.loadPlans();
        setTimeout(() => this.successMessage.set(null), 3000);
      },
      error: err => {
        this.actionError.set(err?.error?.detail || err?.message || 'Failed to update plan status.');
      }
    });
  }

  confirmDelete(plan: PlatformPlanDetailResponse): void {
    if (!confirm(`Are you sure you want to delete plan "${plan.name}" (${plan.code})? This action cannot be undone.`)) {
      return;
    }

    this.actionError.set(null);
    this.api.deletePlan(plan.id).subscribe({
      next: () => {
        this.successMessage.set(`Plan "${plan.name}" deleted.`);
        this.loadPlans();
        setTimeout(() => this.successMessage.set(null), 3000);
      },
      error: err => {
        this.actionError.set(err?.error?.detail || err?.message || 'Failed to delete plan.');
      }
    });
  }
}
