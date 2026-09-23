import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { NgSelectComponent } from '@ng-select/ng-select';
import { CatalogItem, Customer, Estimate, Invoice, Job, JobItemSet, WorkApiService } from '../core/work-api.service';
import { ARRIVAL_WINDOWS, STATE_CITIES, US_STATES_AND_PROVINCES, CATALOG_UNITS } from '../core/reference-data';

const messageFrom = (error: unknown) => error instanceof HttpErrorResponse
  ? error.error?.detail || 'The server could not complete the request.'
  : 'Something went wrong. Please try again.';

@Component({selector:'app-customers-live',imports:[RouterLink,FormsModule,DatePipe],template:`
<main class="page"><header class="page-head"><div><p class="eyebrow">Customer relationship management</p><h1>Customers</h1><p>People, properties, job history, and billing details.</p></div><div class="page-actions"><button class="btn" data-prototype>Import CSV</button><a class="btn primary" routerLink="/app/customers/new">＋ New customer</a></div></header>
<section class="card"><div class="toolbar"><div class="search"><input aria-label="Search customers" placeholder="Search name, phone, email, or address" [(ngModel)]="search" (ngModelChange)="load()"></div><button class="btn small" (click)="load()">Refresh</button></div>
@if(loading()){<div class="card-body muted">Loading customers…</div>}@else if(error()){<div class="card-body"><div class="callout error-text">{{error()}}</div><button class="btn" (click)="load()">Try again</button></div>}@else if(!customers().length){<div class="empty-state"><h2>No customers yet</h2><p>Add your first customer to create a job.</p><a class="btn primary" routerLink="/app/customers/new">＋ New customer</a></div>}@else{
<div class="table-scroll"><table class="data-table"><thead><tr><th>Customer</th><th>Contact</th><th>Service address</th><th>Type</th><th>Status</th></tr></thead><tbody>@for(c of customers();track c.id){<tr><td><a class="person link" [routerLink]="['/app/customers',c.id]"><span class="avatar">{{initials(c.name)}}</span><span class="cell-main"><strong>{{c.name}}</strong><small>Added {{c.createdAt | date:'MMM yyyy'}}</small></span></a></td><td><span class="cell-main"><strong>{{c.phone}}</strong><small>{{c.email || 'No email'}}</small></span></td><td>{{c.addressLine1}}, {{c.city}}, {{c.stateCode}} {{c.postalCode}}</td><td>{{c.customerType}}</td><td><span class="badge" [class.gray]="c.isArchived">{{c.isArchived?'Archived':'Active'}}</span></td></tr>}</tbody></table></div>}</section></main>`})
export class CustomersLivePage {
  private api=inject(WorkApiService); customers=signal<Customer[]>([]); loading=signal(true); error=signal(''); search='';
  constructor(){this.load()}
  load(){this.loading.set(true);this.error.set('');this.api.customers(this.search).subscribe({next:r=>{this.customers.set(r.items);this.loading.set(false)},error:e=>{this.error.set(messageFrom(e));this.loading.set(false)}})}
  initials(name:string){return name.split(/\s+/).map(x=>x[0]).slice(0,2).join('').toUpperCase()}
}

@Component({selector:'app-customer-form-live',imports:[RouterLink,FormsModule,NgSelectComponent],template:`
<main class="page"><header class="page-head"><div><nav class="breadcrumb"><a routerLink="/app/customers">Customers</a><span class="crumb-sep">/</span><span class="crumb-current">Add customer</span></nav><h1>Add customer</h1><p>Create the customer once, then attach jobs, estimates, and invoices.</p></div><a class="btn" routerLink="/app/customers">Cancel</a></header><section class="card"><div class="card-head"><h2>Customer details</h2><span class="muted">Fields marked * are required</span></div>
<form class="card-body form-grid" (ngSubmit)="save()" novalidate>
  <div class="field" [class.has-error]="hasError('name')">
    <label for="name">Full name *</label>
    <input id="name" name="name" [(ngModel)]="model.name" (blur)="markTouched('name')" (input)="onInput('name')" placeholder="e.g. Sarah Miller">
    @if(hasError('name')){<span class="field-error" id="name-error">{{errorMessage('name')}}</span>}
  </div>
  <div class="field" [class.has-error]="hasError('phone')">
    <label for="phone">Phone *</label>
    <input id="phone" name="phone" [(ngModel)]="model.phone" (blur)="markTouched('phone')" (input)="onInput('phone')" placeholder="e.g. (512) 555-0100">
    @if(hasError('phone')){<span class="field-error" id="phone-error">{{errorMessage('phone')}}</span>}
  </div>
  <div class="field" [class.has-error]="hasError('email')">
    <label for="email">Email</label>
    <input id="email" name="email" type="email" [(ngModel)]="model.email" (blur)="markTouched('email')" (input)="onInput('email')" placeholder="e.g. customer@example.com">
    @if(hasError('email')){<span class="field-error" id="email-error">{{errorMessage('email')}}</span>}
  </div>
  <div class="field"><label for="customerType">Customer type</label><ng-select id="customerType" name="customerType" [items]="['Residential', 'Commercial']" [clearable]="false" [searchable]="false" [(ngModel)]="model.customerType"></ng-select></div>
  <div class="field wide"><label for="companyName">Company name</label><input id="companyName" name="companyName" [(ngModel)]="model.companyName" placeholder="e.g. Acme Corp (Optional)"></div>
  <div class="field wide" [class.has-error]="hasError('addressLine1')">
    <label for="addressLine1">Service address *</label>
    <input id="addressLine1" name="addressLine1" [(ngModel)]="model.addressLine1" (blur)="markTouched('addressLine1')" (input)="onInput('addressLine1')" placeholder="e.g. 100 Main Street">
    @if(hasError('addressLine1')){<span class="field-error" id="address-error">{{errorMessage('addressLine1')}}</span>}
  </div>
  <div class="wide grid-3-cols">
    <div class="field" [class.has-error]="hasError('city')">
      <label for="city">City *</label>
      <ng-select id="city" name="city"
        [items]="citySuggestions()"
        [addTag]="true"
        [(ngModel)]="model.city"
        (blur)="markTouched('city')"
        (change)="onInput('city')"
        placeholder="Select or type city...">
      </ng-select>
      @if(hasError('city')){<span class="field-error" id="city-error">{{errorMessage('city')}}</span>}
    </div>
    <div class="field" [class.has-error]="hasError('stateCode')">
      <label for="stateCode">State *</label>
      <ng-select id="stateCode" name="stateCode"
        [items]="stateOptions"
        bindLabel="label"
        bindValue="code"
        [(ngModel)]="model.stateCode"
        (blur)="markTouched('stateCode')"
        (change)="onInput('stateCode')"
        placeholder="Select state...">
      </ng-select>
      @if(hasError('stateCode')){<span class="field-error" id="state-error">{{errorMessage('stateCode')}}</span>}
    </div>
    <div class="field" [class.has-error]="hasError('postalCode')">
      <label for="postalCode">ZIP *</label>
      <input id="postalCode" name="postalCode" [(ngModel)]="model.postalCode" (blur)="markTouched('postalCode')" (input)="onInput('postalCode')" placeholder="e.g. 78701">
      @if(hasError('postalCode')){<span class="field-error" id="zip-error">{{errorMessage('postalCode')}}</span>}
    </div>
  </div>
  @if(error()){<div class="wide callout error-text" id="form-error-banner">{{error()}}</div>}
  <div class="wide page-actions"><a class="btn" routerLink="/app/customers">Cancel</a><button class="btn primary" type="submit" [disabled]="saving()" id="save-customer-btn">{{saving()?'Saving…':'Save customer'}}</button></div>
</form></section></main>`})
export class CustomerFormLivePage {
  private api=inject(WorkApiService);private router=inject(Router);
  saving=signal(false);
  error=signal('');
  submitted=signal(false);
  touched=signal<Record<string,boolean>>({});
  errors=signal<Record<string,string>>({});
  model={customerType:'Residential',name:'',phone:'',email:'',companyName:'',addressLine1:'',city:'Austin',stateCode:'TX',postalCode:'78701'};
  readonly stateOptions = US_STATES_AND_PROVINCES;
  readonly citySuggestions = computed(() => STATE_CITIES[this.model.stateCode] || []);

  hasError(field: string): boolean {
    return (this.submitted() || !!this.touched()[field]) && !!this.errors()[field];
  }

  errorMessage(field: string): string {
    return this.errors()[field] || '';
  }

  validateField(field: string): string {
    const val = (this.model as Record<string, string>)[field] || '';
    switch(field) {
      case 'name':
        if (!val.trim()) return 'Full name is required.';
        if (val.trim().length < 2) return 'Full name must be at least 2 characters.';
        return '';
      case 'phone':
        if (!val.trim()) return 'Phone number is required.';
        const digits = val.replace(/\D/g, '');
        if (digits.length < 10) return 'Please enter a valid 10-digit phone number (e.g. 512-555-0100).';
        return '';
      case 'email':
        if (val.trim()) {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(val.trim())) return 'Please enter a valid email address (e.g. name@example.com).';
          if (val.trim().length > 254) return 'Email address cannot exceed 254 characters.';
        }
        return '';
      case 'addressLine1':
        if (!val.trim()) return 'Service address is required.';
        return '';
      case 'city':
        if (!val.trim()) return 'City is required.';
        return '';
      case 'stateCode':
        if (!val.trim()) return 'State is required.';
        if (val.trim().length !== 2) return 'State must be a 2-letter code (e.g. TX).';
        return '';
      case 'postalCode':
        if (!val.trim()) return 'ZIP code is required.';
        if (!/^\d{5}(-\d{4})?$/.test(val.trim())) return 'ZIP code must be 5 digits (e.g. 78701).';
        return '';
      default:
        return '';
    }
  }

  runValidation(): boolean {
    const fields = ['name', 'phone', 'email', 'addressLine1', 'city', 'stateCode', 'postalCode'];
    const errs: Record<string, string> = {};
    for (const f of fields) {
      const msg = this.validateField(f);
      if (msg) errs[f] = msg;
    }
    this.errors.set(errs);
    return Object.keys(errs).length === 0;
  }

  markTouched(field: string): void {
    this.touched.update(t => ({ ...t, [field]: true }));
    this.runValidation();
  }

  onInput(field: string): void {
    if (this.submitted() || this.touched()[field]) {
      this.runValidation();
    }
  }

  save(){
    this.submitted.set(true);
    this.error.set('');
    if (!this.runValidation()) return;
    if(this.saving())return;
    this.saving.set(true);
    this.api.createCustomer(this.model).subscribe({
      next:c=>this.router.navigate(['/app/customers',c.id]),
      error:e=>{this.error.set(messageFrom(e));this.saving.set(false)}
    });
  }
}

