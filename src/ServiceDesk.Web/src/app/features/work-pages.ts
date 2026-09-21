import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { NgSelectComponent } from '@ng-select/ng-select';
import { CatalogItem, Customer, Estimate, Invoice, Job, JobItemSet, WorkApiService } from '../core/work-api.service';
import { ARRIVAL_WINDOWS, STATE_CITIES, US_STATES_AND_PROVINCES } from '../core/reference-data';

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
    if (!this.runValidation()) {
      this.error.set('Please fix the highlighted errors before saving.');
      return;
    }
    if(this.saving())return;
    this.saving.set(true);
    this.error.set('');
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

@Component({selector:'app-job-form-live',imports:[RouterLink,FormsModule,NgSelectComponent],template:`
<main class="page"><header class="page-head"><div><nav class="breadcrumb"><a routerLink="/app/jobs">Jobs</a><span class="crumb-sep">/</span><span class="crumb-current">New job</span></nav><h1>Create job</h1><p>Schedule now or save as an unscheduled request.</p></div><a class="btn" routerLink="/app/jobs">Cancel</a></header><section class="card"><div class="card-head"><h2>Job details</h2><span class="badge blue">Draft</span></div>
<form class="card-body form-grid" (ngSubmit)="save()" novalidate>
  <div class="field wide" [class.has-error]="hasError('customerId')">
    <label for="customerId">Customer *</label>
    <ng-select id="customerId" name="customerId"
      [items]="customers()"
      bindLabel="name"
      bindValue="id"
      [(ngModel)]="model.customerId"
      (blur)="markTouched('customerId')"
      (change)="onInput('customerId')"
      placeholder="Search customer by name or address...">
      <ng-template ng-option-tmp let-item="item">
        <div><strong>{{item.name}}</strong> · <small class="muted">{{item.addressLine1}}, {{item.city}}</small></div>
      </ng-template>
    </ng-select>
    @if(hasError('customerId')){<span class="field-error" id="customer-error">{{errorMessage('customerId')}}</span>}
  </div>
  <div class="field wide" [class.has-error]="hasError('title')">
    <label for="title">Job title *</label>
    <input id="title" name="title" [(ngModel)]="model.title" (blur)="markTouched('title')" (input)="onInput('title')" placeholder="e.g. Water heater inspection">
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
  <div class="field"><label for="scheduledDate">Date</label><input id="scheduledDate" name="scheduledDate" type="date" [(ngModel)]="model.scheduledDate"></div>
  <div class="field wide">
    <label for="arrivalWindow">Arrival window</label>
    <ng-select id="arrivalWindow" name="arrivalWindow"
      [items]="arrivalWindows"
      [addTag]="true"
      [(ngModel)]="model.arrivalWindow"
      placeholder="Select arrival window or type custom time (e.g. 9:00 AM – 10:30 AM)...">
    </ng-select>
  </div>
  <div class="field wide"><label for="description">Customer request / internal instructions</label><textarea id="description" name="description" rows="4" [(ngModel)]="model.description"></textarea></div>
  @if(error()){<div class="wide callout error-text" id="job-form-error">{{error()}}</div>}
  <div class="wide page-actions"><button class="btn primary" type="submit" [disabled]="saving()" id="submit-job-btn">{{saving()?'Creating…':model.scheduledDate?'Create & schedule job':'Save unscheduled'}}</button><a class="btn" routerLink="/app/jobs">Cancel</a></div>
</form></section></main>`})
export class JobFormLivePage {
  private api=inject(WorkApiService);private router=inject(Router);private route=inject(ActivatedRoute);
  customers=signal<Customer[]>([]);
  saving=signal(false);
  error=signal('');
  submitted=signal(false);
  touched=signal<Record<string,boolean>>({});
  errors=signal<Record<string,string>>({});
  model={customerId:null as string | null,title:'',description:'',priority:'Normal',scheduledDate:'',arrivalWindow:''};
  readonly arrivalWindows = ARRIVAL_WINDOWS;

