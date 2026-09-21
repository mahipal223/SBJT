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

@Component({selector:'app-jobs-live',imports:[RouterLink,FormsModule,CurrencyPipe,NgSelectComponent],template:`
<main class="page"><header class="page-head"><div><p class="eyebrow">Work orders</p><h1>Jobs</h1><p>Track every visit from request through completion.</p></div><a class="btn primary" routerLink="/app/jobs/new">＋ Create job</a></header><section class="grid cols-4"><article class="card stat"><span class="stat-label">All jobs</span><strong class="stat-value">{{jobs().length}}</strong><span class="stat-meta">Loaded from your workspace</span></article><article class="card stat"><span class="stat-label">Scheduled</span><strong class="stat-value">{{statusCount('Scheduled')}}</strong><span class="stat-meta">Ready for service</span></article><article class="card stat"><span class="stat-label">In progress</span><strong class="stat-value">{{statusCount('InProgress')}}</strong><span class="stat-meta">Active work</span></article><article class="card stat"><span class="stat-label">This period</span><strong class="stat-value">{{jobs().length}} / 100</strong><span class="stat-meta">Jobs in billing period</span></article></section>
<section class="card section-gap"><div class="toolbar"><div class="search"><input placeholder="Search job number or title" [(ngModel)]="search" (ngModelChange)="load()"></div><ng-select class="filter-ng-select" [items]="jobStatusOptions" bindLabel="label" bindValue="value" [clearable]="false" [searchable]="false" [(ngModel)]="status" (change)="load()"></ng-select></div>
@if(loading()){<div class="card-body muted">Loading jobs…</div>}@else if(error()){<div class="card-body callout error-text">{{error()}}</div>}@else if(!jobs().length){<div class="empty-state"><h2>No matching jobs</h2><p>Create a job or change the filters.</p></div>}@else{<div class="table-scroll"><table class="data-table"><thead><tr><th>Job</th><th>Customer</th><th>Schedule</th><th>Priority</th><th>Status</th><th>Total</th></tr></thead><tbody>@for(j of jobs();track j.id){<tr><td><a class="cell-main link" [routerLink]="['/app/jobs',j.id]"><strong>#{{j.jobNumber}} · {{j.title}}</strong><small>{{j.description || 'No description'}}</small></a></td><td>{{customerName(j.customerId)}}</td><td>{{j.scheduledDate || 'Unscheduled'}}<small class="cell-main">{{j.arrivalWindow || '—'}}</small></td><td>{{j.priority}}</td><td><span class="badge" [class.amber]="j.status==='InProgress'" [class.blue]="j.status==='Scheduled'" [class.gray]="j.status==='Draft'">{{label(j.status)}}</span></td><td class="money">{{j.total | currency}}</td></tr>}</tbody></table></div>}</section></main>`})
export class JobsLivePage {
  private api=inject(WorkApiService);jobs=signal<Job[]>([]);customers=signal<Customer[]>([]);loading=signal(true);error=signal('');search='';status='';
  readonly jobStatusOptions = [
    { value: '', label: 'Status: All' },
    { value: 'Draft', label: 'Draft' },
    { value: 'Scheduled', label: 'Scheduled' },
    { value: 'InProgress', label: 'In progress' },
    { value: 'Completed', label: 'Completed' },
    { value: 'Cancelled', label: 'Canceled' }
  ];
  constructor(){this.api.customers().subscribe({next:r=>this.customers.set(r.items),error:()=>{}});this.load()}
  load(){this.loading.set(true);this.api.jobs(this.search,this.status).subscribe({next:r=>{this.jobs.set(r.items);this.loading.set(false)},error:e=>{this.error.set(messageFrom(e));this.loading.set(false)}})}
  statusCount(status:string){return this.jobs().filter(x=>x.status===status).length} customerName(id:string){return this.customers().find(x=>x.id===id)?.name||'Customer'} label(value:string){return value.replace(/([a-z])([A-Z])/g,'$1 $2')}
}