@Component({
  selector: 'app-jobs-live',
  imports: [RouterLink, FormsModule, CurrencyPipe],
  template: `
<main class="page">
  <header class="page-head">
    <div>
      <p class="eyebrow">Work orders</p>
      <h1>Jobs</h1>
      <p>Track every visit from request through completion.</p>
    </div>
    <a class="btn primary" routerLink="/app/jobs/new">＋ Create job</a>
  </header>

  <section class="grid cols-4">
    <article class="card stat">
      <span class="stat-label">All jobs</span>
      <strong class="stat-value">{{jobs().length}}</strong>
      <span class="stat-meta">Loaded from your workspace</span>
    </article>
    <article class="card stat">
      <span class="stat-label">Scheduled</span>
      <strong class="stat-value">{{statusCount('Scheduled')}}</strong>
      <span class="stat-meta">Ready for service</span>
    </article>
    <article class="card stat">
      <span class="stat-label">In progress</span>
      <strong class="stat-value">{{statusCount('InProgress')}}</strong>
      <span class="stat-meta">Active work</span>
    </article>
    <article class="card stat">
      <span class="stat-label">Completed</span>
      <strong class="stat-value">{{statusCount('Completed')}}</strong>
      <span class="stat-meta">Finished visits</span>
    </article>
  </section>

  <section class="card section-gap">
    <div class="filters-toolbar">
      <div class="search-wrap">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
        <input aria-label="Search jobs" placeholder="Search jobs, customers, or numbers…" [(ngModel)]="search">
      </div>
      <div class="status-chips" role="group" aria-label="Filter jobs by status">
        <button type="button" class="chip" [class.active]="status===''" (click)="setStatus('')">
          All <span class="count">{{jobs().length}}</span>
        </button>
        <button type="button" class="chip" [class.active]="status==='Draft'" (click)="setStatus('Draft')">
          Draft <span class="count">{{statusCount('Draft')}}</span>
        </button>
        <button type="button" class="chip" [class.active]="status==='Scheduled'" (click)="setStatus('Scheduled')">
          Scheduled <span class="count">{{statusCount('Scheduled')}}</span>
        </button>
        <button type="button" class="chip" [class.active]="status==='InProgress'" (click)="setStatus('InProgress')">
          In progress <span class="count">{{statusCount('InProgress')}}</span>
        </button>
        <button type="button" class="chip" [class.active]="status==='Completed'" (click)="setStatus('Completed')">
          Completed <span class="count">{{statusCount('Completed')}}</span>
        </button>
      </div>
    </div>

    @if (loading()) {
      <div class="card-body muted">Loading jobs…</div>
    } @else if (error()) {
      <div class="card-body callout error-text">{{error()}}</div>
    } @else if (!filteredJobs().length) {
      <div class="empty-state">
        <h2>No matching jobs</h2>
        <p>Try clearing your search or status filter.</p>
        <button type="button" class="btn" (click)="clearFilters()">Clear filters</button>
      </div>
    } @else {
      <!-- Desktop Table View -->
      <div class="job-table-wrap table-scroll">
        <table class="data-table">
          <thead>
            <tr>
              <th>Job</th>
              <th>Customer</th>
              <th>Schedule</th>
              <th>Priority</th>
              <th>Status</th>
              <th style="text-align:right">Total</th>
              <th style="width:40px" aria-label="Open"></th>
            </tr>
          </thead>
          <tbody>
            @for (j of filteredJobs(); track j.id) {
              <tr>
                <td>
                  <span class="job-ref-badge">#{{j.jobNumber.startsWith('J-') ? j.jobNumber : 'J-' + j.jobNumber}}</span>
                  <a class="cell-main link" [routerLink]="['/app/jobs', j.id]">
                    <strong>{{j.title}}</strong>
                    <small>{{j.description || 'No description'}}</small>
                  </a>
                </td>
                <td>
                  <strong>{{customerName(j.customerId)}}</strong>
                  <small class="muted" style="display:block">{{customerAddress(j.customerId)}}</small>
                </td>
                <td>
                  <strong>{{j.scheduledDate || 'Unscheduled'}}</strong>
                  <small class="muted" style="display:block">{{j.arrivalWindow || 'Arrange time'}}</small>
                </td>
                <td>{{j.priority}}</td>
                <td>
                  <span class="badge" [class.amber]="j.status==='InProgress'" [class.blue]="j.status==='Scheduled'" [class.gray]="j.status==='Draft'" [class.teal]="j.status==='Completed'">
                    {{label(j.status)}}
                  </span>
                </td>
                <td class="money" style="text-align:right;font-weight:700">
                  {{j.total | currency}}
                </td>
                <td style="text-align:center">
                  <a class="row-action-link" [routerLink]="['/app/jobs', j.id]" aria-label="Open job">›</a>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      <!-- Mobile Cards View -->
      <div class="mobile-jobs">
        @for (j of filteredJobs(); track j.id) {
          <a class="mobile-job" [routerLink]="['/app/jobs', j.id]">
            <div class="mobile-job-top">
              <span class="job-ref-badge">#{{j.jobNumber.startsWith('J-') ? j.jobNumber : 'J-' + j.jobNumber}}</span>
              <span class="badge" [class.amber]="j.status==='InProgress'" [class.blue]="j.status==='Scheduled'" [class.gray]="j.status==='Draft'" [class.teal]="j.status==='Completed'">
                {{label(j.status)}}
              </span>
            </div>
            <h3>{{j.title}}</h3>
            <p>{{customerName(j.customerId)}}</p>
            <div class="mobile-job-bottom">
              <span>📅 {{j.scheduledDate || 'Unscheduled'}}{{j.arrivalWindow ? ' · ' + j.arrivalWindow : ''}}</span>
              <b>{{j.total | currency}}</b>
            </div>
          </a>
        }
      </div>

      <div style="padding: 12px 20px; font-size: 12px; color: var(--muted); border-top: 1px solid var(--line-soft); display: flex; justify-content: space-between;">
        <span>{{filteredJobs().length}} jobs shown</span>
        <span>Workspace local</span>
      </div>
    }
  </section>
</main>
`
})
export class JobsLivePage {
  private api = inject(WorkApiService);
  jobs = signal<Job[]>([]);
  customers = signal<Customer[]>([]);
  loading = signal(true);
  error = signal('');
  search = '';
  status = '';

  constructor() {
    this.api.customers().subscribe({
      next: r => this.customers.set(r.items),
      error: () => {}
    });
    this.load();
  }

  load() {
    this.loading.set(true);
    this.api.jobs().subscribe({
      next: r => {
        this.jobs.set(r.items);
        this.loading.set(false);
      },
      error: e => {
        this.error.set(messageFrom(e));
        this.loading.set(false);
      }
    });
  }

  filteredJobs(): Job[] {
    const q = this.search.trim().toLowerCase();
    return this.jobs().filter(j => {
      const matchStatus = !this.status || j.status === this.status;
      if (!matchStatus) return false;
      if (!q) return true;
      const cName = this.customerName(j.customerId).toLowerCase();
      const title = (j.title || '').toLowerCase();
      const num = (j.jobNumber || '').toLowerCase();
      return title.includes(q) || cName.includes(q) || num.includes(q);
    });
  }

  setStatus(s: string) {
    this.status = s;
  }

  clearFilters() {
    this.search = '';
    this.status = '';
  }

  statusCount(status: string) {
    return this.jobs().filter(x => x.status === status).length;
  }

  customerName(id: string) {
    return this.customers().find(x => x.id === id)?.name || 'Customer';
  }

  customerAddress(id: string) {
    const c = this.customers().find(x => x.id === id);
    if (!c) return '';
    return [c.city, c.stateCode].filter(Boolean).join(', ') || c.addressLine1;
  }

  label(value: string) {
    return value.replace(/([a-z])([A-Z])/g, '$1 $2');
  }
}