  constructor(){
    const prefillCustomer = this.route.snapshot.queryParamMap.get('customerId');
    if (prefillCustomer) {
      this.model.customerId = prefillCustomer;
    }
    this.api.customers().subscribe({next:r=>this.customers.set(r.items),error:e=>this.error.set(messageFrom(e))});
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

  save(){
    this.submitted.set(true);
    if (!this.runValidation()) return;
    if(this.saving())return;
    this.saving.set(true);
    this.error.set('');
    const command={...this.model,customerId:this.model.customerId!,scheduledDate:this.model.scheduledDate||undefined};
    this.api.createJob(command).subscribe({
      next:j=>this.router.navigate(['/app/jobs',j.id]),
      error:e=>{this.error.set(messageFrom(e));this.saving.set(false)}
    });
  }
}

@Component({selector:'app-customer-live',imports:[RouterLink,DatePipe,CurrencyPipe],template:`
<main class="page">@if(loading()){<div class="card card-body muted">Loading customer…</div>}@else if(error()){<div class="card card-body callout error-text">{{error()}}</div>}@else if(customer();as c){<header class="page-head"><div><nav class="breadcrumb"><a routerLink="/app/customers">Customers</a><span class="crumb-sep">/</span><span class="crumb-current">{{c.name}}</span></nav><div class="person"><span class="avatar">{{initials(c.name)}}</span><div><h1>{{c.name}}</h1><p>{{c.customerType}} customer · added {{c.createdAt|date:'MMM yyyy'}}</p></div></div></div><div class="page-actions"><a class="btn primary" [routerLink]="['/app/jobs/new']" [queryParams]="{customerId: c.id}">＋ Create job</a></div></header><section class="split"><article class="card"><div class="card-head"><h2>Contact details</h2></div><div class="card-body form-grid"><div><small class="muted">PHONE</small><p>{{c.phone}}</p></div><div><small class="muted">EMAIL</small><p>{{c.email||'Not provided'}}</p></div><div class="wide"><small class="muted">SERVICE ADDRESS</small><p>{{c.addressLine1}}, {{c.city}}, {{c.stateCode}} {{c.postalCode}}</p></div></div></article><aside class="card"><div class="card-head"><h2>Account</h2></div><div class="card-body"><span class="badge">Active</span><p class="muted">{{c.companyName||'Individual customer'}}</p></div></aside></section>
<section class="card section-gap"><div class="card-head"><h2>Jobs for {{c.name}}</h2><a class="btn small primary" [routerLink]="['/app/jobs/new']" [queryParams]="{customerId: c.id}">＋ New job</a></div>
@if(!customerJobs().length){<div class="card-body muted">No jobs created yet for this customer.</div>}@else{
<div class="table-scroll"><table class="data-table"><thead><tr><th>Job</th><th>Schedule</th><th>Priority</th><th>Status</th><th>Total</th></tr></thead><tbody>
@for(j of customerJobs();track j.id){<tr><td><a class="cell-main link" [routerLink]="['/app/jobs',j.id]"><strong>#{{j.jobNumber}} · {{j.title}}</strong><small>{{j.description||'No description'}}</small></a></td><td>{{j.scheduledDate||'Unscheduled'}}</td><td>{{j.priority}}</td><td><span class="badge" [class.amber]="j.status==='InProgress'" [class.blue]="j.status==='Scheduled'" [class.gray]="j.status==='Draft'" [class.teal]="j.status==='Completed'">{{label(j.status)}}</span></td><td class="money">{{j.total|currency}}</td></tr>}
</tbody></table></div>}</section>}</main>`})
export class CustomerLivePage {
  private api=inject(WorkApiService);customer=signal<Customer|null>(null);customerJobs=signal<Job[]>([]);loading=signal(true);error=signal('');
  constructor(){
    const id=inject(ActivatedRoute).snapshot.paramMap.get('id')!;
    this.api.customer(id).subscribe({
      next:c=>{
        this.customer.set(c);
        this.api.jobs().subscribe({next:r=>this.customerJobs.set(r.items.filter(j=>j.customerId===id)),error:()=>{}});
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
<div class="page-actions">@if(j.status==='Draft'){<button class="btn primary" [disabled]="statusSaving()" (click)="changeStatus('Scheduled')">Schedule job</button>}@else if(j.status==='Scheduled'){<button class="btn primary" [disabled]="statusSaving()" (click)="changeStatus('InProgress')">Start job</button>}@else if(j.status==='InProgress'){<button class="btn primary" [disabled]="statusSaving()" (click)="changeStatus('Completed')">Mark complete</button>}</div></header>
@if(error()){<div class="callout error-text">{{error()}}</div>}@if(success()){<div class="callout">{{success()}}</div>}
<section class="split"><div class="grid"><article class="card"><div class="card-head"><h2>Work summary</h2><span class="badge blue">{{label(j.status)}}</span></div><div class="card-body"><p>{{j.description||'No work instructions were entered.'}}</p><div class="list"><div class="list-row"><span class="muted">Priority</span><strong>{{j.priority}}</strong></div><div class="list-row"><span class="muted">Scheduled</span><strong>{{j.scheduledDate||'Unscheduled'}}</strong></div><div class="list-row"><span class="muted">Arrival window</span><strong>{{j.arrivalWindow||'—'}}</strong></div></div></div></article>
<article class="card"><div class="card-head"><h2>Services & materials</h2></div><div class="card-body"><div class="form-grid">
  <div class="field"><label for="job-catalog-item">Catalog item</label>
    <ng-select id="job-catalog-item"
      [items]="catalog()"
      bindLabel="name"
      bindValue="id"
      [(ngModel)]="selectedCatalogId"
      placeholder="Search parts or services...">
      <ng-template ng-option-tmp let-item="item">
        <div style="display:flex;justify-content:space-between;align-items:center;width:100%">
          <span><strong>{{item.name}}</strong> <small class="badge small" [class.blue]="item.itemType==='Part'">{{item.itemType}}</small></span>
          <strong>{{item.unitPrice|currency}}</strong>
        </div>
      </ng-template>
    </ng-select>
  </div>
  <div class="field"><label for="job-item-quantity">Quantity</label><input id="job-item-quantity" type="number" min=".001" step="1" [(ngModel)]="quantity"></div>
  <div class="wide"><button class="btn" (click)="addItem()" [disabled]="!selectedCatalogId">＋ Add to job</button></div>
</div>
@if(items().items.length){<div class="table-scroll section-gap"><table class="data-table"><thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th><th></th></tr></thead><tbody>@for(i of items().items;track $index){<tr><td>{{i.description}}</td><td>{{i.quantity}} {{i.unit}}</td><td>{{i.unitPrice|currency}}</td><td class="money">{{i.lineTotal|currency}}</td><td><button class="btn small danger" (click)="removeItem($index)">Remove</button></td></tr>}</tbody></table></div>}</div></article></div>
<aside class="grid"><article class="card"><div class="card-head"><h2>Job total</h2></div><div class="card-body list"><div class="list-row"><span>Subtotal</span><strong>{{items().subtotal|currency}}</strong></div><div class="list-row"><span>Discount</span><strong>{{items().discountTotal|currency}}</strong></div><div class="list-row"><span>Tax</span><strong>{{items().taxTotal|currency}}</strong></div><div class="list-row"><strong>Total</strong><strong class="stat-value">{{items().total|currency}}</strong></div>@if(savingItems()){<span class="muted">Saving line items…</span>}</div></article>
<article class="card"><div class="card-head"><h2>Financial documents</h2></div><div class="card-body grid">
  @if(existingInvoice(); as inv){
    <div class="associated-docs">
      <span class="muted">Generated invoice:</span>
      <a class="doc-pill" [routerLink]="['/app/invoices', inv.id]">
        <span><strong>#{{inv.invoiceNumber}}</strong> · {{inv.total|currency}}</span>
        <span class="badge" [class.gray]="inv.status==='Draft'" [class.red]="inv.isOverdue">{{inv.paymentStatus==='Paid'?'Paid':inv.status}}</span>
      </a>
    </div>
    <a class="btn primary" [routerLink]="['/app/invoices', inv.id]" id="view-invoice-btn">View invoice (#{{inv.invoiceNumber}} · {{inv.paymentStatus==='Paid'?'Paid':inv.status}})</a>
  }@else{
    <button class="btn primary" [disabled]="financialSaving()||j.status!=='Completed'" (click)="createInvoice()" id="create-invoice-btn">Create invoice</button>
  }
  @if(existingEstimates().length){
    <div class="associated-docs">
      <span class="muted">Estimates:</span>
      @for(est of existingEstimates();track est.id){
        <a class="doc-pill" [routerLink]="['/app/estimates', est.id]">
          <span><strong>#{{est.estimateNumber}}</strong> (rev {{est.revision}}) · {{est.total|currency}}</span>
          <span class="badge" [class.gray]="est.status==='Draft'" [class.amber]="est.status==='Sent'">{{est.status}}</span>
        </a>
      }
    </div>
  }
  <button class="btn" [disabled]="financialSaving()||!items().items.length" (click)="createEstimate()" id="create-estimate-btn">{{existingEstimates().length?'＋ Create revision estimate':'Create estimate'}}</button>
  <small class="muted">Invoices require a completed job. Once created, click View invoice to review or settle.</small>
</div></article></aside></section>}</main>`})
export class JobLivePage {
  private api=inject(WorkApiService);private router=inject(Router);private id=inject(ActivatedRoute).snapshot.paramMap.get('id')!;job=signal<Job|null>(null);customer=signal<Customer|null>(null);catalog=signal<CatalogItem[]>([]);items=signal<JobItemSet>({items:[],subtotal:0,discountTotal:0,taxTotal:0,total:0});existingInvoice=signal<Invoice|null>(null);existingEstimates=signal<Estimate[]>([]);loading=signal(true);savingItems=signal(false);statusSaving=signal(false);financialSaving=signal(false);error=signal('');success=signal('');selectedCatalogId='';quantity=1;
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
  addItem(){const c=this.catalog().find(x=>x.id===this.selectedCatalogId);if(!c||this.quantity<=0)return;const next=[...this.items().items,{catalogItemId:c.id,itemType:c.itemType,description:c.name,quantity:this.quantity,unit:c.unit,unitPrice:c.unitPrice,discountAmount:0,taxAmount:0}];this.saveItems(next);this.selectedCatalogId='';this.quantity=1}
  removeItem(index:number){this.saveItems(this.items().items.filter((_,i)=>i!==index))}
  private saveItems(next:JobItemSet['items']){this.savingItems.set(true);this.error.set('');this.api.replaceJobItems(this.id,next).subscribe({next:r=>{this.items.set(r);this.job.update(j=>j?{...j,total:r.total}:j);this.savingItems.set(false)},error:e=>{this.error.set(messageFrom(e));this.savingItems.set(false)}})}
  changeStatus(status:string){this.statusSaving.set(true);this.error.set('');this.success.set('');this.api.changeJobStatus(this.id,status).subscribe({next:j=>{this.job.set(j);this.statusSaving.set(false);this.success.set(`Job changed to ${this.label(j.status)}.`);this.loadFinancials();},error:e=>{this.error.set(messageFrom(e));this.statusSaving.set(false)}})}
  createEstimate(){const valid=new Date();valid.setDate(valid.getDate()+30);this.financialSaving.set(true);this.error.set('');this.api.createEstimate(this.id,valid.toISOString().slice(0,10)).subscribe({next:est=>this.router.navigate(['/app/estimates',est.id]),error:e=>{this.error.set(messageFrom(e));this.financialSaving.set(false)}})}
  createInvoice(){this.financialSaving.set(true);this.error.set('');this.api.createInvoice(this.id).subscribe({next:inv=>this.router.navigate(['/app/invoices',inv.id]),error:e=>{this.error.set(messageFrom(e));this.financialSaving.set(false)}})}
  label(value:string){return value.replace(/([a-z])([A-Z])/g,'$1 $2')}
}