@Component({selector:'app-job-form-live',imports:[RouterLink,FormsModule,NgSelectComponent,CurrencyPipe],template:`
<main class="page"><header class="page-head"><div><nav class="breadcrumb"><a routerLink="/app/jobs">Jobs</a><span class="crumb-sep">/</span><span class="crumb-current">New job</span></nav><h1>Create job</h1><p>Schedule now or save as an unscheduled request.</p></div><a class="btn" routerLink="/app/jobs">Cancel</a></header><section class="card"><div class="card-head"><h2>Job details</h2><span class="badge blue">{{model.scheduledDate ? 'Scheduled' : 'Draft'}}</span></div>
<form class="card-body form-grid" (ngSubmit)="save(false)" novalidate>
  <div class="field wide" [class.has-error]="hasError('customerId')">
    <div class="field-header-row">
      <label for="customerId">Customer *</label>
      <button type="button" class="btn-inline-action" (click)="openQuickCustomerModal()">
        ＋ New customer
      </button>
    </div>
    <ng-select id="customerId" name="customerId"
      [items]="customers()"
      bindLabel="name"
      bindValue="id"
      [(ngModel)]="model.customerId"
      (blur)="markTouched('customerId')"
      (change)="onCustomerSelected()"
      placeholder="Search customer by name, phone, or address...">
      <ng-template ng-option-tmp let-item="item">
        <div><strong>{{item.name}}</strong> · <small class="muted">{{item.phone}} · {{item.addressLine1}}, {{item.city}}</small></div>
      </ng-template>
    </ng-select>
    @if(hasError('customerId')){<span class="field-error" id="customer-error">{{errorMessage('customerId')}}</span>}
    @if(selectedCustomer(); as sc){
      <div class="customer-preview-card">
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
    <input id="title" name="title" [(ngModel)]="model.title" (blur)="markTouched('title')" (input)="onInput('title')" placeholder="e.g. Water heater inspection">
    <div class="quick-chips">
      <span class="chips-label">Quick fill:</span>
      @for(t of titleSuggestions; track t){
        <button type="button" class="chip-btn" [class.active]="model.title===t" (click)="setTitle(t)">{{t}}</button>
      }
    </div>
    @if(hasError('title')){<span class="field-error" id="title-error">{{errorMessage('title')}}</span>}
  </div>

  <div class="field">
    <label for="priority">Priority</label>
    <ng-select id="priority" name="priority"
      [items]="['Normal', 'High', 'Emergency']"
      [clearable]="false"
      [searchable]="false"
      [(ngModel)]="model.priority">
    </ng-select>
  </div>

  <div class="field">
    <label for="scheduledDate">Date</label>
    <input id="scheduledDate" name="scheduledDate" type="date" [(ngModel)]="model.scheduledDate" (change)="onDateChange()">
    <div class="quick-chips">
      <span class="chips-label">Quick date:</span>
      <button type="button" class="chip-btn" [class.active]="isToday()" (click)="setDateToday()">Today</button>
      <button type="button" class="chip-btn" [class.active]="isTomorrow()" (click)="setDateTomorrow()">Tomorrow</button>
      <button type="button" class="chip-btn" [class.active]="isNextMonday()" (click)="setDateNextMonday()">Next Mon</button>
      <button type="button" class="chip-btn" [class.active]="!model.scheduledDate" (click)="clearDate()">Unscheduled</button>
    </div>
  </div>

  <div class="field wide">
    <label for="arrivalWindow">Arrival window</label>
    <ng-select id="arrivalWindow" name="arrivalWindow"
      [items]="arrivalWindows"
      [addTag]="true"
      [(ngModel)]="model.arrivalWindow"
      placeholder="Select arrival window or type custom time (e.g. 9:00 AM – 10:30 AM)...">
    </ng-select>
    <div class="quick-chips">
      <span class="chips-label">Preset window:</span>
      <button type="button" class="chip-btn" [class.active]="model.arrivalWindow==='8:00 AM – 12:00 PM'" (click)="setWindow('8:00 AM – 12:00 PM')">Morning (8-12)</button>
      <button type="button" class="chip-btn" [class.active]="model.arrivalWindow==='12:00 PM – 4:00 PM'" (click)="setWindow('12:00 PM – 4:00 PM')">Afternoon (12-4)</button>
      <button type="button" class="chip-btn" [class.active]="model.arrivalWindow==='4:00 PM – 8:00 PM'" (click)="setWindow('4:00 PM – 8:00 PM')">Evening (4-8)</button>
    </div>
  </div>

  <div class="field wide" style="background:#f8fafb;border:1px solid var(--line);border-radius:10px;padding:16px;">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
      <label style="font-weight:700;margin:0">Initial service / diagnostic fee <span class="muted" style="font-weight:400">(Optional)</span></label>
      @if(selectedInitialService){
        <button type="button" class="btn small" style="padding:2px 8px;font-size:12px" (click)="clearInitialService()">✕ Clear service</button>
      }
    </div>
    <p class="muted" style="font-size:13px;margin:0 0 10px">Attach standard dispatch or diagnostic pricing directly to this job. You decide your rate.</p>

    @if(catalogServices().length){
      <div class="quick-chips" style="margin-bottom:12px">
        <span class="chips-label">Catalog services:</span>
        @for(item of catalogServices(); track item.id){
          <button type="button" class="chip-btn"
            [class.active]="selectedInitialService?.catalogItemId === item.id"
            (click)="selectInitialCatalogService(item)">
            {{selectedInitialService?.catalogItemId === item.id ? '✔ ' : '＋ '}}{{item.name}} ({{item.unitPrice|currency}})
          </button>
        }
        <button type="button" class="chip-btn"
          [class.active]="isCustomInitialService"
          (click)="selectCustomInitialService()">
          {{isCustomInitialService ? '✔ ' : '＋ '}}Custom service...
        </button>
      </div>
    }

    @if(selectedInitialService){
      <div class="form-grid" style="grid-template-columns: 2fr 1fr 1fr; gap:12px; align-items:end; margin-top:10px; background:#fff; border:1px solid var(--line); border-radius:8px; padding:12px;">
        <div class="field">
          <label for="init-service-name">Service description</label>
          <input id="init-service-name" name="initServiceName" [(ngModel)]="selectedInitialService.description" placeholder="e.g. Diagnostic Call">
        </div>
        <div class="field">
          <label for="init-service-rate">Your rate ($) *</label>
          <input id="init-service-rate" name="initServiceRate" type="number" step="0.01" min="0" [(ngModel)]="selectedInitialService.unitPrice" placeholder="0.00">
        </div>
        <div class="field">
          <label for="init-service-qty">Qty</label>
          <input id="init-service-qty" name="initServiceQty" type="number" step="1" min="1" [(ngModel)]="selectedInitialService.quantity">
        </div>
      </div>
    }
  </div>

  <div class="field wide"><label for="description">Customer request / internal instructions</label><textarea id="description" name="description" rows="3" [(ngModel)]="model.description" placeholder="Notes, gate codes, access instructions..."></textarea></div>

  @if(success()){<div class="wide callout" style="background:#e6f7f5;border-color:var(--teal);color:var(--teal);display:flex;align-items:center;justify-content:space-between"><span>✅ {{success()}}</span><button type="button" class="btn small" (click)="success.set('')">✕</button></div>}
  @if(error()){<div class="wide callout error-text" id="job-form-error">{{error()}}</div>}

  <div class="wide page-actions">
    <button class="btn primary" type="submit" [disabled]="saving()" id="submit-job-btn">{{saving()?'Creating…':model.scheduledDate?'Create & schedule job':'Save unscheduled'}}</button>
    <button class="btn" type="button" [disabled]="saving()" (click)="save(true)" id="submit-add-another-btn">Save & create another</button>
    <a class="btn" routerLink="/app/jobs">Cancel</a>
  </div>
</form></section>

<!-- Quick Add Customer Modal -->
@if(showQuickCustomerModal()){
  <div class="quick-modal-backdrop" (click)="closeQuickCustomerModal()">
    <div class="quick-modal-card" (click)="$event.stopPropagation()">
      <div class="modal-header">
        <h3>＋ Quick Add Customer</h3>
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
</main>`})
export class JobFormLivePage {
  private api=inject(WorkApiService);private router=inject(Router);private route=inject(ActivatedRoute);
  customers=signal<Customer[]>([]);
  catalogServices=signal<CatalogItem[]>([]);
  selectedInitialService: {
    catalogItemId?: string;
    description: string;
    unitPrice: number;
    quantity: number;
    unit: string;
    itemType: string;
  } | null = null;
  isCustomInitialService = false;
  saving=signal(false);
  error=signal('');
  success=signal('');
  submitted=signal(false);
  touched=signal<Record<string,boolean>>({});
  errors=signal<Record<string,string>>({});
  model={customerId:null as string | null,title:'',description:'',priority:'Normal',scheduledDate:'',arrivalWindow:''};
  readonly arrivalWindows = ARRIVAL_WINDOWS;