@Component({
  selector: 'app-job-form-live',
  imports: [RouterLink, FormsModule, NgSelectComponent, CurrencyPipe],
  template: `
<main class="page">
  <header class="page-head">
    <div>
      <nav class="breadcrumb">
        <a routerLink="/app/jobs">Jobs</a>
        <span class="crumb-sep">/</span>
        <span class="crumb-current">New job</span>
      </nav>
      <h1>Create job</h1>
      <p>Customer, schedule, and services. You’re ready to go.</p>
    </div>
    <a class="btn" routerLink="/app/jobs">Cancel</a>
  </header>

  <div class="form-layout">
    <div class="form-main">
      <!-- STEP 1: Customer & Job -->
      <section class="card">
        <div class="card-head">
          <h2><span class="section-number">1</span>Customer & job</h2>
          <button type="button" class="btn small" (click)="openQuickCustomerModal()">
            ＋ New customer
          </button>
        </div>
        <div class="card-body form-grid">
          <div class="field wide" [class.has-error]="hasError('customerId')">
            <label for="customerId">Customer *</label>
            <ng-select id="customerId" name="customerId"
              [items]="customers()"
              bindLabel="name"
              bindValue="id"
              [(ngModel)]="model.customerId"
              [clearSearchOnAdd]="true"
              [closeOnSelect]="true"
              (blur)="markTouched('customerId')"
              (change)="onCustomerSelected()"
              [placeholder]="model.customerId ? '' : 'Search customer by name, phone, or address...'">
              <ng-template ng-option-tmp let-item="item">
                <div><strong>{{item.name}}</strong> · <small class="muted">{{item.phone}} · {{item.addressLine1}}, {{item.city}}</small></div>
              </ng-template>
            </ng-select>
            @if(hasError('customerId')){<span class="field-error" id="customer-error">{{errorMessage('customerId')}}</span>}

            @if(selectedCustomer(); as sc){
              <div class="customer-preview-card" style="margin-top:10px">
                <span class="preview-avatar">{{sc.name[0]}}</span>
                <div class="preview-info">
                  <strong>{{sc.name}}</strong>
                  <span>📞 {{sc.phone}} · 📍 {{sc.addressLine1}}, {{sc.city}} {{sc.stateCode}}</span>
                </div>
                <button type="button" class="btn-clear-customer" (click)="clearCustomer()" title="Remove selection">✕</button>
              </div>
            }
          </div>

          <div class="field wide" [class.has-error]="hasError('title')">
            <label for="title">Job title *</label>
            <input id="title" name="title" [(ngModel)]="model.title" (blur)="markTouched('title')" (input)="onInput('title')" placeholder="e.g. Water heater repair">
            <div class="quick-chips">
              <span class="chips-label">Quick titles:</span>
              @for(t of titleSuggestions; track t){
                <button type="button" class="chip-btn" [class.active]="model.title===t" (click)="setTitle(t)">{{t}}</button>
              }
            </div>
            @if(hasError('title')){<span class="field-error" id="title-error">{{errorMessage('title')}}</span>}
          </div>

          <div class="field wide">
            <label for="priority">Priority</label>
            <ng-select id="priority" name="priority"
              [items]="['Normal', 'High', 'Emergency']"
              [clearable]="false"
              [searchable]="false"
              [(ngModel)]="model.priority">
            </ng-select>
          </div>
        </div>
      </section>

      <!-- STEP 2: When & Where -->
      <section class="card">
        <div class="card-head">
          <h2><span class="section-number">2</span>When & where</h2>
          <span class="badge" [class.blue]="isScheduled()" [class.gray]="!isScheduled()">
            {{isScheduled() ? 'Scheduled' : 'Draft'}}
          </span>
        </div>
        <div class="card-body">
          <div class="radio-cards">
            <button type="button" [class.selected]="isScheduled()" (click)="setScheduled(true)">
              <span class="radio-dot"></span>
              Schedule a visit
            </button>
            <button type="button" [class.selected]="!isScheduled()" (click)="setScheduled(false)">
              <span class="radio-dot"></span>
              Schedule later
            </button>
          </div>

          @if (isScheduled()) {
            <div class="form-grid" style="margin-top:14px">
              <div class="field" [class.has-error]="hasError('scheduledDate')">
                <label for="scheduledDate">Visit date *</label>
                <input id="scheduledDate" name="scheduledDate" type="date" [(ngModel)]="model.scheduledDate" (blur)="markTouched('scheduledDate')" (input)="onInput('scheduledDate')">
                @if(hasError('scheduledDate')){<span class="field-error">{{errorMessage('scheduledDate')}}</span>}
              </div>
              <div class="field">
                <label for="arrivalWindow">Arrival window</label>
                <ng-select id="arrivalWindow" name="arrivalWindow"
                  [items]="arrivalWindows"
                  [searchable]="true"
                  [clearable]="true"
                  [clearSearchOnAdd]="true"
                  [closeOnSelect]="true"
                  [placeholder]="model.arrivalWindow ? '' : 'Select arrival window (e.g. 9:00 AM – 11:00 AM)'"
                  [(ngModel)]="model.arrivalWindow">
                </ng-select>
              </div>
            </div>
            <p class="muted" style="font-size:12px;margin:8px 0 0">Workspace local time.</p>
          } @else {
            <p class="muted" style="font-size:13px;margin:8px 0 0">Save as an unscheduled draft. Set the visit date whenever you’re ready.</p>
          }

          <div class="field wide" style="margin-top:20px">
            <label for="description">Customer request / internal instructions <span class="muted" style="font-weight:400">(Optional)</span></label>
            <textarea id="description" name="description" rows="3" [(ngModel)]="model.description" placeholder="Notes, access instructions, gate codes, tools to bring…"></textarea>
          </div>
        </div>
      </section>

      <!-- STEP 3: Services & Parts -->
      <section class="card">
        <div class="card-head">
          <div>
            <h2><span class="section-number">3</span>Services & parts</h2>
            <p style="margin:2px 0 0;font-size:12px;color:var(--muted)">{{selectedItems().length}} item{{selectedItems().length !== 1 ? 's' : ''}} attached</p>
          </div>
          <button type="button" class="btn small primary" (click)="openPickerModal()">
            ＋ Add items
          </button>
        </div>
        <div class="card-body">
          @if (!selectedItems().length) {
            <div style="text-align:center;padding:24px 12px">
              <p style="margin:0 0 12px;color:var(--muted);font-size:13px">No services or parts added yet. Attach catalog or custom items to this job.</p>
              <button type="button" class="btn" (click)="openPickerModal()">
                ＋ Browse services & parts
              </button>
            </div>
          } @else {
            <div class="line-items-list">
              @for (item of selectedItems(); track $index; let idx = $index) {
                <div class="line-item-row">
                  <div class="line-item-info">
                    <strong>{{item.description}}</strong>
                    <small>{{item.itemType}} · {{item.unitPrice | currency}} / {{item.unit}}</small>
                    <div>
                      <button type="button" class="remove-btn" (click)="removeItem(idx)">Remove</button>
                    </div>
                  </div>
                  <div class="stepper">
                    <button type="button" (click)="updateItemQty(idx, -1)" [disabled]="item.quantity <= 1" aria-label="Decrease quantity">−</button>
                    <span>{{item.quantity}}</span>
                    <button type="button" (click)="updateItemQty(idx, 1)" aria-label="Increase quantity">＋</button>
                  </div>
                  <div class="line-item-amount">
                    {{item.unitPrice * item.quantity | currency}}
                  </div>
                </div>
              }
            </div>
            <button type="button" class="btn" style="width:100%" (click)="openPickerModal()">
              ＋ Add more items
            </button>
          }
        </div>
      </section>
    </div>

    <!-- Sticky Summary Sidebar (Desktop) -->
    <aside class="summary-card card">
      <div class="card-head">
        <h2>Job summary</h2>
        <span class="badge" [class.blue]="isScheduled()" [class.gray]="!isScheduled()">
          {{isScheduled() ? 'Scheduled' : 'Draft'}}
        </span>
      </div>
      <div class="card-body">
        <div class="summary-line">
          <span>Customer</span>
          <strong>{{selectedCustomer()?.name || 'Not selected'}}</strong>
        </div>
        <div class="summary-line">
          <span>Visit</span>
          <strong>{{isScheduled() ? (model.scheduledDate || 'Date not set') + (model.arrivalWindow ? ' · ' + model.arrivalWindow : '') : 'Schedule later'}}</strong>
        </div>
        <div class="summary-line">
          <span>Items</span>
          <strong>{{selectedItems().length}}</strong>
        </div>
        <div class="summary-line">
          <span>Subtotal</span>
          <strong>{{itemsSubtotal() | currency}}</strong>
        </div>
        <div class="summary-line">
          <span>Tax</span>
          <strong>{{0 | currency}}</strong>
        </div>

        <div class="summary-total">
          <span>Total</span>
          <strong>{{itemsSubtotal() | currency}}</strong>
        </div>

        @if(success()){<div class="callout" style="margin-top:14px;background:#e6f7f5;border-color:var(--teal);color:var(--teal)">{{success()}}</div>}
        @if(error()){<div class="callout error-text" style="margin-top:14px">{{error()}}</div>}

        <div class="summary-actions">
          <button type="button" class="btn primary" [disabled]="saving()" (click)="save(false)" id="submit-job-btn">
            {{saving() ? 'Creating…' : 'Create job'}}
          </button>
          <button type="button" class="btn" [disabled]="saving()" (click)="save(true)" id="submit-add-another-btn">
            Save & create another
          </button>
        </div>

        <div class="summary-meta">
          <span>🛡️</span>
          <div>No invoice is issued yet. Review the work with your customer before invoicing.</div>
        </div>
      </div>
    </aside>
  </div>

  <!-- Sticky action bar returns to normal flow below the job summary. -->
  <div class="form-actions-mobile">
    <div class="form-actions-mobile-total">
      <small>Total · USD</small>
      <strong>{{itemsSubtotal() | currency}}</strong>
    </div>
    <button type="button" class="btn primary" [disabled]="saving()" (click)="save(false)" id="mobile-create-job-btn">
      <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14 M14 7l5 5-5 5"/></svg>
      {{saving() ? 'Creating…' : 'Create job'}}
    </button>
  </div>

  <!-- Multi-Item Catalog Picker Modal -->
  @if (showPickerModal()) {
    <div class="quick-modal-backdrop" (click)="closePickerModal()">
      <div class="quick-modal-card picker-modal-card" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <div>
            <h3 style="margin:0">Add services & parts</h3>
            <p style="margin:3px 0 0;font-size:12px;color:var(--muted)">Pick several items. Adjust quantities on the job.</p>
          </div>
          <button type="button" class="modal-close-btn" (click)="closePickerModal()" aria-label="Close">✕</button>
        </div>
        <div class="modal-body" style="padding-bottom:12px">
          <div class="search-wrap" style="display:flex;align-items:center;gap:8px;border:1px solid var(--line);background:#fff;border-radius:8px;padding:0 12px;height:42px">
            <span style="color:var(--muted);font-size:15px">⌕</span>
            <input aria-label="Search catalog" placeholder="Search your price book…" [(ngModel)]="pickerSearch" style="border:0;outline:none;width:100%;font-size:13px;color:var(--ink)">
          </div>

          <div class="catalog-tabs">
            @for (tab of ['All', 'Service', 'Part', 'Labor']; track tab) {
              <button type="button" [class.active]="pickerTab === tab" (click)="pickerTab = tab">
                {{tab === 'All' ? 'All items' : tab === 'Labor' ? 'Labor' : tab + 's'}}
              </button>
            }
          </div>

          <div class="catalog-list">
            @for (c of filteredCatalog(); track c.id) {
              <div class="catalog-choice" [class.selected]="!!pickerSelections()[c.id]">
                <span class="item-symbol">{{c.itemType === 'Part' ? '📦' : c.itemType === 'Labor' ? '⏱️' : '🔧'}}</span>
                <div class="info">
                  <strong>{{c.name}}</strong>
                  <small>{{c.itemType}} · per {{c.unit || 'visit'}}</small>
                </div>
                <span class="price">{{c.unitPrice | currency}}</span>
                <button type="button" class="choice-action-btn" [class.selected]="pickerSelections()[c.id]" (click)="togglePickerItem(c)" [attr.aria-label]="pickerSelections()[c.id] ? 'Remove ' + c.name : 'Add ' + c.name">
                  {{pickerSelections()[c.id] ? '✓' : '＋'}}
                </button>
              </div>
            }
            @if (!filteredCatalog().length) {
              <div class="muted" style="text-align:center;padding:20px;font-size:13px">No catalog items match this filter.</div>
            }
          </div>

          <div class="custom-item-section">
            <h4>Something different?</h4>
            <p>Add a custom item just for this job.</p>
            <div class="custom-item-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
              <div class="field">
                <label for="custom-name" style="font-size:11px;color:var(--ink);font-weight:600;margin-bottom:4px;display:block">Item name</label>
                <input id="custom-name" [(ngModel)]="customItemName" placeholder="e.g. Replacement valve" style="height:38px;font-size:12px;padding:0 10px;border-radius:7px">
              </div>
              <div class="field">
                <label for="custom-price" style="font-size:11px;color:var(--ink);font-weight:600;margin-bottom:4px;display:block">Unit price · USD</label>
                <input id="custom-price" type="number" step="0.01" min="0" [(ngModel)]="customItemPrice" placeholder="0.00" style="height:38px;font-size:12px;padding:0 10px;border-radius:7px">
              </div>
            </div>
            <button type="button" class="btn small" (click)="addCustomItemDirect()" [disabled]="!customItemName.trim()" style="min-height:36px;font-size:12px;padding:0 14px;border-radius:7px">
              ＋ Add custom item
            </button>
          </div>
        </div>
        <div class="modal-footer picker-footer">
          <span class="picker-count-label">
            <strong>{{pickerCount()}}</strong> {{pickerCount() === 1 ? 'item' : 'items'}} selected
          </span>
          <button type="button" class="btn primary picker-commit-btn" (click)="commitPickerModal()" [disabled]="pickerCount() === 0">
            ＋ Add to job
          </button>
        </div>
      </div>
    </div>
  }

  <!-- Quick Add Customer Modal -->
  @if (showQuickCustomerModal()) {
    <div class="quick-modal-backdrop" (click)="closeQuickCustomerModal()">
      <div class="quick-modal-card" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h3 style="margin:0">＋ Quick Add Customer</h3>
          <button type="button" class="modal-close-btn" (click)="closeQuickCustomerModal()">✕</button>
        </div>
        <form (ngSubmit)="saveQuickCustomer()" novalidate>
          <div class="modal-body form-grid">
            <div class="field wide" [class.has-error]="quickCustomerSubmitted() && !quickCustomer.name.trim()">
              <label for="qc-name">Full name *</label>
              <input id="qc-name" name="qcName" [(ngModel)]="quickCustomer.name" placeholder="e.g. Sarah Miller" autocomplete="name">
              @if(quickCustomerSubmitted() && !quickCustomer.name.trim()){<span class="field-error">Name is required</span>}
            </div>
            <div class="field" [class.has-error]="quickCustomerSubmitted() && !quickCustomer.phone.trim()">
              <label for="qc-phone">Phone *</label>
              <input id="qc-phone" name="qcPhone" [(ngModel)]="quickCustomer.phone" placeholder="e.g. (512) 555-0100" autocomplete="tel">
              @if(quickCustomerSubmitted() && !quickCustomer.phone.trim()){<span class="field-error">Phone is required</span>}
            </div>
            <div class="field">
              <label for="qc-email">Email (Optional)</label>
              <input id="qc-email" name="qcEmail" type="email" [(ngModel)]="quickCustomer.email" placeholder="customer@example.com" autocomplete="email">
            </div>
            <div class="field wide" [class.has-error]="quickCustomerSubmitted() && !quickCustomer.addressLine1.trim()">
              <label for="qc-addr">Service address *</label>
              <input id="qc-addr" name="qcAddr" [(ngModel)]="quickCustomer.addressLine1" placeholder="e.g. 100 Main Street" autocomplete="street-address">
              @if(quickCustomerSubmitted() && !quickCustomer.addressLine1.trim()){<span class="field-error">Address is required</span>}
            </div>
            <div class="field">
              <label for="qc-city">City</label>
              <input id="qc-city" name="qcCity" [(ngModel)]="quickCustomer.city" placeholder="Austin">
            </div>
            <div class="field">
              <label for="qc-zip">ZIP</label>
              <input id="qc-zip" name="qcZip" [(ngModel)]="quickCustomer.postalCode" placeholder="78701">
            </div>
            @if(quickCustomerError()){<div class="wide callout error-text">{{quickCustomerError()}}</div>}
          </div>
          <div class="modal-footer">
            <button type="button" class="btn" (click)="closeQuickCustomerModal()">Cancel</button>
            <button type="submit" class="btn primary" [disabled]="quickCustomerSaving()">{{quickCustomerSaving() ? 'Saving…' : 'Save & select'}}</button>
          </div>
        </form>
      </div>
    </div>
  }
</main>
`
})
export class JobFormLivePage {
  private api = inject(WorkApiService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  customers = signal<Customer[]>([]);
  catalog = signal<CatalogItem[]>([]);
  selectedItems = signal<{
    catalogItemId?: string;
    itemType: string;
    description: string;
    unitPrice: number;
    quantity: number;
    unit: string;
  }[]>([]);

  isScheduled = signal(true);
  saving = signal(false);
  error = signal('');
  success = signal('');
  submitted = signal(false);
  touched = signal<Record<string, boolean>>({});
  errors = signal<Record<string, string>>({});

  model = {
    customerId: null as string | null,
    title: '',
    description: '',
    priority: 'Normal',
    scheduledDate: new Date().toISOString().slice(0, 10),
    arrivalWindow: '9:00 AM – 11:00 AM'
  };

  readonly arrivalWindows = ARRIVAL_WINDOWS;

  readonly selectedCustomer = computed(() =>
    this.customers().find(c => c.id === this.model.customerId) || null
  );

  readonly itemsSubtotal = computed(() =>
    this.selectedItems().reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0)
  );

