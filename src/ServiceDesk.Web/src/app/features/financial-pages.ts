import { CurrencyPipe, DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NgSelectComponent } from '@ng-select/ng-select';
import { Estimate, Invoice, PublicEstimate, WorkApiService } from '../core/work-api.service';

const financialMessage = (error: unknown) => error instanceof HttpErrorResponse
  ? error.error?.detail || 'The server could not complete the financial request.'
  : 'Something went wrong. Please try again.';

@Component({
  selector: 'app-estimates-live',
  imports: [RouterLink, FormsModule, CurrencyPipe, DatePipe, NgSelectComponent],
  template: `
    <main class="page">
      <header class="page-head">
        <div><p class="eyebrow">Sales pipeline</p><h1>Estimates</h1><p>Create pricing from job items and send a frozen copy to the customer.</p></div>
        <a class="btn primary" routerLink="/app/jobs">＋ Choose a job</a>
      </header>
      <section class="grid cols-4">
        <article class="card stat"><span class="stat-label">Draft</span><strong class="stat-value">{{count('Draft')}}</strong><span class="stat-meta">Ready to review</span></article>
        <article class="card stat"><span class="stat-label">Sent</span><strong class="stat-value">{{count('Sent')}}</strong><span class="stat-meta">Awaiting response</span></article>
        <article class="card stat"><span class="stat-label">Approved</span><strong class="stat-value">{{count('Approved')}}</strong><span class="stat-meta">Accepted scope</span></article>
        <article class="card stat"><span class="stat-label">Pipeline value</span><strong class="stat-value">{{pipelineValue() | currency}}</strong><span class="stat-meta">Current results</span></article>
      </section>
      <section class="card section-gap">
        <div class="toolbar"><strong>{{estimates().length}} estimates</strong><span style="flex:1"></span><ng-select class="filter-ng-select" [items]="estimateStatusOptions" bindLabel="label" bindValue="value" [clearable]="false" [searchable]="false" [(ngModel)]="status" (change)="load()"></ng-select><button class="btn small" (click)="load()">Refresh</button></div>
        @if(loading()){<div class="card-body muted">Loading estimates…</div>}
        @else if(error()){<div class="card-body"><div class="callout error-text">{{error()}}</div><button class="btn" (click)="load()">Try again</button></div>}
        @else if(!estimates().length){<div class="empty-state"><h2>No estimates yet</h2><p>Open a job with line items and choose Create estimate.</p><a class="btn primary" routerLink="/app/jobs">View jobs</a></div>}
        @else {<div class="table-scroll"><table class="data-table"><thead><tr><th>Estimate</th><th>Customer</th><th>Created</th><th>Expires</th><th>Status</th><th>Total</th><th></th></tr></thead><tbody>
          @for(e of estimates();track e.id){<tr><td><span class="cell-main"><a [routerLink]="['/app/estimates',e.id]"><strong>#{{e.estimateNumber}}</strong></a><small>{{e.items.length}} line items · revision {{e.revision}}</small></span></td><td>{{e.customerName}}</td><td>{{e.createdAt|date:'MMM d, y'}}</td><td>{{e.validUntil|date:'MMM d, y'}}</td><td><span class="badge" [class.gray]="e.status==='Draft'" [class.amber]="e.status==='Sent'" [class.teal]="e.status==='Approved'">{{e.status}}</span></td><td class="money">{{e.total|currency}}</td><td><div class="page-actions" style="flex-wrap: nowrap; justify-content: flex-end;">@if(e.status==='Draft'){<button class="btn small" [disabled]="savingId()===e.id" (click)="send(e)">Send</button><button class="btn small primary" [disabled]="savingId()===e.id" (click)="quickApprove(e)">✔ Approve</button>}@else if(e.status==='Sent'){<button class="btn small primary" [disabled]="savingId()===e.id" (click)="quickApprove(e)">✔ Approve</button>}@else if(e.status==='Approved'){<a class="btn small" [routerLink]="['/app/jobs', e.jobId]">Job →</a>}</div></td></tr>}
        </tbody></table></div>}
      </section>
    </main>`
})
export class EstimatesLivePage {
  private readonly api = inject(WorkApiService);
  readonly estimates = signal<Estimate[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly savingId = signal('');
  readonly pipelineValue = computed(() => this.estimates().filter(x => x.status !== 'Declined' && x.status !== 'Expired').reduce((sum, x) => sum + x.total, 0));
  status = '';
  readonly estimateStatusOptions = [
    { value: '', label: 'Status: All' },
    { value: 'Draft', label: 'Draft' },
    { value: 'Sent', label: 'Sent' },
    { value: 'Approved', label: 'Approved' },
    { value: 'Declined', label: 'Declined' },
    { value: 'Expired', label: 'Expired' }
  ];
  constructor() { this.load(); }
  load() { this.loading.set(true); this.error.set(''); this.api.estimates(this.status).subscribe({next: rows => {this.estimates.set(rows); this.loading.set(false);}, error: error => {this.error.set(financialMessage(error)); this.loading.set(false);}}); }
  count(status: string) { return this.estimates().filter(x => x.status === status).length; }
  send(estimate: Estimate) { this.savingId.set(estimate.id); this.error.set(''); this.api.sendEstimate(estimate.id).subscribe({next: updated => {this.estimates.update(rows => rows.map(x => x.id === updated.id ? updated : x)); this.savingId.set('');}, error: error => {this.error.set(financialMessage(error)); this.savingId.set('');}}); }
  quickApprove(estimate: Estimate) {
    this.savingId.set(estimate.id);
    this.error.set('');
    this.api.decideEstimate(estimate.id, 'Approved', estimate.customerName || 'Customer').subscribe({
      next: () => {
        this.savingId.set('');
        this.load();
      },
      error: error => {
        this.error.set(financialMessage(error));
        this.savingId.set('');
      }
    });
  }
}

@Component({
  selector: 'app-invoices-live',
  imports: [RouterLink, FormsModule, CurrencyPipe, DatePipe, NgSelectComponent],
  template: `
    <main class="page">
      <header class="page-head">
        <div><p class="eyebrow">Accounts receivable</p><h1>Invoices & payments</h1><p>Issue invoices from completed jobs and track the calculated balance.</p></div>
        <a class="btn primary" routerLink="/app/jobs">＋ Choose completed job</a>
      </header>
      <section class="grid cols-4">
        <article class="card stat"><span class="stat-label">Outstanding</span><strong class="stat-value">{{outstanding()|currency}}</strong><span class="stat-meta">Issued balance</span></article>
        <article class="card stat"><span class="stat-label">Overdue</span><strong class="stat-value">{{overdue()|currency}}</strong><span class="stat-meta">Needs follow-up</span></article>
        <article class="card stat"><span class="stat-label">Paid</span><strong class="stat-value">{{paid()|currency}}</strong><span class="stat-meta">Settled invoices</span></article>
        <article class="card stat"><span class="stat-label">Drafts</span><strong class="stat-value">{{count('Draft')}}</strong><span class="stat-meta">Ready to issue</span></article>
      </section>
      <section class="card section-gap">
        <div class="toolbar"><strong>{{invoices().length}} invoices</strong><span style="flex:1"></span><ng-select class="filter-ng-select" [items]="invoiceStatusOptions" bindLabel="label" bindValue="value" [clearable]="false" [searchable]="false" [(ngModel)]="status" (change)="load()"></ng-select><button class="btn small" (click)="load()">Refresh</button></div>
        @if(loading()){<div class="card-body muted">Loading invoices…</div>}
        @else if(error()){<div class="card-body"><div class="callout error-text">{{error()}}</div><button class="btn" (click)="load()">Try again</button></div>}
        @else if(!invoices().length){<div class="empty-state"><h2>No invoices yet</h2><p>Complete a job, then create its invoice from the job page.</p><a class="btn primary" routerLink="/app/jobs">View jobs</a></div>}
        @else {<div class="table-scroll"><table class="data-table"><thead><tr><th>Invoice</th><th>Customer</th><th>Issued / due</th><th>Status</th><th>Delivery</th><th>Total</th><th>Balance</th><th></th></tr></thead><tbody>
          @for(i of invoices();track i.id){<tr><td><span class="cell-main"><a [routerLink]="['/app/invoices',i.id]"><strong>#{{i.invoiceNumber}}</strong></a><small>{{i.items.length}} line items</small></span></td><td>{{i.customerName}}</td><td><span class="cell-main"><strong>{{i.issuedOn?(i.issuedOn|date:'MMM d, y'):'Not issued'}}</strong><small>{{i.dueOn?'Due '+(i.dueOn|date:'MMM d, y'):'Draft'}}</small></span></td><td><span class="badge" [class.gray]="i.status==='Draft'" [class.red]="i.isOverdue" [class.teal]="i.paymentStatus==='Paid'">{{i.isOverdue?'Overdue':i.paymentStatus==='Paid'?'Paid':i.status}}</span></td><td>@if(i.status!=='Draft'){<span class="badge" [class.gray]="i.deliveryStatus==='NotSent'" [class.amber]="i.deliveryStatus==='Queued'" [class.red]="i.deliveryStatus==='Failed'">{{deliveryLabel(i.deliveryStatus)}}</span>}@else{<span class="badge gray">Draft</span>}</td><td class="money">{{i.total|currency}}</td><td class="money">{{i.balance|currency}}</td><td><div class="page-actions" style="flex-wrap: nowrap; justify-content: flex-end;">@if(i.status==='Draft'){<button class="btn small primary" [disabled]="savingId()===i.id" (click)="issue(i)">Issue</button>}@else if(i.status==='Issued'&&i.balance>0){<button class="btn small primary" [disabled]="savingId()===i.id" (click)="pay(i)">Record paid</button>}</div></td></tr>}
        </tbody></table></div>}
      </section>
    </main>`
})
export class InvoicesLivePage {
  private readonly api = inject(WorkApiService);
  readonly invoices = signal<Invoice[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly savingId = signal('');
  status = '';
  readonly invoiceStatusOptions = [
    { value: '', label: 'Status: All' },
    { value: 'Draft', label: 'Draft' },
    { value: 'Issued', label: 'Issued' },
    { value: 'Voided', label: 'Voided' }
  ];
  readonly outstanding = computed(() => this.invoices().filter(x => x.status === 'Issued').reduce((sum, x) => sum + x.balance, 0));
  readonly overdue = computed(() => this.invoices().filter(x => x.isOverdue).reduce((sum, x) => sum + x.balance, 0));
  readonly paid = computed(() => this.invoices().filter(x => x.paymentStatus === 'Paid').reduce((sum, x) => sum + x.total, 0));
  constructor() { this.load(); }
  load() { this.loading.set(true); this.error.set(''); this.api.invoices(this.status).subscribe({next: rows => {this.invoices.set(rows); this.loading.set(false);}, error: error => {this.error.set(financialMessage(error)); this.loading.set(false);}}); }
  count(status: string) { return this.invoices().filter(x => x.status === status).length; }
  deliveryLabel(status: string): string { return status === 'NotSent' ? 'Not sent' : status; }
  issue(invoice: Invoice) { const issued = new Date(); const due = new Date(issued); due.setDate(due.getDate() + 14); this.mutate(invoice.id, this.api.issueInvoice(invoice.id, this.date(issued), this.date(due))); }
  pay(invoice: Invoice) { this.savingId.set(invoice.id); this.error.set(''); this.api.recordPayment(invoice.id, invoice.balance, 'Credit Card').subscribe({next: () => this.load(), error: error => {this.error.set(financialMessage(error)); this.savingId.set('');}}); }
  private mutate(id: string, request: ReturnType<WorkApiService['issueInvoice']>) { this.savingId.set(id); this.error.set(''); request.subscribe({next: updated => {this.invoices.update(rows => rows.map(x => x.id === updated.id ? updated : x)); this.savingId.set('');}, error: error => {this.error.set(financialMessage(error)); this.savingId.set('');}}); }
  private date(value: Date) { return value.toISOString().slice(0, 10); }
}

@Component({
  selector: 'app-estimate-detail-live',
  imports: [RouterLink, CurrencyPipe, DatePipe],
  template: `<main class="page"><header class="page-head"><div><nav class="breadcrumb"><a routerLink="/app/estimates">Estimates</a><span class="crumb-sep">/</span><span class="crumb-current">#{{estimate()?.estimateNumber}}</span></nav><div class="title-with-badge"><h1>#{{estimate()?.estimateNumber}} · revision {{estimate()?.revision}}</h1>@if(estimate();as e){<span class="badge" [class.gray]="e.status==='Draft'" [class.amber]="e.status==='Sent'" [class.teal]="e.status==='Approved'">{{e.status}}</span>}</div><p>{{estimate()?.customerName}} · <a class="link" [routerLink]="['/app/jobs', estimate()?.jobId]">View job</a></p></div>
  <div class="page-actions">
    @if(estimate()?.status==='Draft'||estimate()?.status==='Sent'){
      <button class="btn primary" [disabled]="saving()" (click)="approveInApp()" id="approve-estimate-btn">✔ Mark approved</button>
      <button class="btn" [disabled]="saving()" (click)="declineInApp()" id="decline-estimate-btn">Decline</button>
    }
    @if(estimate()?.status==='Approved'){
      <a class="btn primary" [routerLink]="['/app/jobs', estimate()?.jobId]" id="schedule-job-btn">Go to Job & Schedule →</a>
    }
    <button class="btn" (click)="downloadPdf()"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg> Download PDF</button>
    <button class="btn" (click)="printDocument()"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v8H6z"/></svg> Print</button>
    @if(estimate()?.status==='Draft'){<button class="btn" [disabled]="saving()" (click)="send()">Send estimate</button>}
    @if(estimate()&&estimate()!.status!=='Superseded'){<button class="btn" [disabled]="saving()" (click)="revise()">Create revision</button>}
    @if(estimate()?.status==='Sent'){<button class="btn" [disabled]="saving()" (click)="createLink()">Customer link</button>}
  </div></header>
  @if(loading()){<section class="card card-body muted">Loading estimate…</section>}@else if(error()){<section class="card card-body"><div class="callout error-text">{{error()}}</div><button class="btn" (click)="load()">Try again</button></section>}@else if(estimate()){<section class="grid cols-3"><article class="card stat"><span class="stat-label">Status</span><strong class="stat-value small-value">{{estimate()!.status}}</strong><span class="stat-meta">Valid through {{estimate()!.validUntil|date:'MMM d, y'}}</span></article><article class="card stat"><span class="stat-label">Customer</span><strong class="stat-value small-value">{{estimate()!.customerName}}</strong><span class="stat-meta">Frozen customer snapshot</span></article><article class="card stat"><span class="stat-label">Total</span><strong class="stat-value">{{estimate()!.total|currency}}</strong><span class="stat-meta">{{estimate()!.items.length}} line items</span></article></section>
  @if(message()){<div class="callout section-gap">✅ {{message()}}</div>}@if(publicUrl()){<article class="card section-gap"><div class="card-head"><h2>Customer approval link</h2></div><div class="card-body"><label class="field"><span>Share this secure link</span><input readonly [value]="publicUrl()"></label><small class="muted">Creating another link revokes the previous one.</small></div></article>}
  <article class="card section-gap"><div class="card-head"><h2>Estimate items</h2></div><div class="table-scroll"><table class="data-table"><thead><tr><th>Description</th><th>Type</th><th>Quantity</th><th>Price</th><th>Total</th></tr></thead><tbody>@for(item of estimate()!.items;track item.id){<tr><td>{{item.description}}</td><td>{{item.itemType}}</td><td>{{item.quantity}} {{item.unit}}</td><td class="money">{{item.unitPrice|currency}}</td><td class="money">{{item.lineTotal|currency}}</td></tr>}</tbody></table></div><div class="card-body totals"><span>Subtotal <b>{{estimate()!.subtotal|currency}}</b></span><span>Discount <b>−{{estimate()!.discountTotal|currency}}</b></span><span>Tax <b>{{estimate()!.taxTotal|currency}}</b></span><span class="total">Total <b>{{estimate()!.total|currency}}</b></span></div></article>}</main>`,
  styles: `.small-value{font-size:18px!important}.totals{margin-left:auto;max-width:340px;display:grid;gap:9px}.totals span{display:flex;justify-content:space-between}.totals .total{padding-top:10px;border-top:1px solid var(--line);font-size:18px}`
})
export class EstimateDetailLivePage {
  private readonly api = inject(WorkApiService); private readonly route = inject(ActivatedRoute); private readonly router = inject(Router);
  readonly estimate = signal<Estimate | null>(null); readonly loading = signal(true); readonly error = signal(''); readonly saving = signal(false); readonly message = signal(''); readonly publicUrl = signal('');
  private readonly id = this.route.snapshot.paramMap.get('id') ?? '';
  constructor(){this.load();}
  load(){this.loading.set(true);this.error.set('');this.api.estimate(this.id).subscribe({next:value=>{this.estimate.set(value);this.loading.set(false);},error:error=>{this.error.set(financialMessage(error));this.loading.set(false);}});}
  send(){this.mutate(this.api.sendEstimate(this.id));}
  revise(){const validUntil=new Date();validUntil.setDate(validUntil.getDate()+30);this.saving.set(true);this.api.reviseEstimate(this.id,validUntil.toISOString().slice(0,10)).subscribe({next:value=>void this.router.navigate(['/app/estimates',value.id]),error:error=>{this.error.set(financialMessage(error));this.saving.set(false);}});}
  createLink(){this.saving.set(true);this.error.set('');this.api.createPublicEstimateLink(this.id).subscribe({next:value=>{this.publicUrl.set(`${location.origin}/estimate/${value.token}`);this.message.set(`Link available until ${new Date(value.expiresAt).toLocaleString()}.`);this.saving.set(false);},error:error=>{this.error.set(financialMessage(error));this.saving.set(false);}});}
  approveInApp(){
    this.saving.set(true);
    this.error.set('');
    this.api.decideEstimate(this.id, 'Approved', this.estimate()?.customerName || 'Customer (In-person/Phone)').subscribe({
      next: () => {
        this.message.set('Estimate approved successfully! Work scope accepted.');
        this.saving.set(false);
        this.load();
      },
      error: error => {
        this.error.set(financialMessage(error));
        this.saving.set(false);
      }
    });
  }
  declineInApp(){
    this.saving.set(true);
    this.error.set('');
    this.api.decideEstimate(this.id, 'Declined', this.estimate()?.customerName || 'Customer').subscribe({
      next: () => {
        this.message.set('Estimate marked as Declined.');
        this.saving.set(false);
        this.load();
      },
      error: error => {
        this.error.set(financialMessage(error));
        this.saving.set(false);
      }
    });
  }
  printDocument(){window.print();}
  downloadPdf(){if(this.estimate()){this.api.downloadEstimatePdf(this.estimate()!.id,this.estimate()!.estimateNumber);}}
  private mutate(request: ReturnType<WorkApiService['sendEstimate']>){this.saving.set(true);this.error.set('');request.subscribe({next:value=>{this.estimate.set(value);this.message.set('Estimate sent successfully.');this.saving.set(false);},error:error=>{this.error.set(financialMessage(error));this.saving.set(false);}});}
}

@Component({
  selector: 'app-invoice-detail-live',
  imports: [RouterLink, CurrencyPipe, DatePipe, FormsModule, NgSelectComponent],
  template: `<main class="page"><header class="page-head"><div><nav class="breadcrumb"><a routerLink="/app/invoices">Invoices</a><span class="crumb-sep">/</span><span class="crumb-current">#{{invoice()?.invoiceNumber}}</span></nav><div class="title-with-badge"><h1>#{{invoice()?.invoiceNumber}}</h1>@if(invoice();as inv){<span class="badge" [class.gray]="inv.status==='Draft'" [class.red]="inv.isOverdue" [class.teal]="inv.paymentStatus==='Paid'">{{inv.paymentStatus==='Paid'?'Paid':inv.status}}</span>}</div><p>{{invoice()?.customerName}} · <a class="link" [routerLink]="['/app/jobs', invoice()?.jobId]">View job</a></p></div>
  <div class="page-actions">
    @if(invoice()?.status==='Draft'){
      <button class="btn primary" [disabled]="saving()" (click)="issueAndSettle()" id="issue-settle-btn" title="Issue invoice and record payment in 1 click">⚡ Issue & mark paid</button>
      <button class="btn" [disabled]="saving()" (click)="issue()" id="issue-btn">Issue invoice (Net 14)</button>
    }
    @else if(invoice()?.status==='Issued' && (invoice()?.balance ?? 0) > 0){
      <button class="btn primary" [disabled]="saving()" (click)="openPaymentModal()" id="open-pay-btn">Record payment ({{invoice()?.balance|currency}})</button>
    }
    <button class="btn" (click)="downloadPdf()"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg> Download PDF</button>
    <button class="btn" (click)="printDocument()"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v8H6z"/></svg> Print</button>
  </div></header>
  @if(message()){<div class="callout section-gap">✅ {{message()}}</div>}
  @if(loading()){<section class="card card-body muted">Loading invoice…</section>}@else if(error()){<section class="card card-body"><div class="callout error-text">{{error()}}</div></section>}@else if(invoice()){<section class="grid cols-4"><article class="card stat"><span class="stat-label">Status</span><strong class="stat-value small-value">{{invoice()!.paymentStatus==='Paid'?'Paid':invoice()!.status}}</strong><span class="stat-meta">{{invoice()!.issuedOn?(invoice()!.issuedOn|date:'MMM d, y'):'Not issued'}}</span></article><article class="card stat"><span class="stat-label">Delivery</span><strong class="stat-value small-value"><span class="badge" [class.amber]="invoice()!.deliveryStatus==='Queued'" [class.red]="invoice()!.deliveryStatus==='Failed'" [class.gray]="invoice()!.status==='Draft'">{{invoice()!.status==='Draft'?'Draft':invoice()!.deliveryStatus}}</span></strong><span class="stat-meta">Outbound email</span></article><article class="card stat"><span class="stat-label">Total</span><strong class="stat-value">{{invoice()!.total|currency}}</strong><span class="stat-meta">Original invoice</span></article><article class="card stat"><span class="stat-label">Balance</span><strong class="stat-value">{{invoice()!.balance|currency}}</strong><span class="stat-meta">@if(invoice()!.dueOn){Due {{invoice()!.dueOn|date:'MMM d, y'}}}</span></article></section><article class="card section-gap"><div class="card-head"><h2>Invoice items</h2></div><div class="table-scroll"><table class="data-table"><thead><tr><th>Description</th><th>Type</th><th>Quantity</th><th>Price</th><th>Total</th></tr></thead><tbody>@for(item of invoice()!.items;track item.id){<tr><td>{{item.description}}</td><td>{{item.itemType}}</td><td>{{item.quantity}} {{item.unit}}</td><td class="money">{{item.unitPrice|currency}}</td><td class="money">{{item.lineTotal|currency}}</td></tr>}</tbody></table></div></article>}

  @if(showPaymentModal()){
    <div class="quick-modal-backdrop" (click)="showPaymentModal.set(false)">
      <div class="quick-modal-card" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h3>💳 Record Invoice Payment</h3>
          <button type="button" class="modal-close-btn" (click)="showPaymentModal.set(false)">✕</button>
        </div>
        <form (ngSubmit)="submitPayment()" novalidate>
          <div class="modal-body form-grid">
            <div class="field">
              <label for="pay-amount">Payment amount *</label>
              <input id="pay-amount" name="payAmount" type="number" step="0.01" min="0.01" [max]="invoice()?.balance || 99999" [(ngModel)]="paymentAmount" required>
              <small class="muted">Balance due: {{invoice()?.balance | currency}}</small>
            </div>
            <div class="field">
              <label for="pay-method">Method *</label>
              <ng-select id="pay-method" name="payMethod" [items]="paymentMethodOptions" [clearable]="false" [searchable]="false" [(ngModel)]="paymentMethod"></ng-select>
            </div>
            <div class="field wide">
              <label for="pay-ref">Reference / Note (Optional)</label>
              <input id="pay-ref" name="payRef" [(ngModel)]="paymentRef" placeholder="e.g. Check #4092, Terminal Auth 8891...">
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn" (click)="showPaymentModal.set(false)">Cancel</button>
            <button type="submit" class="btn primary" [disabled]="saving() || paymentAmount <= 0">{{saving() ? 'Processing…' : 'Record ' + (paymentAmount | currency)}}</button>
          </div>
        </form>
      </div>
    </div>
  }
  </main>`,
  styles: `.small-value{font-size:18px!important}`
})
export class InvoiceDetailLivePage {
  private readonly api=inject(WorkApiService);private readonly route=inject(ActivatedRoute);readonly invoice=signal<Invoice|null>(null);readonly loading=signal(true);readonly error=signal('');readonly saving=signal(false);readonly message=signal('');
  readonly showPaymentModal = signal(false);
  paymentAmount = 0;
  paymentMethod = 'Credit Card';
  paymentRef = '';
  readonly paymentMethodOptions = ['Credit Card', 'Cash', 'Check', 'Bank Transfer'];
  private readonly id=this.route.snapshot.paramMap.get('id')??'';
  constructor(){this.load();}
  load(){this.loading.set(true);this.api.invoice(this.id).subscribe({next:value=>{this.invoice.set(value);this.paymentAmount=value.balance;this.loading.set(false);},error:error=>{this.error.set(financialMessage(error));this.loading.set(false);}});}
  issue(){const issued=new Date();const due=new Date(issued);due.setDate(due.getDate()+14);this.saving.set(true);this.error.set('');this.api.issueInvoice(this.id,issued.toISOString().slice(0,10),due.toISOString().slice(0,10)).subscribe({next:value=>{this.invoice.set(value);this.message.set(`Invoice #${value.invoiceNumber} issued successfully.`);this.saving.set(false);},error:error=>{this.error.set(financialMessage(error));this.saving.set(false);}});}
  issueAndSettle(){
    const issued=new Date();
    const due=new Date(issued);
    due.setDate(due.getDate()+14);
    this.saving.set(true);
    this.error.set('');
    this.api.issueInvoice(this.id,issued.toISOString().slice(0,10),due.toISOString().slice(0,10)).subscribe({
      next:inv=>{
        this.api.recordPayment(this.id,inv.balance,'Credit Card').subscribe({
          next:()=>{
            this.message.set(`Invoice #${inv.invoiceNumber} issued and settled in full via Card.`);
            this.saving.set(false);
            this.load();
          },
          error:e=>{
            this.error.set(financialMessage(e));
            this.saving.set(false);
            this.load();
          }
        });
      },
      error:error=>{
        this.error.set(financialMessage(error));
        this.saving.set(false);
      }
    });
  }
  openPaymentModal(){
    if(!this.invoice())return;
    this.paymentAmount = this.invoice()!.balance;
    this.showPaymentModal.set(true);
  }
  submitPayment(){
    if(!this.invoice() || this.paymentAmount <= 0)return;
    this.saving.set(true);
    this.error.set('');
    this.api.recordPayment(this.id, this.paymentAmount, this.paymentMethod, this.paymentRef || undefined).subscribe({
      next:()=>{
        this.message.set(`Payment of $${this.paymentAmount.toFixed(2)} recorded successfully via ${this.paymentMethod}.`);
        this.saving.set(false);
        this.showPaymentModal.set(false);
        this.load();
      },
      error:error=>{
        this.error.set(financialMessage(error));
        this.saving.set(false);
      }
    });
  }
  printDocument(){window.print();}
  downloadPdf(){if(this.invoice()){this.api.downloadInvoicePdf(this.invoice()!.id,this.invoice()!.invoiceNumber);}}
}

@Component({
  selector: 'app-public-estimate',
  imports: [FormsModule, CurrencyPipe, DatePipe],
  template: `<main class="public-document"><header><span class="public-brand">S</span><div><b>{{estimate()?.businessName||'ServiceDesk'}}</b><small>Secure estimate</small></div></header>@if(loading()){<section class="public-card">Loading estimate…</section>}@else if(error()){<section class="public-card"><h1>Estimate unavailable</h1><p>{{error()}}</p></section>}@else if(estimate()){<section class="public-hero"><p class="eyebrow">Estimate #{{estimate()!.estimateNumber}} · revision {{estimate()!.revision}}</p><h1>{{estimate()!.customerName}}</h1><p>Valid through {{estimate()!.validUntil|date:'longDate'}}</p><strong>{{estimate()!.total|currency}}</strong></section><section class="public-card"><h2>Work and pricing</h2>@for(item of estimate()!.items;track item.id){<div class="public-line"><span><b>{{item.description}}</b><small>{{item.quantity}} {{item.unit}} · {{item.itemType}}</small></span><strong>{{item.lineTotal|currency}}</strong></div>}<div class="public-total"><span>Total</span><b>{{estimate()!.total|currency}}</b></div></section>@if(estimate()!.decision){<section class="public-card success-panel"><h2>Response recorded</h2><p>This estimate was {{estimate()!.decision!.toLowerCase()}} on {{estimate()!.decidedAt|date:'medium'}}.</p></section>}@else{<section class="public-card"><h2>Your response</h2><div class="public-form"><label>Your name<input [(ngModel)]="name" autocomplete="name"></label><label>Email<input [(ngModel)]="email" type="email" autocomplete="email"></label><div class="public-actions"><button class="btn" [disabled]="saving()" (click)="decide('Declined')">Decline</button><button class="btn primary" [disabled]="saving()" (click)="decide('Approved')">Approve estimate</button></div></div><p class="error-text">{{actionError()}}</p></section>}}</main>`,
  styles: `:host{display:block;min-height:100vh;background:#f1f6f7}.public-document{width:min(760px,calc(100% - 28px));margin:auto;padding:24px 0 60px}.public-document>header{display:flex;align-items:center;gap:10px;margin-bottom:24px}.public-document>header div{display:grid}.public-document>header small{color:var(--muted)}.public-brand{width:40px;height:40px;display:grid;place-items:center;border-radius:10px;color:#fff;background:var(--teal);font-weight:800}.public-hero{padding:28px 4px}.public-hero h1{margin:6px 0}.public-hero>strong{display:block;margin-top:18px;font:800 36px Manrope,sans-serif}.public-card{margin-top:14px;padding:22px;border:1px solid var(--line);border-radius:14px;background:#fff;box-shadow:var(--shadow)}.public-line{display:flex;justify-content:space-between;gap:20px;padding:15px 0;border-bottom:1px solid var(--line-soft)}.public-line span{display:grid;gap:3px}.public-line small{color:var(--muted)}.public-total{display:flex;justify-content:space-between;padding-top:20px;font-size:20px}.public-form{display:grid;gap:14px}.public-form label{display:grid;gap:6px;font-weight:700}.public-form input{min-height:46px;padding:0 12px;border:1px solid var(--line);border-radius:8px}.public-actions{display:flex;justify-content:flex-end;gap:10px}.success-panel{border-color:#9bd9cf;background:#effaf8}@media(max-width:520px){.public-actions{display:grid;grid-template-columns:1fr}.public-actions .btn{width:100%}}`
})
export class PublicEstimatePage {private readonly api=inject(WorkApiService);private readonly route=inject(ActivatedRoute);readonly estimate=signal<PublicEstimate|null>(null);readonly loading=signal(true);readonly error=signal('');readonly actionError=signal('');readonly saving=signal(false);name='';email='';private readonly token=this.route.snapshot.paramMap.get('token')??'';constructor(){this.load();}load(){this.api.publicEstimate(this.token).subscribe({next:value=>{this.estimate.set(value);this.loading.set(false);},error:error=>{this.error.set(financialMessage(error));this.loading.set(false);}});}decide(decision:string){this.saving.set(true);this.actionError.set('');this.api.decidePublicEstimate(this.token,decision,this.name,this.email).subscribe({next:value=>{this.estimate.update(current=>current?{...current,status:value.decision,decision:value.decision,decidedAt:value.decidedAt}:current);this.saving.set(false);},error:error=>{this.actionError.set(financialMessage(error));this.saving.set(false);}});}}