  readonly selectedCustomer = computed(() =>
    this.customers().find(c => c.id === this.model.customerId) || null
  );

  readonly titleSuggestions = [
    'Diagnostic Call',
    'Annual Maintenance',
    'Emergency Repair',
    'Water Heater Inspection',
    'System Tune-up',
    'Installation'
  ];

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

  constructor(){
    const prefillCustomer = this.route.snapshot.queryParamMap.get('customerId');
    if (prefillCustomer) {
      this.model.customerId = prefillCustomer;
    }
    this.api.customers().subscribe({next:r=>this.customers.set(r.items),error:e=>this.error.set(messageFrom(e))});
    this.api.catalog().subscribe({
      next: r => this.catalogServices.set(r.items.filter(i => i.itemType === 'Service' || i.itemType === 'Labor' || !i.itemType)),
      error: () => {}
    });
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
      next: (created) => {
        this.customers.update(list => [created, ...list]);
        this.model.customerId = created.id;
        this.onCustomerSelected();
        this.quickCustomerSaving.set(false);
        this.showQuickCustomerModal.set(false);
      },
      error: (e) => {
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

  private formatDate(d: Date): string {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  setDateToday(): void {
    this.model.scheduledDate = this.formatDate(new Date());
    if (!this.model.arrivalWindow) {
      this.model.arrivalWindow = '8:00 AM – 12:00 PM';
    }
  }

  setDateTomorrow(): void {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    this.model.scheduledDate = this.formatDate(d);
    if (!this.model.arrivalWindow) {
      this.model.arrivalWindow = '8:00 AM – 12:00 PM';
    }
  }

  setDateNextMonday(): void {
    const d = new Date();
    const day = d.getDay();
    const diff = (day === 0 ? 1 : 8 - day);
    d.setDate(d.getDate() + diff);
    this.model.scheduledDate = this.formatDate(d);
    if (!this.model.arrivalWindow) {
      this.model.arrivalWindow = '8:00 AM – 12:00 PM';
    }
  }

  clearDate(): void {
    this.model.scheduledDate = '';
    this.model.arrivalWindow = '';
  }

  onDateChange(): void {
    if (this.model.scheduledDate && !this.model.arrivalWindow) {
      this.model.arrivalWindow = '8:00 AM – 12:00 PM';
    }
  }

  setWindow(w: string): void {
    this.model.arrivalWindow = w;
  }

  isToday(): boolean {
    return this.model.scheduledDate === this.formatDate(new Date());
  }

  isTomorrow(): boolean {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return this.model.scheduledDate === this.formatDate(d);
  }

  isNextMonday(): boolean {
    const d = new Date();
    const day = d.getDay();
    const diff = (day === 0 ? 1 : 8 - day);
    d.setDate(d.getDate() + diff);
    return this.model.scheduledDate === this.formatDate(d);
  }

  validateField(field: string): string {
    if (field === 'customerId') {
      if (!this.model.customerId) return 'Please select a customer.';
    }
    if (field === 'title') {
      if (!this.model.title?.trim()) return 'Job title is required.';
      if (this.model.title.trim().length < 3) return 'Job title must be at least 3 characters.';
    }
    return '';
  }

  runValidation(): boolean {
    const errs: Record<string, string> = {};
    for (const f of ['customerId', 'title']) {
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

  selectInitialCatalogService(item: CatalogItem): void {
    if (this.selectedInitialService?.catalogItemId === item.id) {
      this.clearInitialService();
      return;
    }
    this.isCustomInitialService = false;
    this.selectedInitialService = {
      catalogItemId: item.id,
      description: item.name,
      unitPrice: item.unitPrice,
      quantity: 1,
      unit: item.unit || 'hr',
      itemType: item.itemType || 'Service'
    };
  }

  selectCustomInitialService(): void {
    if (this.isCustomInitialService) {
      this.clearInitialService();
      return;
    }
    this.isCustomInitialService = true;
    this.selectedInitialService = {
      description: 'Initial Diagnostic / Service Call',
      unitPrice: 0,
      quantity: 1,
      unit: 'hr',
      itemType: 'Service'
    };
  }

  clearInitialService(): void {
    this.isCustomInitialService = false;
    this.selectedInitialService = null;
  }

  private resetForm(): void {
    this.model = { customerId: null, title: '', description: '', priority: 'Normal', scheduledDate: '', arrivalWindow: '' };
    this.clearInitialService();
    this.submitted.set(false);
    this.touched.set({});
    this.errors.set({});
  }

  save(createAnother = false){
    this.submitted.set(true);
    this.error.set('');
    this.success.set('');
    if (!this.runValidation()) return;
    if(this.saving())return;
    this.saving.set(true);
    const command={...this.model,customerId:this.model.customerId!,scheduledDate:this.model.scheduledDate||undefined};
    this.api.createJob(command).subscribe({
      next:j=>{
        if (this.selectedInitialService && this.selectedInitialService.description.trim()) {
          const initItem = {
            catalogItemId: this.selectedInitialService.catalogItemId || undefined,
            itemType: this.selectedInitialService.itemType || 'Service',
            description: this.selectedInitialService.description.trim(),
            quantity: Number(this.selectedInitialService.quantity) || 1,
            unit: this.selectedInitialService.unit || 'hr',
            unitPrice: Number(this.selectedInitialService.unitPrice) || 0,
            discountAmount: 0,
            taxAmount: 0
          };
          this.api.replaceJobItems(j.id, [initItem]).subscribe({
            next: () => {
              this.saving.set(false);
              if (createAnother) {
                this.success.set(`Job #${j.jobNumber} ("${j.title}") created with initial service! Ready for next job.`);
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
      error:e=>{this.error.set(messageFrom(e));this.saving.set(false)}
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
<header class="page-head"><div><nav class="breadcrumb"><a routerLink="/app/jobs">Jobs</a><span class="crumb-sep">/</span><span class="crumb-current">#{{j.jobNumber}}</span></nav><div class="title-with-badge"><h1>Job #{{j.jobNumber}} · {{j.title}}</h1><span class="badge" [class.amber]="j.status==='InProgress'" [class.blue]="j.status==='Scheduled'" [class.gray]="j.status==='Draft'" [class.teal]="j.status==='Completed'">{{label(j.status)}}</span></div><p><a class="link" [routerLink]="['/app/customers', j.customerId]">{{customer()?.name||'Customer'}}</a> · {{customer()?.addressLine1}}</p></div>
<div class="page-actions">
  @if(j.status==='Draft'){
    <button class="btn primary" [disabled]="statusSaving()" (click)="changeStatus('Scheduled')">Schedule job</button>
    <button class="btn" [disabled]="statusSaving()||financialSaving()" (click)="completeAndInvoice()">Complete & create invoice</button>
  }
  @else if(j.status==='Scheduled'){
    <button class="btn primary" [disabled]="statusSaving()" (click)="changeStatus('InProgress')">Start job</button>
    <button class="btn" [disabled]="statusSaving()||financialSaving()" (click)="completeAndInvoice()">Complete & create invoice</button>
  }
  @else if(j.status==='InProgress'){
    <button class="btn primary" [disabled]="statusSaving()||financialSaving()" (click)="completeAndInvoice()">Complete & create invoice</button>
    <button class="btn" [disabled]="statusSaving()" (click)="changeStatus('Completed')">Mark complete</button>
  }
  @else if(j.status==='Completed' && !existingInvoice()){
    <button class="btn primary" [disabled]="financialSaving()" (click)="createInvoice()">＋ Create invoice</button>
  }
</div></header>
@if(error()){<div class="callout error-text">{{error()}}</div>}@if(success()){<div class="callout">{{success()}}</div>}
<section class="split"><div class="grid"><article class="card"><div class="card-head"><h2>Work summary</h2><span class="badge blue">{{label(j.status)}}</span></div><div class="card-body"><p>{{j.description||'No work instructions were entered.'}}</p><div class="list"><div class="list-row"><span class="muted">Priority</span><strong>{{j.priority}}</strong></div><div class="list-row"><span class="muted">Scheduled</span><strong>{{j.scheduledDate||'Unscheduled'}}</strong></div><div class="list-row"><span class="muted">Arrival window</span><strong>{{j.arrivalWindow||'—'}}</strong></div></div></div></article>

<article class="card"><div class="card-head"><h2>Services & materials</h2></div><div class="card-body">
  @if(catalogServices().length){
    <div class="quick-chips" style="margin-bottom:14px">
      <span class="chips-label">Quick services:</span>
      @for(c of catalogServices(); track c.id){
        <button type="button" class="chip-btn" (click)="pickCatalogPreset(c)">＋ {{c.name}} ({{c.unitPrice|currency}})</button>
      }
    </div>
  }

  <div style="margin-bottom:14px">
    <label for="unified-item-search" style="font-size:13px;font-weight:600;display:block;margin-bottom:4px">
      Search catalog or type custom part / service:
    </label>
    <ng-select id="unified-item-search"
      [items]="catalog()"
      bindLabel="name"
      [addTag]="addCustomTag"
      addTagText="＋ Add custom:"
      [ngModel]="selectedItemForCombobox"
      (ngModelChange)="onComboboxSelect($event)"
      placeholder="Type to search catalog parts, or enter a custom item name...">
      <ng-template ng-option-tmp let-item="item">
        <div style="display:flex;justify-content:space-between;align-items:center;width:100%">
          <span>
            <strong>{{item.name}}</strong>
            <small class="badge small" [class.blue]="item.itemType==='Part'" [class.amber]="item.itemType==='Labor'">{{item.itemType}}</small>
          </span>
          <strong>{{item.unitPrice|currency}}</strong>
        </div>
      </ng-template>
    </ng-select>
  </div>

  @if(activeEntry){
    <div class="form-grid" style="background:#f8fafb;border:1px solid var(--teal, #008080);border-radius:10px;padding:16px;margin-bottom:16px;">
      <div class="wide" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:-4px">
        <strong style="color:var(--text);font-size:14px">
          {{activeEntry.isCustom ? '＋ New custom item / one-off' : '✔ Catalog item: ' + activeEntry.name}}
        </strong>
        <button type="button" class="btn small" style="padding:2px 8px;font-size:12px" (click)="cancelActiveEntry()">✕ Cancel</button>
      </div>

      <div class="field wide">
        <label for="entry-desc">Description *</label>
        <input id="entry-desc" [(ngModel)]="activeEntry.name" placeholder="Item or service description">
      </div>

      <div class="field">
        <label for="entry-type">Type</label>
        <ng-select id="entry-type" [items]="['Part', 'Labor', 'Service']" [clearable]="false" [searchable]="false" [(ngModel)]="activeEntry.itemType"></ng-select>
      </div>

      <div class="field">
        <label for="entry-qty">Quantity</label>
        <input id="entry-qty" type="number" step="1" min="0.01" [(ngModel)]="activeEntry.quantity">
      </div>

      <div class="field">
        <label for="entry-unit">Unit</label>
        <ng-select id="entry-unit" [items]="catalogUnits" [clearable]="false" [(ngModel)]="activeEntry.unit" placeholder="unit"></ng-select>
      </div>

      <div class="field">
        <label for="entry-rate">Your rate ($) *</label>
        <input id="entry-rate" type="number" step="0.01" min="0" [(ngModel)]="activeEntry.unitPrice" placeholder="0.00">
      </div>

      @if(activeEntry.isCustom){
        <div class="wide" style="display:flex;align-items:center;gap:8px;margin-top:4px">
          <input type="checkbox" id="save-catalog-check" [(ngModel)]="activeEntry.saveToCatalog">
          <label for="save-catalog-check" style="font-size:13px;cursor:pointer;margin:0">Save this item to catalog for future jobs</label>
        </div>
      }

      <div class="wide" style="display:flex;gap:10px;margin-top:6px">
        <button type="button" class="btn primary" (click)="commitActiveEntry()" [disabled]="!activeEntry.name.trim() || activeEntry.quantity <= 0 || activeEntry.unitPrice < 0" id="add-to-job-btn">
          ＋ Add to job
        </button>
        <button type="button" class="btn" (click)="cancelActiveEntry()">Cancel</button>
      </div>
    </div>
  }

  @if(items().items.length){
    <div class="table-scroll section-gap">
      <table class="data-table">
        <thead>
          <tr>
            <th>Item</th>
            <th>Type</th>
            <th style="min-width:140px">Quantity</th>
            <th style="min-width:110px">Rate ($)</th>
            <th>Line Total</th>
            <th style="width:50px"></th>
          </tr>
        </thead>
        <tbody>
          @for(i of items().items; track $index){
            <tr>
              <td><strong>{{i.description}}</strong></td>
              <td><span class="badge small" [class.blue]="i.itemType==='Part'" [class.amber]="i.itemType==='Labor'">{{i.itemType}}</span></td>
              <td>
                <div style="display:inline-flex;align-items:center;gap:4px">
                  <button type="button" class="btn small" style="padding:2px 8px;min-height:28px" (click)="adjustQuantity($index, -1)">−</button>
                  <input type="number" min="0.01" step="1" [ngModel]="i.quantity" (ngModelChange)="updateItemQuantity($index, $event)" style="width:60px;text-align:center;padding:2px 4px;height:28px;font-size:13px;margin:0 2px" />
                  <span class="muted" style="font-size:12px">{{i.unit}}</span>
                  <button type="button" class="btn small" style="padding:2px 8px;min-height:28px" (click)="adjustQuantity($index, 1)">＋</button>
                </div>
              </td>
              <td>
                <div style="display:inline-flex;align-items:center;gap:4px">
                  <span>$</span>
                  <input type="number" min="0" step="0.01" [ngModel]="i.unitPrice" (ngModelChange)="updateItemPrice($index, $event)" style="width:80px;padding:2px 6px;height:28px;font-size:13px" />
                </div>
              </td>
              <td class="money">{{i.lineTotal|currency}}</td>
              <td><button type="button" class="btn small danger" (click)="removeItem($index)" title="Remove item">✕</button></td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  }
</div></article></div>

<aside class="grid"><article class="card"><div class="card-head"><h2>Job total</h2></div><div class="card-body list"><div class="list-row"><span>Subtotal</span><strong>{{items().subtotal|currency}}</strong></div><div class="list-row"><span>Discount</span><strong>{{items().discountTotal|currency}}</strong></div><div class="list-row"><span>Tax</span><strong>{{items().taxTotal|currency}}</strong></div><div class="list-row"><strong>Total</strong><strong class="stat-value">{{items().total|currency}}</strong></div>@if(savingItems()){<span class="muted">Saving line items…</span>}</div></article>
<article class="card"><div class="card-head"><h2>Financial documents</h2></div><div class="card-body grid">
  @if(existingInvoice(); as inv){
    <div class="associated-docs">
      <span class="muted">Generated invoice:</span>
      <a class="doc-pill" [routerLink]="['/app/invoices', inv.id]">
        <span><strong>#{{inv.invoiceNumber}}</strong> · {{inv.total|currency}}</span>
        <span class="badge" [class.gray]="inv.status==='Draft'" [class.red]="inv.isOverdue" [class.teal]="inv.paymentStatus==='Paid'">{{inv.paymentStatus==='Paid'?'Paid':inv.status}}</span>
      </a>
    </div>
    <a class="btn primary" [routerLink]="['/app/invoices', inv.id]" id="view-invoice-btn">View invoice (#{{inv.invoiceNumber}} · {{inv.paymentStatus==='Paid'?'Paid':inv.status}})</a>
  }@else{
    <button class="btn primary" [disabled]="financialSaving()" (click)="createInvoice()" id="create-invoice-btn">Create invoice</button>
  }
  @if(existingEstimates().length){
    <div class="associated-docs">
      <span class="muted">Estimates:</span>
      @for(est of existingEstimates();track est.id){
        <a class="doc-pill" [routerLink]="['/app/estimates', est.id]">
          <span><strong>#{{est.estimateNumber}}</strong> (rev {{est.revision}}) · {{est.total|currency}}</span>
          <span class="badge" [class.gray]="est.status==='Draft'" [class.amber]="est.status==='Sent'" [class.teal]="est.status==='Approved'">{{est.status}}</span>
        </a>
      }
    </div>
  }
  <button class="btn" [disabled]="financialSaving()||!items().items.length" (click)="createEstimate()" id="create-estimate-btn">{{existingEstimates().length?'＋ Create revision estimate':'Create estimate'}}</button>
  <small class="muted">Invoices track balances and payment status. Once created, click View invoice to review or settle.</small>
</div></article></aside></section>}</main>`})
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

  readonly catalogUnits = CATALOG_UNITS;
  selectedItemForCombobox: any = null;
  activeEntry: {
    catalogItemId?: string;
    isCustom: boolean;
    name: string;
    itemType: 'Part' | 'Labor' | 'Service';
    quantity: number;
    unit: string;
    unitPrice: number;
    saveToCatalog?: boolean;
  } | null = null;

  readonly catalogServices = computed(() =>
    this.catalog().filter(i => i.itemType === 'Service' || i.itemType === 'Labor').slice(0, 5)
  );

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

  addCustomTag = (term: string) => {
    return {
      id: '',
      name: term,
      itemType: 'Part',
      unitPrice: 0,
      unit: 'unit',
      isCustom: true
    };
  };

  onComboboxSelect(item: any) {
    if (!item) {
      this.selectedItemForCombobox = null;
      return;
    }
    if (typeof item === 'string') {
      item = this.addCustomTag(item);
    }
    this.activeEntry = {
      catalogItemId: item.isCustom ? undefined : item.id,
      isCustom: !!item.isCustom,
      name: item.name,
      itemType: (item.itemType as any) || (item.isCustom ? 'Part' : 'Service'),
      quantity: 1,
      unit: item.unit || 'unit',
      unitPrice: Number(item.unitPrice) || 0,
      saveToCatalog: false
    };
    this.selectedItemForCombobox = null;
  }

  pickCatalogPreset(c: CatalogItem) {
    this.activeEntry = {
      catalogItemId: c.id,
      isCustom: false,
      name: c.name,
      itemType: (c.itemType as any) || 'Service',
      quantity: 1,
      unit: c.unit || 'hr',
      unitPrice: c.unitPrice,
      saveToCatalog: false
    };
  }

  cancelActiveEntry() {
    this.activeEntry = null;
    this.selectedItemForCombobox = null;
  }

  commitActiveEntry() {
    if (!this.activeEntry || !this.activeEntry.name.trim() || this.activeEntry.quantity <= 0 || this.activeEntry.unitPrice < 0) return;
    const entry = this.activeEntry;
    const nextItem = {
      catalogItemId: entry.catalogItemId,
      itemType: entry.itemType,
      description: entry.name.trim(),
      quantity: Number(entry.quantity),
      unit: entry.unit || 'unit',
      unitPrice: Number(entry.unitPrice),
      discountAmount: 0,
      taxAmount: 0
    };
    const next = [...this.items().items, nextItem];
    this.saveItems(next);

    if (entry.isCustom && entry.saveToCatalog) {
      this.api.createCatalogItem({
        name: entry.name.trim(),
        itemType: entry.itemType,
        unit: entry.unit || 'unit',
        unitCost: 0,
        unitPrice: Number(entry.unitPrice),
        taxCategory: 'Standard'
      }).subscribe({
        next: created => {
          this.catalog.update(list => [...list, created]);
        },
        error: () => {}
      });
    }

    this.activeEntry = null;
    this.selectedItemForCombobox = null;
  }

  updateItemQuantity(index: number, newQty: any) {
    const qty = Number(newQty);
    if (isNaN(qty) || qty <= 0) return;
    const current = this.items().items;
    if (!current[index]) return;
    const next = current.map((item, i) => i === index ? { ...item, quantity: qty } : item);
    this.saveItems(next);
  }

  updateItemPrice(index: number, newPrice: any) {
    const price = Number(newPrice);
    if (isNaN(price) || price < 0) return;
    const current = this.items().items;
    if (!current[index]) return;
    const next = current.map((item, i) => i === index ? { ...item, unitPrice: price } : item);
    this.saveItems(next);
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
}