  readonly titleSuggestions = [
    'Diagnostic visit',
    'Annual maintenance',
    'Emergency repair',
    'Water heater inspection',
    'System tune-up'
  ];

  // Catalog picker modal state
  showPickerModal = signal(false);
  pickerSearch = '';
  pickerTab = 'All';
  pickerSelections = signal<Record<string, {
    catalogItemId?: string;
    itemType: string;
    description: string;
    unitPrice: number;
    quantity: number;
    unit: string;
  }>>({});
  customItemName = '';
  customItemPrice = 0;

  // Quick Add Customer modal state
  readonly showQuickCustomerModal = signal(false);
  readonly quickCustomerSaving = signal(false);
  readonly quickCustomerSubmitted = signal(false);
  readonly quickCustomerError = signal('');
  quickCustomer = {
    customerType: 'Residential',
    name: '',
    phone: '',
    email: '',
    companyName: '',
    addressLine1: '',
    city: 'Austin',
    stateCode: 'TX',
    postalCode: '78701'
  };

  constructor() {
    const prefillCustomer = this.route.snapshot.queryParamMap.get('customerId');
    if (prefillCustomer) {
      this.model.customerId = prefillCustomer;
    }
    this.api.customers().subscribe({
      next: r => this.customers.set(r.items),
      error: e => this.error.set(messageFrom(e))
    });
    this.api.catalog().subscribe({
      next: r => this.catalog.set(r.items),
      error: () => {}
    });
  }

  setScheduled(val: boolean) {
    this.isScheduled.set(val);
    if (!val) {
      this.model.scheduledDate = '';
      this.model.arrivalWindow = '';
    } else {
      if (!this.model.scheduledDate) {
        this.model.scheduledDate = new Date().toISOString().slice(0, 10);
      }
      if (!this.model.arrivalWindow) {
        this.model.arrivalWindow = '9:00 AM – 11:00 AM';
      }
    }
  }

  openPickerModal() {
    this.pickerSearch = '';
    this.pickerTab = 'All';
    this.pickerSelections.set({});
    this.customItemName = '';
    this.customItemPrice = 0;
    this.showPickerModal.set(true);
  }

  closePickerModal() {
    this.showPickerModal.set(false);
  }

  filteredCatalog(): CatalogItem[] {
    const q = this.pickerSearch.trim().toLowerCase();
    const tab = this.pickerTab;
    return this.catalog().filter(c => {
      const matchTab = tab === 'All' || c.itemType === tab;
      if (!matchTab) return false;
      if (!q) return true;
      return c.name.toLowerCase().includes(q) || (c.itemType && c.itemType.toLowerCase().includes(q));
    });
  }

  togglePickerItem(c: CatalogItem) {
    this.pickerSelections.update(map => {
      const copy = { ...map };
      if (copy[c.id]) {
        delete copy[c.id];
      } else {
        copy[c.id] = {
          catalogItemId: c.id,
          itemType: c.itemType || 'Service',
          description: c.name,
          unitPrice: c.unitPrice,
          quantity: 1,
          unit: c.unit || 'unit'
        };
      }
      return copy;
    });
  }

  addCustomItemDirect() {
    const name = this.customItemName.trim();
    if (!name) return;
    const price = Number(this.customItemPrice) || 0;
    const key = 'custom-' + Date.now();
    this.pickerSelections.update(map => ({
      ...map,
      [key]: {
        itemType: 'Service',
        description: name,
        unitPrice: price,
        quantity: 1,
        unit: 'each'
      }
    }));
    this.customItemName = '';
    this.customItemPrice = 0;
  }

  pickerCount(): number {
    return Object.keys(this.pickerSelections()).length;
  }

  commitPickerModal() {
    const itemsToAdd = Object.values(this.pickerSelections());
    this.selectedItems.update(current => {
      const next = [...current];
      for (const item of itemsToAdd) {
        const existing = item.catalogItemId
          ? next.find(x => x.catalogItemId === item.catalogItemId)
          : null;
        if (existing) {
          existing.quantity += item.quantity;
        } else {
          next.push({ ...item });
        }
      }
      return next;
    });
    this.closePickerModal();
  }

  updateItemQty(index: number, delta: number) {
    this.selectedItems.update(items => {
      const copy = [...items];
      const item = copy[index];
      if (item) {
        item.quantity = Math.max(1, item.quantity + delta);
      }
      return copy;
    });
  }

  removeItem(index: number) {
    this.selectedItems.update(items => items.filter((_, i) => i !== index));
  }

  openQuickCustomerModal(): void {
    this.quickCustomer = {
      customerType: 'Residential',
      name: '',
      phone: '',
      email: '',
      companyName: '',
      addressLine1: '',
      city: 'Austin',
      stateCode: 'TX',
      postalCode: '78701'
    };
    this.quickCustomerError.set('');
    this.quickCustomerSubmitted.set(false);
    this.showQuickCustomerModal.set(true);
  }

  closeQuickCustomerModal(): void {
    this.showQuickCustomerModal.set(false);
  }

  saveQuickCustomer(): void {
    this.quickCustomerSubmitted.set(true);
    this.quickCustomerError.set('');

    if (!this.quickCustomer.name.trim() || !this.quickCustomer.phone.trim() || !this.quickCustomer.addressLine1.trim()) {
      return;
    }

    this.quickCustomerSaving.set(true);
    this.api.createCustomer(this.quickCustomer).subscribe({
      next: created => {
        this.customers.update(list => [created, ...list]);
        this.model.customerId = created.id;
        this.onCustomerSelected();
        this.quickCustomerSaving.set(false);
        this.showQuickCustomerModal.set(false);
      },
      error: e => {
        this.quickCustomerError.set(messageFrom(e));
        this.quickCustomerSaving.set(false);
      }
    });
  }

  onCustomerSelected(): void {
    this.onInput('customerId');
  }

  clearCustomer(): void {
    this.model.customerId = null;
    this.onInput('customerId');
  }

  setTitle(t: string): void {
    this.model.title = t;
    this.onInput('title');
  }

  validateField(field: string): string {
    if (field === 'customerId') {
      if (!this.model.customerId) return 'Please select a customer.';
    }
    if (field === 'title') {
      if (!this.model.title?.trim()) return 'Job title is required.';
      if (this.model.title.trim().length < 3) return 'Job title must be at least 3 characters.';
    }
    if (field === 'scheduledDate' && this.isScheduled()) {
      if (!this.model.scheduledDate) return 'Please select a visit date.';
    }
    return '';
  }

  runValidation(): boolean {
    const errs: Record<string, string> = {};
    const fields = ['customerId', 'title'];
    if (this.isScheduled()) fields.push('scheduledDate');
    for (const f of fields) {
      const msg = this.validateField(f);
      if (msg) errs[f] = msg;
    }
    this.errors.set(errs);
    return Object.keys(errs).length === 0;
  }

  markTouched(field: string): void {
    this.touched.update(t => ({ ...t, [field]: true }));
    this.runValidation();
  }

  onInput(field: string): void {
    if (this.submitted() || this.touched()[field]) {
      this.runValidation();
    }
  }

  hasError(field: string): boolean {
    return (this.submitted() || !!this.touched()[field]) && !!this.errors()[field];
  }

  errorMessage(field: string): string {
    return this.hasError(field) ? (this.errors()[field] || '') : '';
  }

  private resetForm(): void {
    this.model = {
      customerId: null,
      title: '',
      description: '',
      priority: 'Normal',
      scheduledDate: '',
      arrivalWindow: ''
    };
    this.selectedItems.set([]);
    this.isScheduled.set(true);
    this.submitted.set(false);
    this.touched.set({});
    this.errors.set({});
  }

  save(createAnother = false) {
    this.submitted.set(true);
    this.error.set('');
    this.success.set('');
    if (!this.runValidation()) return;
    if (this.saving()) return;
    this.saving.set(true);

    const command = {
      ...this.model,
      customerId: this.model.customerId!,
      scheduledDate: (this.isScheduled() && this.model.scheduledDate) ? this.model.scheduledDate : undefined,
      arrivalWindow: (this.isScheduled() && this.model.arrivalWindow) ? this.model.arrivalWindow : undefined
    };

    this.api.createJob(command).subscribe({
      next: j => {
        const items = this.selectedItems();
        if (items.length > 0) {
          const jobItems = items.map((x, idx) => ({
            catalogItemId: x.catalogItemId,
            itemType: x.itemType,
            description: x.description,
            quantity: x.quantity,
            unit: x.unit,
            unitPrice: x.unitPrice,
            discountAmount: 0,
            taxAmount: 0,
            sortOrder: idx + 1
          }));

          this.api.replaceJobItems(j.id, jobItems).subscribe({
            next: () => {
              this.saving.set(false);
              if (createAnother) {
                this.success.set(`Job #${j.jobNumber} ("${j.title}") created with ${items.length} items! Ready for next job.`);
                this.resetForm();
              } else {
                this.router.navigate(['/app/jobs', j.id]);
              }
            },
            error: () => {
              this.saving.set(false);
              this.router.navigate(['/app/jobs', j.id]);
            }
          });
        } else {
          this.saving.set(false);
          if (createAnother) {
            this.success.set(`Job #${j.jobNumber} ("${j.title}") created successfully! Ready for next job.`);
            this.resetForm();
          } else {
            this.router.navigate(['/app/jobs', j.id]);
          }
        }
      },
      error: e => {
        this.error.set(messageFrom(e));
        this.saving.set(false);
      }
    });
  }
}

@Component({selector:'app-customer-live',imports:[RouterLink,DatePipe,CurrencyPipe],template:`
<main class="page">@if(loading()){<div class="card card-body muted">Loading customer…</div>}@else if(error()){<div class="card card-body callout error-text">{{error()}}</div>}@else if(customer();as c){<header class="page-head"><div><nav class="breadcrumb"><a routerLink="/app/customers">Customers</a><span class="crumb-sep">/</span><span class="crumb-current">{{c.name}}</span></nav><div class="person"><span class="avatar">{{initials(c.name)}}</span><div><h1>{{c.name}}</h1><p>{{c.customerType}} customer · added {{c.createdAt|date:'MMM yyyy'}}</p></div></div></div><div class="page-actions"><a class="btn primary" [routerLink]="['/app/jobs/new']" [queryParams]="{customerId: c.id}">＋ Create job</a></div></header><section class="split"><article class="card"><div class="card-head"><h2>Contact details</h2></div><div class="card-body form-grid"><div><small class="muted">PHONE</small><p>{{c.phone}}</p></div><div><small class="muted">EMAIL</small><p>{{c.email||'Not provided'}}</p></div><div class="wide"><small class="muted">SERVICE ADDRESS</small><p>{{c.addressLine1}}, {{c.city}}, {{c.stateCode}} {{c.postalCode}}</p></div></div></article><aside class="card"><div class="card-head"><h2>Account</h2></div><div class="card-body"><span class="badge">Active</span><p class="muted">{{c.companyName||'Individual customer'}}</p></div></aside></section>
<section class="card section-gap">
  <div class="card-head" style="border-bottom: 1px solid var(--line); display:flex; gap:8px; align-items:center;">
    <button type="button" class="tab-btn" [class.active]="activeTab()==='jobs'" (click)="activeTab.set('jobs')">Jobs ({{customerJobs().length}})</button>
    <button type="button" class="tab-btn" [class.active]="activeTab()==='estimates'" (click)="activeTab.set('estimates')">Estimates ({{customerEstimates().length}})</button>
    <button type="button" class="tab-btn" [class.active]="activeTab()==='invoices'" (click)="activeTab.set('invoices')">Invoices ({{customerInvoices().length}})</button>
    <span style="flex:1"></span>
    @if(activeTab()==='jobs'){<a class="btn small primary" [routerLink]="['/app/jobs/new']" [queryParams]="{customerId: c.id}">＋ New job</a>}
  </div>
  @if(activeTab()==='jobs'){
    @if(!customerJobs().length){<div class="card-body muted">No jobs created yet for this customer.</div>}@else{
      <div class="table-scroll"><table class="data-table"><thead><tr><th>Job</th><th>Schedule</th><th>Priority</th><th>Status</th><th>Total</th></tr></thead><tbody>
        @for(j of customerJobs();track j.id){<tr><td><a class="cell-main link" [routerLink]="['/app/jobs',j.id]"><strong>#{{j.jobNumber}} · {{j.title}}</strong><small>{{j.description||'No description'}}</small></a></td><td>{{j.scheduledDate||'Unscheduled'}}</td><td>{{j.priority}}</td><td><span class="badge" [class.amber]="j.status==='InProgress'" [class.blue]="j.status==='Scheduled'" [class.gray]="j.status==='Draft'" [class.teal]="j.status==='Completed'">{{label(j.status)}}</span></td><td class="money">{{j.total|currency}}</td></tr>}
      </tbody></table></div>
    }
  }
  @else if(activeTab()==='estimates'){
    @if(!customerEstimates().length){<div class="card-body muted">No estimates found for this customer.</div>}@else{
      <div class="table-scroll"><table class="data-table"><thead><tr><th>Estimate</th><th>Created</th><th>Expires</th><th>Status</th><th>Total</th></tr></thead><tbody>
        @for(e of customerEstimates();track e.id){<tr><td><a class="cell-main link" [routerLink]="['/app/estimates',e.id]"><strong>#{{e.estimateNumber}}</strong><small>{{e.items.length}} line items (rev {{e.revision}})</small></a></td><td>{{e.createdAt|date:'MMM d, y'}}</td><td>{{e.validUntil|date:'MMM d, y'}}</td><td><span class="badge" [class.gray]="e.status==='Draft'" [class.amber]="e.status==='Sent'" [class.teal]="e.status==='Approved'">{{e.status}}</span></td><td class="money">{{e.total|currency}}</td></tr>}
      </tbody></table></div>
    }
  }
  @else if(activeTab()==='invoices'){
    @if(!customerInvoices().length){<div class="card-body muted">No invoices found for this customer.</div>}@else{
      <div class="table-scroll"><table class="data-table"><thead><tr><th>Invoice</th><th>Issued</th><th>Status</th><th>Total</th><th>Balance</th></tr></thead><tbody>
        @for(inv of customerInvoices();track inv.id){<tr><td><a class="cell-main link" [routerLink]="['/app/invoices',inv.id]"><strong>#{{inv.invoiceNumber}}</strong><small>{{inv.items.length}} line items</small></a></td><td>{{inv.issuedOn?(inv.issuedOn|date:'MMM d, y'):'Draft'}}</td><td><span class="badge" [class.gray]="inv.status==='Draft'" [class.teal]="inv.paymentStatus==='Paid'" [class.red]="inv.isOverdue">{{inv.paymentStatus==='Paid'?'Paid':inv.status}}</span></td><td class="money">{{inv.total|currency}}</td><td class="money">{{inv.balance|currency}}</td></tr>}
      </tbody></table></div>
    }
  }
</section>}</main>`,
  styles: `.tab-btn{background:none;border:none;padding:10px 14px;font-weight:700;font-size:14px;color:var(--muted);cursor:pointer;border-bottom:2px solid transparent;}.tab-btn.active{color:var(--teal);border-bottom-color:var(--teal);}`
})
export class CustomerLivePage {
  private api=inject(WorkApiService);customer=signal<Customer|null>(null);customerJobs=signal<Job[]>([]);customerEstimates=signal<Estimate[]>([]);customerInvoices=signal<Invoice[]>([]);activeTab=signal<'jobs'|'estimates'|'invoices'>('jobs');loading=signal(true);error=signal('');
  constructor(){
    const id=inject(ActivatedRoute).snapshot.paramMap.get('id')!;
    this.api.customer(id).subscribe({
      next:c=>{
        this.customer.set(c);
        this.api.jobs().subscribe({next:r=>this.customerJobs.set(r.items.filter(j=>j.customerId===id)),error:()=>{}});
        this.api.estimates().subscribe({next:r=>this.customerEstimates.set(r.filter(e=>e.customerName===c.name)),error:()=>{}});
        this.api.invoices().subscribe({next:r=>this.customerInvoices.set(r.filter(i=>i.customerName===c.name)),error:()=>{}});
        this.loading.set(false);
      },
      error:e=>{this.error.set(messageFrom(e));this.loading.set(false)}
    });
  }
  initials(name:string){return name.split(/\s+/).map(x=>x[0]).slice(0,2).join('').toUpperCase()}
  label(value:string){return value.replace(/([a-z])([A-Z])/g,'$1 $2')}
}

@Component({selector:'app-job-live',imports:[RouterLink,CurrencyPipe,FormsModule,NgSelectComponent],template:`
<main class="page">@if(loading()){<div class="card card-body muted">Loading job…</div>}@else if(error()&&!job()){<div class="card card-body callout error-text">{{error()}}</div>}@else if(job();as j){
<header class="page-head"><div><a class="back-link" routerLink="/app/jobs">← Back to jobs</a><p class="eyebrow">#{{j.jobNumber}}</p><h1>{{j.title}}</h1><p><a class="link" [routerLink]="['/app/customers', j.customerId]">{{customer()?.name||'Customer'}}</a> · {{customer()?.addressLine1}}</p></div>
<div class="page-actions">
  @if(j.status==='Draft'){
    <button class="btn primary" [disabled]="statusSaving()||scheduleSaving()" (click)="openScheduleModal()" id="schedule-visit-btn">📅 Schedule visit</button>
  }
  @else if(j.status==='Scheduled'){
    <button class="btn primary" [disabled]="statusSaving()" (click)="changeStatus('InProgress')" id="start-job-btn">→ Start job</button>
  }
  @else if(j.status==='InProgress'){
    <button class="btn primary" [disabled]="statusSaving()||financialSaving()" (click)="completeAndInvoice()" id="complete-job-btn">Complete & create invoice</button>
  }
  @else if(j.status==='Completed'){
    @if(existingInvoice(); as inv){
      <a class="btn primary" [routerLink]="['/app/invoices', inv.id]" id="view-invoice-btn">View invoice (#{{inv.invoiceNumber}})</a>
    } @else {
      <button class="btn primary" [disabled]="financialSaving()" (click)="createInvoice()" id="create-invoice-btn">＋ Create invoice</button>
    }
  }
</div></header>

<div class="progress-track" aria-label="Job progress">
  @for(step of progressSteps(); track step.name; let i = $index){
    <span class="progress-step" [class.done]="step.done" [class.current]="step.current">
      <i>{{step.done ? '✓' : (i + 1)}}</i>
      {{step.name}}
      @if(i < 4){<span class="connector"></span>}
    </span>
  }
</div>

@if(error()){<div class="callout error-text">{{error()}}</div>}@if(success()){<div class="callout">{{success()}}</div>}

<div class="detail-grid">
  <div class="stack">
    <!-- Visit Details Card -->
    <article class="card">
      <div class="card-head">
        <h2>Visit details</h2>
        <span class="badge" [class.amber]="j.status==='InProgress'" [class.blue]="j.status==='Scheduled'" [class.gray]="j.status==='Draft'" [class.teal]="j.status==='Completed'">
          {{label(j.status)}}
        </span>
      </div>
      <div class="card-body">
        <div class="detail-meta">
          <div>
            <small>Date & arrival</small>
            <strong>{{j.scheduledDate ? j.scheduledDate + ' · ' + (j.arrivalWindow || 'Flexible') : 'Unscheduled · Not set'}}</strong>
          </div>
          <div>
            <small>Assigned to</small>
            <strong>You</strong>
          </div>
          <div>
            <small>Priority</small>
            <strong>{{j.priority}}</strong>
          </div>
        </div>
        <p class="note">{{j.description || 'No internal notes added.'}}</p>
        @if(j.status !== 'Completed'){
          <button type="button" class="text-link" (click)="openScheduleModal()" id="change-visit-date-btn">Change visit date</button>
        }
      </div>
    </article>

    <!-- Services & Parts Card -->
    <article class="card">
      <div class="card-head">
        <div>
          <h2>Services & parts</h2>
          <p style="margin:2px 0 0;font-size:12px;color:var(--muted)">{{items().items.length}} item{{items().items.length !== 1 ? 's' : ''}} attached</p>
        </div>
        @if(j.status !== 'Completed'){
          <button type="button" class="btn small" (click)="openPickerModal()" id="add-items-btn">
            ＋ Add items
          </button>
        }
      </div>
      <div class="card-body">
        @if (!items().items.length) {
          <div style="text-align:center;padding:24px 12px">
            <p style="margin:0 0 12px;color:var(--muted);font-size:13px">No services or parts added yet. Attach catalog or custom items to this job.</p>
            @if(j.status !== 'Completed'){
              <button type="button" class="btn" (click)="openPickerModal()">
                ＋ Browse services & parts
              </button>
            }
          </div>
        } @else {
          <div class="line-items-list">
            @for (item of items().items; track $index; let idx = $index) {
              <div class="line-item-row">
                <div class="line-item-info">
                  <strong>{{item.description}}</strong>
                  <small>{{item.itemType}} · {{item.unitPrice | currency}} / {{item.unit}}</small>
                  @if(j.status !== 'Completed'){
                    <div>
                      <button type="button" class="remove-btn" (click)="removeItem(idx)">Remove</button>
                    </div>
                  }
                </div>
                <div class="stepper">
                  @if(j.status !== 'Completed'){
                    <button type="button" (click)="adjustQuantity(idx, -1)" [disabled]="item.quantity <= 1" aria-label="Decrease quantity">−</button>
                  }
                  <span>{{item.quantity}}</span>
                  @if(j.status !== 'Completed'){
                    <button type="button" (click)="adjustQuantity(idx, 1)" aria-label="Increase quantity">＋</button>
                  }
                </div>
                <div class="line-item-amount">
                  {{item.lineTotal | currency}}
                </div>
              </div>
            }
          </div>
          @if(j.status !== 'Completed'){
            <button type="button" class="btn" style="width:100%;margin-top:12px" (click)="openPickerModal()">
              ＋ Add more items
            </button>
          }
        }

        <div class="summary-total" style="display:flex;justify-content:space-between;align-items:center;border-top:1px solid var(--line);padding-top:16px;margin-top:20px;">
          <span style="font-size:13px;font-weight:600;color:var(--ink)">Job total</span>
          <strong style="font-size:20px;font-weight:700;color:var(--ink)">{{items().total | currency}}</strong>
        </div>
      </div>
    </article>

    <!-- Activity Card -->
    <article class="card">
      <div class="card-head">
        <h2>Activity</h2>
      </div>
      <div class="card-body">
        @if(j.status === 'Completed'){
          <div class="activity-row">
            <i class="activity-dot"></i>
            <div>
              <strong>Work completed</strong>
              <p>You · {{j.scheduledDate || 'Today'}}</p>
            </div>
          </div>
        } @else if(j.status === 'InProgress'){
          <div class="activity-row">
            <i class="activity-dot"></i>
            <div>
              <strong>Work started</strong>
              <p>You · {{j.scheduledDate || 'Today'}}</p>
            </div>
          </div>
        } @else if(j.status === 'Scheduled'){
          <div class="activity-row">
            <i class="activity-dot"></i>
            <div>
              <strong>Job scheduled</strong>
              <p>You · Visit date: {{j.scheduledDate}} ({{j.arrivalWindow || 'Flexible'}})</p>
            </div>
          </div>
        } @else {
          <div class="activity-row">
            <i class="activity-dot"></i>
            <div>
              <strong>Job created (Draft)</strong>
              <p>You · Unscheduled</p>
            </div>
          </div>
        }
        @for(est of existingEstimates(); track est.id){
          <div class="activity-row">
            <i class="activity-dot"></i>
            <div>
              <strong>Estimate {{est.status.toLowerCase()}}</strong>
              <p>#{{est.estimateNumber}} (rev {{est.revision}}) · {{est.total | currency}}</p>
            </div>
          </div>
        }
        @if(existingInvoice(); as inv){
          <div class="activity-row">
            <i class="activity-dot"></i>
            <div>
              <strong>Invoice {{inv.paymentStatus === 'Paid' ? 'paid' : inv.status.toLowerCase()}}</strong>
              <p>#{{inv.invoiceNumber}} · {{inv.total | currency}}</p>
            </div>
          </div>
        }
      </div>
    </article>
  </div>

  <aside class="stack">
    <!-- Customer Card -->
    @if(customer(); as c){
      <article class="card">
        <div class="card-head">
          <h2>Customer</h2>
        </div>
        <div class="card-body">
          <div class="customer-info">
            <span class="avatar">{{initials(c.name)}}</span>
            <div>
              <h3>{{c.name}}</h3>
              <p>{{c.customerType || 'Residential'}} customer</p>
            </div>
          </div>
          <div class="address-line">📍 {{c.addressLine1}}, {{c.city}} {{c.stateCode}} {{c.postalCode}}</div>
          <div class="address-line">📞 {{c.phone}}</div>
          <div class="address-line">✉️ {{c.email || 'No email provided'}}</div>
          <a [routerLink]="['/app/customers', c.id]" class="text-link" style="margin-top:14px">Customer details →</a>
        </div>
      </article>
    }

    <!-- Estimates & Invoices Card -->
    <article class="card">
      <div class="card-head">
        <h2>Estimates & invoices</h2>
      </div>
      <div class="card-body">
        @if(existingInvoice(); as inv){
          <a class="document-link" [routerLink]="['/app/invoices', inv.id]">
            <span>
              <b>#{{inv.invoiceNumber}}</b>
              <small>{{inv.balance | currency}} remaining</small>
            </span>
            <span class="badge" [class.teal]="inv.paymentStatus==='Paid'" [class.gray]="inv.status==='Draft'" [class.red]="inv.isOverdue">
              {{inv.paymentStatus==='Paid' ? 'Paid' : inv.status}}
            </span>
          </a>
        } @else {
          <button class="btn primary" style="width:100%" [disabled]="financialSaving()||j.status!=='Completed'||!items().items.length" (click)="createInvoice()" id="create-invoice-aside-btn">
            Create invoice
          </button>
          <p class="muted" style="font-size:11px;margin-top:10px;text-align:center">
            {{j.status === 'Completed' ? 'Ready to create an invoice.' : 'Complete the work to create an invoice.'}}
          </p>
        }

        @if(existingEstimates().length){
          <div style="margin-top:14px">
            @for(est of existingEstimates(); track est.id){
              <a class="document-link" [routerLink]="['/app/estimates', est.id]">
                <span>
                  <b>#{{est.estimateNumber}}</b>
                  <small>{{est.total | currency}} · Rev {{est.revision}}</small>
                </span>
                <span class="badge" [class.gray]="est.status==='Draft'" [class.amber]="est.status==='Sent'" [class.teal]="est.status==='Approved'">
                  {{est.status}}
                </span>
              </a>
            }
          </div>
        }
        <button class="btn" style="width:100%;margin-top:12px" [disabled]="financialSaving()||!items().items.length" (click)="createEstimate()" id="create-estimate-btn">
          {{existingEstimates().length ? '＋ Create revision estimate' : 'Create estimate'}}
        </button>
      </div>
    </article>
  </aside>
</div>
}

@if(showScheduleModal() && job(); as j){
  <div class="quick-modal-backdrop" (click)="closeScheduleModal()">
    <div class="quick-modal-card" (click)="$event.stopPropagation()" style="max-width:480px">
      <div class="modal-header">
        <h3>📅 Schedule visit for Job #{{j.jobNumber}}</h3>
        <button type="button" class="modal-close-btn" (click)="closeScheduleModal()">✕</button>
      </div>
      <div class="modal-body" style="display:flex;flex-direction:column;gap:14px">
        @if(scheduleError()){<div class="callout error-text">{{scheduleError()}}</div>}
        <div class="field" [class.has-error]="scheduleSubmitted() && !scheduleForm.scheduledDate">
          <label for="sched-visit-date">Visit date *</label>
          <input id="sched-visit-date" type="date" [(ngModel)]="scheduleForm.scheduledDate">
          @if(scheduleSubmitted() && !scheduleForm.scheduledDate){<span class="field-error">Visit date is required</span>}
        </div>
        <div class="field">
          <label for="sched-arrival-window">Arrival window</label>
          <ng-select id="sched-arrival-window"
            [items]="arrivalWindows"
            [searchable]="true"
            [clearable]="false"
            [(ngModel)]="scheduleForm.arrivalWindow"
            placeholder="Select arrival window">
          </ng-select>
        </div>
        <p class="muted" style="font-size:12px;margin:0">Workspace local time. Scheduling sets the job to Scheduled status and reserves the appointment.</p>
      </div>
      <div class="modal-footer" style="display:flex;justify-content:flex-end;gap:10px;padding:16px 20px;border-top:1px solid var(--line-soft);background:#fbfdfd">
        <button type="button" class="btn" (click)="closeScheduleModal()">Cancel</button>
        <button type="button" class="btn primary" [disabled]="scheduleSaving()" (click)="confirmSchedule()" id="confirm-schedule-btn">
          {{scheduleSaving() ? 'Scheduling…' : 'Confirm & schedule job'}}
        </button>
      </div>
    </div>
  </div>
}

<!-- Multi-Item Catalog Picker Modal -->
@if (showPickerModal()) {
  <div class="quick-modal-backdrop" (click)="closePickerModal()">
    <div class="quick-modal-card picker-modal-card" (click)="$event.stopPropagation()">
      <div class="modal-header">
        <div>
          <h3 style="margin:0">Add services & parts</h3>
          <p style="margin:3px 0 0;font-size:12px;color:var(--muted)">Pick several items. Adjust quantities on the job.</p>
        </div>
        <button type="button" class="modal-close-btn" (click)="closePickerModal()" aria-label="Close">✕</button>
      </div>
      <div class="modal-body" style="padding-bottom:12px">
        <div class="search-wrap" style="display:flex;align-items:center;gap:8px;border:1px solid var(--line);background:#fff;border-radius:8px;padding:0 12px;height:42px">
          <span style="color:var(--muted);font-size:15px">⌕</span>
          <input aria-label="Search catalog" placeholder="Search your price book…" [(ngModel)]="pickerSearch" style="border:0;outline:none;width:100%;font-size:13px;color:var(--ink)">
        </div>

        <div class="catalog-tabs">
          @for (tab of ['All', 'Service', 'Part', 'Labor']; track tab) {
            <button type="button" [class.active]="pickerTab === tab" (click)="pickerTab = tab">
              {{tab === 'All' ? 'All items' : tab === 'Labor' ? 'Labor' : tab + 's'}}
            </button>
          }
        </div>

        <div class="catalog-list">
          @for (c of filteredCatalog(); track c.id) {
            <div class="catalog-choice" [class.selected]="!!pickerSelections()[c.id]">
              <span class="item-symbol">{{c.itemType === 'Part' ? '📦' : c.itemType === 'Labor' ? '⏱️' : '🔧'}}</span>
              <div class="info">
                <strong>{{c.name}}</strong>
                <small>{{c.itemType}} · per {{c.unit || 'visit'}}</small>
              </div>
              <span class="price">{{c.unitPrice | currency}}</span>
              <button type="button" class="choice-action-btn" [class.selected]="pickerSelections()[c.id]" (click)="togglePickerItem(c)" [attr.aria-label]="pickerSelections()[c.id] ? 'Remove ' + c.name : 'Add ' + c.name">
                {{pickerSelections()[c.id] ? '✓' : '＋'}}
              </button>
            </div>
          }
          @if (!filteredCatalog().length) {
            <div class="muted" style="text-align:center;padding:20px;font-size:13px">No catalog items match this filter.</div>
          }
        </div>

        <div class="custom-item-section">
          <h4>Something different?</h4>
          <p>Add a custom item just for this job.</p>
          <div class="custom-item-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
            <div class="field">
              <label for="custom-name-live" style="font-size:11px;color:var(--ink);font-weight:600;margin-bottom:4px;display:block">Item name</label>
              <input id="custom-name-live" [(ngModel)]="customItemName" placeholder="e.g. Replacement valve" style="height:38px;font-size:12px;padding:0 10px;border-radius:7px">
            </div>
            <div class="field">
              <label for="custom-price-live" style="font-size:11px;color:var(--ink);font-weight:600;margin-bottom:4px;display:block">Unit price · USD</label>
              <input id="custom-price-live" type="number" step="0.01" min="0" [(ngModel)]="customItemPrice" placeholder="0.00" style="height:38px;font-size:12px;padding:0 10px;border-radius:7px">
            </div>
          </div>
          <button type="button" class="btn small" (click)="addCustomItemDirect()" [disabled]="!customItemName.trim()" style="min-height:36px;font-size:12px;padding:0 14px;border-radius:7px">
            ＋ Add custom item
          </button>
        </div>
      </div>
      <div class="modal-footer picker-footer">
        <span class="picker-count-label">
          <strong>{{pickerCount()}}</strong> {{pickerCount() === 1 ? 'item' : 'items'}} selected
        </span>
        <button type="button" class="btn primary picker-commit-btn" (click)="commitPickerModal()" [disabled]="pickerCount() === 0">
          ＋ Add to job
        </button>
      </div>
    </div>
  </div>
}
</main>`})
export class JobLivePage {
  private api=inject(WorkApiService);
  private router=inject(Router);
  private id=inject(ActivatedRoute).snapshot.paramMap.get('id')!;
  job=signal<Job|null>(null);
  customer=signal<Customer|null>(null);
  catalog=signal<CatalogItem[]>([]);
  items=signal<JobItemSet>({items:[],subtotal:0,discountTotal:0,taxTotal:0,total:0});
  existingInvoice=signal<Invoice|null>(null);
  existingEstimates=signal<Estimate[]>([]);
  loading=signal(true);
  savingItems=signal(false);
  statusSaving=signal(false);
  financialSaving=signal(false);
  error=signal('');
  success=signal('');
  readonly arrivalWindows = ARRIVAL_WINDOWS;
  showScheduleModal = signal(false);
  scheduleSaving = signal(false);
  scheduleSubmitted = signal(false);
  scheduleError = signal('');
  scheduleForm = {
    scheduledDate: '',
    arrivalWindow: '9:00 AM – 11:00 AM'
  };

  // Multi-item catalog picker modal state
  showPickerModal = signal(false);
  pickerSearch = '';
  pickerTab = 'All';
  pickerSelections = signal<Record<string, {
    catalogItemId?: string;
    itemType: string;
    description: string;
    unitPrice: number;
    quantity: number;
    unit: string;
  }>>({});
  customItemName = '';
  customItemPrice = 0;

  readonly filteredCatalog = computed(() => {
    let list = this.catalog();
    if (this.pickerTab !== 'All') {
      list = list.filter(i => i.itemType === this.pickerTab);
    }
    if (this.pickerSearch.trim()) {
      const q = this.pickerSearch.toLowerCase();
      list = list.filter(i => i.name.toLowerCase().includes(q));
    }
    return list;
  });

  readonly pickerCount = computed(() => Object.keys(this.pickerSelections()).length);

  readonly progressSteps = computed(() => {
    const s = this.job()?.status || 'Draft';
    const inv = this.existingInvoice();
    const isPaid = inv?.paymentStatus === 'Paid' || (inv && inv.balance === 0 && inv.total > 0);
    const isCompleted = s === 'Completed' || !!isPaid;
    const isInProgress = s === 'InProgress' || isCompleted;
    const isScheduled = s === 'Scheduled' || isInProgress;

    return [
      { name: 'Created', done: true, current: false },
      { name: 'Scheduled', done: isInProgress, current: s === 'Scheduled' },
      { name: 'In progress', done: isCompleted, current: s === 'InProgress' },
      { name: 'Completed', done: !!isPaid, current: s === 'Completed' && !isPaid },
      { name: 'Paid', done: !!isPaid, current: !!isPaid }
    ];
  });

  constructor(){
    this.api.catalog().subscribe({next:r=>this.catalog.set(r.items),error:()=>{}});
    this.api.jobItems(this.id).subscribe({next:r=>this.items.set(r),error:()=>{}});
    this.loadFinancials();
    this.api.job(this.id).subscribe({
      next:j=>{
        this.job.set(j);
        this.api.customer(j.customerId).subscribe({next:c=>{this.customer.set(c);this.loading.set(false)},error:()=>this.loading.set(false)});
      },
      error:e=>{this.error.set(messageFrom(e));this.loading.set(false)}
    });
  }

  private loadFinancials(){
    this.api.invoices().subscribe({next:r=>this.existingInvoice.set(r.find(x=>x.jobId===this.id)||null),error:()=>{}});
    this.api.estimates().subscribe({next:r=>this.existingEstimates.set(r.filter(x=>x.jobId===this.id)),error:()=>{}});
  }

  openPickerModal(): void {
    this.pickerSearch = '';
    this.pickerTab = 'All';
    this.pickerSelections.set({});
    this.customItemName = '';
    this.customItemPrice = 0;
    this.showPickerModal.set(true);
  }

  closePickerModal(): void {
    this.showPickerModal.set(false);
  }

  togglePickerItem(c: CatalogItem): void {
    this.pickerSelections.update(current => {
      const copy = { ...current };
      if (copy[c.id]) {
        delete copy[c.id];
      } else {
        copy[c.id] = {
          catalogItemId: c.id,
          itemType: c.itemType,
          description: c.name,
          unitPrice: c.unitPrice,
          quantity: 1,
          unit: c.unit || 'unit'
        };
      }
      return copy;
    });
  }

  commitPickerModal(): void {
    const selected = Object.values(this.pickerSelections());
    if (!selected.length) return;

    const newItems = selected.map(s => ({
      catalogItemId: s.catalogItemId,
      itemType: s.itemType as any,
      description: s.description,
      quantity: s.quantity,
      unit: s.unit,
      unitPrice: s.unitPrice,
      discountAmount: 0,
      taxAmount: 0
    }));

    const next = [...this.items().items, ...newItems];
    this.saveItems(next);
    this.closePickerModal();
  }

  addCustomItemDirect(): void {
    if (!this.customItemName.trim()) return;
    const newItem = {
      catalogItemId: undefined,
      itemType: 'Part' as const,
      description: this.customItemName.trim(),
      quantity: 1,
      unit: 'unit',
      unitPrice: Number(this.customItemPrice) || 0,
      discountAmount: 0,
      taxAmount: 0
    };
    const next = [...this.items().items, newItem];
    this.saveItems(next);
    this.customItemName = '';
    this.customItemPrice = 0;
    this.closePickerModal();
  }

  adjustQuantity(index: number, delta: number){
    const current = this.items().items;
    if (!current[index]) return;
    const newQty = current[index].quantity + delta;
    if (newQty <= 0) {
      this.removeItem(index);
      return;
    }
    const next = current.map((item, i) => i === index ? { ...item, quantity: newQty } : item);
    this.saveItems(next);
  }

  removeItem(index:number){this.saveItems(this.items().items.filter((_,i)=>i!==index))}
  private saveItems(next:JobItemSet['items']){this.savingItems.set(true);this.error.set('');this.api.replaceJobItems(this.id,next).subscribe({next:r=>{this.items.set(r);this.job.update(j=>j?{...j,total:r.total}:j);this.savingItems.set(false)},error:e=>{this.error.set(messageFrom(e));this.savingItems.set(false)}})}
  changeStatus(status:string){this.statusSaving.set(true);this.error.set('');this.success.set('');this.api.changeJobStatus(this.id,status).subscribe({next:j=>{this.job.set(j);this.statusSaving.set(false);this.success.set(`Job changed to ${this.label(j.status)}.`);this.loadFinancials();},error:e=>{this.error.set(messageFrom(e));this.statusSaving.set(false)}})}
  onScheduleJobClick(){
    const j = this.job();
    if(!j) return;
    if(j.scheduledDate){
      this.changeStatus('Scheduled');
    }else{
      this.openScheduleModal();
    }
  }
  openScheduleModal(){
    const j = this.job();
    this.scheduleForm = {
      scheduledDate: j?.scheduledDate || new Date().toISOString().slice(0, 10),
      arrivalWindow: j?.arrivalWindow || '9:00 AM – 11:00 AM'
    };
    this.scheduleSubmitted.set(false);
    this.scheduleError.set('');
    this.showScheduleModal.set(true);
  }
  closeScheduleModal(){
    this.showScheduleModal.set(false);
  }
  confirmSchedule(){
    this.scheduleSubmitted.set(true);
    if(!this.scheduleForm.scheduledDate){
      this.scheduleError.set('Please select a visit date.');
      return;
    }
    this.scheduleSaving.set(true);
    this.scheduleError.set('');
    this.api.scheduleJob(this.id, {
      scheduledDate: this.scheduleForm.scheduledDate,
      arrivalWindow: this.scheduleForm.arrivalWindow
    }).subscribe({
      next: updated => {
        this.job.set(updated);
        this.scheduleSaving.set(false);
        this.showScheduleModal.set(false);
        this.success.set(`Job scheduled for ${updated.scheduledDate}${updated.arrivalWindow ? ' · ' + updated.arrivalWindow : ''}.`);
        this.error.set('');
        this.loadFinancials();
      },
      error: e => {
        this.scheduleError.set(messageFrom(e));
        this.scheduleSaving.set(false);
      }
    });
  }
  completeAndInvoice(){
    if(this.job()?.status === 'Completed'){
      this.createInvoice();
      return;
    }
    this.statusSaving.set(true);
    this.error.set('');
    this.api.changeJobStatus(this.id,'Completed').subscribe({
      next:(updated)=>{
        this.job.set(updated);
        this.statusSaving.set(false);
        this.createInvoice();
      },
      error:e=>{
        this.error.set(messageFrom(e));
        this.statusSaving.set(false);
      }
    });
  }
  createEstimate(){const valid=new Date();valid.setDate(valid.getDate()+30);this.financialSaving.set(true);this.error.set('');this.api.createEstimate(this.id,valid.toISOString().slice(0,10)).subscribe({next:est=>this.router.navigate(['/app/estimates',est.id]),error:e=>{this.error.set(messageFrom(e));this.financialSaving.set(false)}})}
  createInvoice(){this.financialSaving.set(true);this.error.set('');this.api.createInvoice(this.id).subscribe({next:inv=>this.router.navigate(['/app/invoices',inv.id]),error:e=>{this.error.set(messageFrom(e));this.financialSaving.set(false)}})}
  label(value:string){return value.replace(/([a-z])([A-Z])/g,'$1 $2')}
  initials(name:string){return (name||'').split(/\s+/).map(x=>x[0]).slice(0,2).join('').toUpperCase()}
}

