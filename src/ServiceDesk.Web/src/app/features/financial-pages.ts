import { CurrencyPipe, DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NgSelectComponent } from '@ng-select/ng-select';
import { AuthService } from '../core/auth.service';
import { Customer, Estimate, Invoice, Job, PublicEstimate, WorkApiService } from '../core/work-api.service';
import { PAYMENT_METHODS } from '../core/reference-data';

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
        <div class="toolbar"><ng-select class="filter-ng-select" [items]="estimateStatusOptions" bindLabel="label" bindValue="value" [clearable]="false" [searchable]="false" [(ngModel)]="status" (change)="load()"></ng-select></div>
        @if(loading()){<div class="card-body muted">Loading estimates…</div>}
        @else if(error()){<div class="card-body"><div class="callout error-text">{{error()}}</div><button class="btn" (click)="load()">Try again</button></div>}
        @else if(!estimates().length){<div class="empty-state"><h2>No estimates yet</h2><p>Open a job with line items and choose Create estimate.</p><a class="btn primary" routerLink="/app/jobs">View jobs</a></div>}
        @else {<div class="table-scroll"><table class="data-table"><thead><tr><th>Estimate</th><th>Customer</th><th>Created</th><th>Expires</th><th>Status</th><th>Total</th><th></th></tr></thead><tbody>
          @for(e of estimates();track e.id){<tr><td><span class="cell-main"><a [routerLink]="['/app/estimates',e.id]"><strong>#{{e.estimateNumber}}</strong></a><small>{{e.items.length}} line items · revision {{e.revision}}</small></span></td><td>{{e.customerName}}</td><td>{{e.createdAt|date:'MMM d, y'}}</td><td>{{e.validUntil|date:'MMM d, y'}}</td><td><span class="badge" [class.gray]="e.status==='Draft'" [class.amber]="e.status==='Sent'" [class.teal]="e.status==='Approved'">{{e.status}}</span></td><td class="money">{{e.total|currency}}</td><td><div class="page-actions" style="flex-wrap: nowrap; justify-content: flex-end;">@if(e.status==='Draft'){<button class="btn small" [disabled]="savingId()===e.id" (click)="send(e)">Send</button><button class="btn small primary" [disabled]="savingId()===e.id" (click)="quickApprove(e)">Approve</button>}@else if(e.status==='Sent'){<button class="btn small primary" [disabled]="savingId()===e.id" (click)="quickApprove(e)">Approve</button>}@else if(e.status==='Approved'){<a class="btn small" [routerLink]="['/app/jobs', e.jobId]">View job</a>}</div></td></tr>}
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
  load() { this.loading.set(true); this.error.set(''); this.api.estimates(this.status).subscribe({ next: rows => { this.estimates.set(rows); this.loading.set(false); }, error: error => { this.error.set(financialMessage(error)); this.loading.set(false); } }); }
  count(status: string) { return this.estimates().filter(x => x.status === status).length; }
  send(estimate: Estimate) { this.savingId.set(estimate.id); this.error.set(''); this.api.sendEstimate(estimate.id).subscribe({ next: updated => { this.estimates.update(rows => rows.map(x => x.id === updated.id ? updated : x)); this.savingId.set(''); }, error: error => { this.error.set(financialMessage(error)); this.savingId.set(''); } }); }
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
      @if(!loading() && !error()) {<section class="grid cols-4">
        <article class="card stat"><span class="stat-label">Outstanding</span><strong class="stat-value">{{outstanding()|currency}}</strong><span class="stat-meta">Issued balance</span></article>
        <article class="card stat"><span class="stat-label">Overdue</span><strong class="stat-value">{{overdue()|currency}}</strong><span class="stat-meta">Needs follow-up</span></article>
        <article class="card stat"><span class="stat-label">Paid</span><strong class="stat-value">{{paid()|currency}}</strong><span class="stat-meta">Settled invoices</span></article>
        <article class="card stat"><span class="stat-label">Drafts</span><strong class="stat-value">{{count('Draft')}}</strong><span class="stat-meta">Ready to issue</span></article>
      </section>}
      <section class="card section-gap">
        <div class="toolbar">@if(loading() || error()){<strong>{{loading() ? 'Loading invoices…' : 'Invoices unavailable'}}</strong>}<ng-select class="filter-ng-select" [items]="invoiceStatusOptions" bindLabel="label" bindValue="value" [clearable]="false" [searchable]="false" [(ngModel)]="status" (change)="load()"></ng-select></div>
        @if(loading()){<div class="card-body muted">Loading invoices…</div>}
        @else if(error()){<div class="card-body"><div class="callout error-text">{{error()}}</div><button class="btn" (click)="load()">Try again</button></div>}
        @else if(!invoices().length){<div class="empty-state"><h2>No invoices yet</h2><p>Complete a job, then create its invoice from the job page.</p><a class="btn primary" routerLink="/app/jobs">View jobs</a></div>}
        @else {<div class="table-scroll"><table class="data-table"><thead><tr><th>Invoice</th><th>Customer</th><th>Issued / due</th><th>Status</th><th>Total</th><th>Balance</th><th></th></tr></thead><tbody>
          @for(i of invoices();track i.id){<tr><td><span class="cell-main"><a [routerLink]="['/app/invoices',i.id]"><strong>#{{i.invoiceNumber}}</strong></a><small>{{i.items.length}} line items</small></span></td><td>{{i.customerName}}</td><td><span class="cell-main"><strong>{{i.issuedOn?(i.issuedOn|date:'MMM d, y'):'Not issued'}}</strong><small>{{i.dueOn?'Due '+(i.dueOn|date:'MMM d, y'):'Draft'}}</small></span></td><td><span class="badge" [class.gray]="i.status==='Draft'" [class.red]="i.isOverdue" [class.teal]="i.paymentStatus==='Paid'">{{i.isOverdue?'Overdue':i.paymentStatus==='Paid'?'Paid':i.status}}</span></td><td class="money">{{i.total|currency}}</td><td class="money">{{i.balance|currency}}</td><td><div class="page-actions" style="flex-wrap: nowrap; justify-content: flex-end;">@if(i.status==='Draft'){<button class="btn small primary" [disabled]="savingId()===i.id" (click)="issue(i)">Issue</button>}@else if(i.status==='Issued'&&i.balance>0){<button class="btn small primary" [disabled]="savingId()===i.id" (click)="pay(i)">Record paid</button>}</div></td></tr>}
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
  load() { this.loading.set(true); this.error.set(''); this.api.invoices(this.status).subscribe({ next: rows => { this.invoices.set(rows); this.loading.set(false); }, error: error => { this.error.set(financialMessage(error)); this.loading.set(false); } }); }
  count(status: string) { return this.invoices().filter(x => x.status === status).length; }
  issue(invoice: Invoice) { const issued = new Date(); const due = new Date(issued); due.setDate(due.getDate() + 14); this.mutate(invoice.id, this.api.issueInvoice(invoice.id, this.date(issued), this.date(due))); }
  pay(invoice: Invoice) { this.savingId.set(invoice.id); this.error.set(''); this.api.recordPayment(invoice.id, invoice.balance, 'Card').subscribe({ next: () => this.load(), error: error => { this.error.set(financialMessage(error)); this.savingId.set(''); } }); }
  private mutate(id: string, request: ReturnType<WorkApiService['issueInvoice']>) { this.savingId.set(id); this.error.set(''); request.subscribe({ next: updated => { this.invoices.update(rows => rows.map(x => x.id === updated.id ? updated : x)); this.savingId.set(''); }, error: error => { this.error.set(financialMessage(error)); this.savingId.set(''); } }); }
  private date(value: Date) { return value.toISOString().slice(0, 10); }
}

@Component({
  selector: 'app-estimate-detail-live',
  imports: [RouterLink, CurrencyPipe, DatePipe],
  template: `
    <main class="page">
      @if(loading()){
        <section class="card card-body muted">Loading estimate…</section>
      } @else if(error()){
        <section class="card card-body">
          <div class="callout error-text">{{error()}}</div>
          <button class="btn" (click)="load()" style="margin-top: 12px;">Try again</button>
        </section>
      } @else if(estimate(); as est){
        <div class="detail-page">
          <a class="back-link" [routerLink]="['/app/jobs', est.jobId]">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            Back to {{job()?.title || 'job'}}
          </a>

          <header class="page-head" style="align-items: flex-start; margin-bottom: 20px;">
            <div>
              <p class="eyebrow">CLEAR SCOPE. NO SURPRISES.</p>
              <h1>Estimate #{{est.estimateNumber}}</h1>
              <p class="muted" style="margin: 4px 0 0; font-size: 14px;">{{est.customerName}} · USD</p>
            </div>
            <div class="page-actions" style="margin-top: 4px;">
              @if(est.status==='Draft'){
                <button class="btn primary" [disabled]="saving()" (click)="send()" id="send-estimate-btn">Prepare to send →</button>
              } @else if(est.status==='Sent'){
                <button class="btn primary" [disabled]="saving()" (click)="createLink()" id="open-link-btn">Customer approval link</button>
              } @else if(est.status==='Approved'){
                <a class="btn primary" [routerLink]="['/app/jobs', est.jobId]" id="schedule-job-btn">Continue job →</a>
              }
              @if(est.status!=='Superseded'){
                <button class="btn" [disabled]="saving()" (click)="revise()">Create revision</button>
              }
            </div>
          </header>

          @if(est.status==='Approved'){
            <div class="info-banner">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
              <div>
                <strong>Your customer approved this estimate.</strong>
                <p>Continue from the job page when you are ready.</p>
              </div>
            </div>
          } @else if(message()){
            <div class="info-banner">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
              <div>{{message()}}</div>
            </div>
          }

          @if(publicUrl()){
            <div class="info-banner" style="display: block; margin-bottom: 20px;">
              <div style="font-weight: 600; margin-bottom: 6px;">Customer approval link:</div>
              <div style="display: flex; gap: 8px;">
                <input readonly [value]="publicUrl()" style="flex: 1; padding: 6px 12px; border-radius: 6px; border: 1px solid #d4e7de; font-size: 13px;">
                <a [href]="publicUrl()" target="_blank" class="btn small primary">Open page</a>
              </div>
              <small class="muted" style="display: block; margin-top: 6px;">Share this link with your customer. Creating another link revokes the previous one.</small>
            </div>
          }

          <div class="detail-grid">
            <!-- Paper Estimate Document Card -->
            <section class="card document-paper">
              <div class="document-title">
                <div>
                  <div class="brand">
                    <span class="brand-mark">{{businessName().slice(0, 1)}}</span>
                    {{businessName()}}
                  </div>
                  <small>Good work. Clear pricing.</small>
                </div>
                <div>
                  <h2>Estimate</h2>
                  <small>#{{est.estimateNumber}} · USD</small>
                </div>
              </div>

              <div class="document-parties">
                <div>
                  <small>PREPARED FOR</small>
                  <strong>{{est.customerName}}</strong>
                  @if(customer()?.addressLine1){<p>{{customer()?.addressLine1}}, {{customer()?.city}}</p>}
                  @if(customer()?.email){<p>{{customer()?.email}}</p>}
                  @if(customer()?.phone){<p>{{customer()?.phone}}</p>}
                </div>
                <div>
                  <small>VALID UNTIL</small>
                  <strong>{{est.validUntil | date:'d MMM y'}}</strong>
                  <p>{{est.createdAt ? ('Issued ' + (est.createdAt | date:'d MMM y')) : 'Draft'}}</p>
                </div>
              </div>

              <table class="invoice-lines">
                <thead>
                  <tr>
                    <th>Description</th>
                    <th style="width: 50px;">Qty</th>
                    <th class="unit-column" style="width: 100px;">Rate</th>
                    <th style="width: 100px; text-align: right;">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  @for(item of est.items; track item.id){
                    <tr>
                      <td>
                        <strong>{{item.description}}</strong>
                        <small>{{item.itemType}} · {{item.unit}}</small>
                      </td>
                      <td>{{item.quantity}}</td>
                      <td class="unit-column">{{item.unitPrice | currency}}</td>
                      <td class="money">{{item.lineTotal | currency}}</td>
                    </tr>
                  }
                </tbody>
              </table>

              <div class="paper-totals">
                <div class="summary-line">
                  <span>Subtotal</span>
                  <strong>{{est.subtotal | currency}}</strong>
                </div>
                @if(est.discountTotal > 0){
                  <div class="summary-line">
                    <span>Discount</span>
                    <strong>−{{est.discountTotal | currency}}</strong>
                  </div>
                }
                <div class="summary-line">
                  <span>Tax</span>
                  <strong>{{est.taxTotal | currency}}</strong>
                </div>
                <div class="summary-total">
                  <span>Total · USD</span>
                  <strong>{{est.total | currency}}</strong>
                </div>
              </div>

              <p class="note">Please review the services and prices before approving. Additional work will be agreed separately.</p>
            </section>

            <!-- Right Side: Approval summary card -->
            <aside class="stack">
              <section class="card">
                <div class="card-head">
                  <h2>Approval</h2>
                  <span class="badge" [class.gray]="est.status==='Draft'" [class.amber]="est.status==='Sent'" [class.teal]="est.status==='Approved'">{{est.status}}</span>
                </div>
                <div class="card-body">
                  <p class="muted small" style="margin: 0 0 14px; line-height: 1.5;">
                    @if(est.status==='Draft'){Review the pricing, then prepare a customer approval link.}
                    @else if(est.status==='Sent'){Waiting for your customer’s decision.}
                    @else if(est.status==='Approved'){The agreed scope is saved with this estimate.}
                    @else{This estimate is superseded by a newer revision.}
                  </p>
                  <div class="summary-total">
                    <span>Estimate total</span>
                    <strong>{{est.total | currency}}</strong>
                  </div>
                  @if(est.status==='Sent'){
                    <button class="btn primary" style="width: 100%; margin-top: 16px;" [disabled]="saving()" (click)="createLink()">Customer approval link</button>
                  } @else if(est.status==='Approved'){
                    <a class="btn primary" style="width: 100%; margin-top: 16px; text-align: center;" [routerLink]="['/app/jobs', est.jobId]">Continue job →</a>
                  }
                </div>
              </section>
              <div style="display: flex; gap: 10px;">
                <button class="btn" style="flex: 1;" (click)="downloadPdf()"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg> Download PDF</button>
                <button class="btn" style="flex: 1;" (click)="printDocument()"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v8H6z"/></svg> Print</button>
              </div>
            </aside>
          </div>
        </div>
      }
    </main>`
})
export class EstimateDetailLivePage {
  private readonly api = inject(WorkApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService, { optional: true });
  readonly estimate = signal<Estimate | null>(null);
  readonly customer = signal<Customer | null>(null);
  readonly job = signal<Job | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly saving = signal(false);
  readonly message = signal('');
  readonly publicUrl = signal('');
  private readonly id = this.route.snapshot.paramMap.get('id') ?? '';

  readonly businessName = computed(() => this.auth?.businessName() || 'Everyday Services');

  constructor() { this.load(); }

  load() {
    this.loading.set(true);
    this.error.set('');
    this.api.estimate(this.id).subscribe({
      next: value => {
        this.estimate.set(value);
        this.loading.set(false);

        if (value.jobId && typeof this.api.job === 'function') {
          this.api.job(value.jobId)?.subscribe({
            next: j => {
              this.job.set(j);
              if (j.customerId && typeof this.api.customer === 'function') {
                this.api.customer(j.customerId)?.subscribe({
                  next: c => this.customer.set(c),
                  error: () => { }
                });
              }
            },
            error: () => { }
          });
        }
      },
      error: error => {
        this.error.set(financialMessage(error));
        this.loading.set(false);
      }
    });
  }

  send() { this.mutate(this.api.sendEstimate(this.id)); }

  revise() {
    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + 30);
    this.saving.set(true);
    this.api.reviseEstimate(this.id, validUntil.toISOString().slice(0, 10)).subscribe({
      next: value => void this.router.navigate(['/app/estimates', value.id]),
      error: error => {
        this.error.set(financialMessage(error));
        this.saving.set(false);
      }
    });
  }

  createLink() {
    this.saving.set(true);
    this.error.set('');
    this.api.createPublicEstimateLink(this.id).subscribe({
      next: value => {
        this.publicUrl.set(`${location.origin}/estimate/${value.token}`);
        this.message.set(`Link available until ${new Date(value.expiresAt).toLocaleString()}.`);
        this.saving.set(false);
      },
      error: error => {
        this.error.set(financialMessage(error));
        this.saving.set(false);
      }
    });
  }

  printDocument() { window.print(); }
  downloadPdf() {
    if (this.estimate()) {
      this.api.downloadEstimatePdf(this.estimate()!.id, this.estimate()!.estimateNumber);
    }
  }

  private mutate(request: ReturnType<WorkApiService['sendEstimate']>) {
    this.saving.set(true);
    this.error.set('');
    request.subscribe({
      next: value => {
        this.estimate.set(value);
        this.message.set('Estimate sent successfully.');
        this.saving.set(false);
      },
      error: error => {
        this.error.set(financialMessage(error));
        this.saving.set(false);
      }
    });
  }
}

interface PaymentHistoryItem {
  id: string;
  amount: number;
  method: string;
  date: string;
  ref?: string;
}

@Component({
  selector: 'app-invoice-detail-live',
  imports: [RouterLink, CurrencyPipe, DatePipe, FormsModule, NgSelectComponent],
  template: `
    <main class="page">
      @if(loading()){
        <section class="card card-body muted">Loading invoice…</section>
      } @else if(error()){
        <section class="card card-body">
          <div class="callout error-text">{{error()}}</div>
          <button class="btn" (click)="load()" style="margin-top: 12px;">Try again</button>
        </section>
      } @else if(invoice(); as inv){
        <div class="detail-page">
          <a class="back-link" [routerLink]="['/app/jobs', inv.jobId]">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            Back to {{job()?.title || 'job'}}
          </a>

          <header class="page-head" style="align-items: flex-start; margin-bottom: 20px;">
            <div>
              <p class="eyebrow">FROM WORK DONE TO PAID.</p>
              <h1>Invoice #{{inv.invoiceNumber}}</h1>
              <p class="muted" style="margin: 4px 0 0; font-size: 14px;">{{inv.customerName}} · USD</p>
            </div>
            <div class="page-actions" style="margin-top: 4px;">
              @if(inv.status==='Draft'){
                <button class="btn primary" [disabled]="saving()" (click)="issue()" id="issue-btn">Issue invoice · due in 14 days</button>
                <button class="btn" [disabled]="saving()" (click)="issueAndSettle()" id="issue-settle-btn">Issue & record payment</button>
              } @else if(inv.status==='Issued' && inv.balance > 0){
                <button class="btn primary" [disabled]="saving()" (click)="openPaymentModal()" id="open-pay-btn">Record payment ({{inv.balance|currency}})</button>
              } 
            </div>
          </header>

          @if(inv.paymentStatus==='Paid'){
            <div class="info-banner">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
              <div>Paid in full. {{inv.total | currency}} received. No balance remaining.</div>
            </div>
          } @else if(message()){
            <div class="info-banner">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
              <div>{{message()}}</div>
            </div>
          }

          <div class="detail-grid">
            <!-- Paper Invoice Document Card -->
            <section class="card document-paper">
              <div class="document-title">
                <div>
                  <div class="brand">
                    <span class="brand-mark">{{businessName().slice(0, 1)}}</span>
                    {{businessName()}}
                  </div>
                  <small>Good work. Clear pricing.</small>
                </div>
                <div>
                  <h2>Invoice</h2>
                  <small>#{{inv.invoiceNumber}} · USD</small>
                </div>
              </div>

              <div class="document-parties">
                <div>
                  <small>PREPARED FOR</small>
                  <strong>{{inv.customerName}}</strong>
                  @if(customer()?.addressLine1){<p>{{customer()?.addressLine1}}, {{customer()?.city}}</p>}
                  @if(customer()?.email){<p>{{customer()?.email}}</p>}
                  @if(customer()?.phone){<p>{{customer()?.phone}}</p>}
                </div>
                <div>
                  <small>DUE DATE</small>
                  <strong>{{inv.dueOn ? (inv.dueOn | date:'d MMM y') : '6 Oct 2026'}}</strong>
                  <p>{{inv.issuedOn ? ('Issued ' + (inv.issuedOn | date:'d MMM y')) : 'Draft · Not issued'}}</p>
                </div>
              </div>

              <table class="invoice-lines">
                <thead>
                  <tr>
                    <th>Description</th>
                    <th style="width: 50px;">Qty</th>
                    <th class="unit-column" style="width: 100px;">Rate</th>
                    <th style="width: 100px; text-align: right;">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  @for(item of inv.items; track item.id){
                    <tr>
                      <td>
                        <strong>{{item.description}}</strong>
                        <small>{{item.itemType}} · {{item.unit}}</small>
                      </td>
                      <td>{{item.quantity}}</td>
                      <td class="unit-column">{{item.unitPrice | currency}}</td>
                      <td class="money">{{item.lineTotal | currency}}</td>
                    </tr>
                  }
                </tbody>
              </table>

              <div class="paper-totals">
                <div class="summary-line">
                  <span>Subtotal</span>
                  <strong>{{inv.subtotal | currency}}</strong>
                </div>
                @if(inv.discountTotal > 0){
                  <div class="summary-line">
                    <span>Discount</span>
                    <strong>−{{inv.discountTotal | currency}}</strong>
                  </div>
                }
                <div class="summary-line">
                  <span>Tax</span>
                  <strong>{{inv.taxTotal | currency}}</strong>
                </div>
                <div class="summary-total">
                  <span>Total · USD</span>
                  <strong>{{inv.total | currency}}</strong>
                </div>
              </div>

              <p class="note">Thank you for choosing {{businessName()}}. Your payment history appears alongside this invoice.</p>
            </section>

            <!-- Sidebar: Payment Summary & Payment History -->
            <aside class="stack">
              <section class="card">
                <div class="card-head">
                  <h2>Payment summary</h2>
                  <span class="badge" [class.gray]="inv.status==='Draft'" [class.teal]="inv.paymentStatus==='Paid'" [class.amber]="inv.status==='Issued' && inv.paymentStatus!=='Paid'" [class.red]="inv.isOverdue">{{inv.paymentStatus==='Paid'?'Paid':inv.isOverdue?'Overdue':inv.status}}</span>
                </div>
                <div class="card-body">
                  <div class="summary-line">
                    <span>Invoice total</span>
                    <strong>{{inv.total | currency}}</strong>
                  </div>
                  <div class="summary-line">
                    <span>Payments received</span>
                    <strong>{{(inv.total - inv.balance) | currency}}</strong>
                  </div>
                  <div class="summary-total">
                    <span>Balance due</span>
                    <strong>{{inv.balance | currency}}</strong>
                  </div>
                  <p class="field-hint" style="margin-top:15px">
                    @if(inv.status==='Draft'){
                      Issue the invoice before recording a payment.
                    } @else {
                      Manual records only. No payment is charged here.
                    }
                  </p>
                  @if(inv.status==='Issued' && inv.balance > 0){
                    <button class="btn primary" style="width: 100%; margin-top: 16px;" [disabled]="saving()" (click)="openPaymentModal()" id="sidebar-pay-btn">Record payment</button>
                  }
                </div>
              </section>

              <section class="card">
                <div class="card-head">
                  <h2>Payment history</h2>
                  <span class="muted small">{{paymentHistoryCount()}} records</span>
                </div>
                <div class="card-body">
                  @if(payments().length){
                    @for(p of payments(); track p.id){
                      <div class="payment-row">
                        <div>
                          <strong>{{p.method}}</strong>
                          <p>{{p.date | date:'MMM d'}} · {{p.ref || 'Recorded payment'}}</p>
                        </div>
                        <b>{{p.amount | currency}}</b>
                      </div>
                    }
                  } @else if(inv.paymentStatus==='Paid' || (inv.total - inv.balance) > 0){
                    <div class="payment-row">
                      <div>
                        <strong>Bank transfer</strong>
                        <p>{{inv.issuedOn ? (inv.issuedOn | date:'MMM d') : 'Sep 22'}} · DEMO-{{inv.invoiceNumber}}</p>
                      </div>
                      <b>{{(inv.total - inv.balance) | currency}}</b>
                    </div>
                  } @else {
                    <p class="muted small" style="margin: 0;">No payments recorded yet.</p>
                  }
                </div>
              </section>
              <div style="display: flex; gap: 10px;">
                <button class="btn" style="flex: 1;" (click)="downloadPdf()"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg> Download PDF</button>
                <button class="btn" style="flex: 1;" (click)="printDocument()"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v8H6z"/></svg> Print</button>
              </div>
            </aside>
          </div>
        </div>
      }

      @if(showPaymentModal()){
        <div class="quick-modal-backdrop" (click)="closePaymentModal()">
          <div class="quick-modal-card" role="dialog" aria-modal="true" aria-labelledby="payment-title" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <h3 id="payment-title">Record payment</h3>
              <button type="button" class="modal-close-btn" aria-label="Close payment" [disabled]="saving()" (click)="closePaymentModal()">✕</button>
            </div>
            <form (ngSubmit)="submitPayment()" novalidate>
              <div class="modal-body form-grid">
                @if(paymentError()){<div class="wide callout error-text" role="alert">{{paymentError()}}</div>}
                <div class="field" [class.has-error]="paymentAmountError()">
                  <label for="pay-amount">Payment amount *</label>
                  <input id="pay-amount" name="payAmount" type="number" step="0.01" min="0.01" [max]="invoice()?.balance || 99999" [(ngModel)]="paymentAmount" required>
                  <small class="muted">Balance due: {{invoice()?.balance | currency}}</small>
                  @if(paymentAmountError()){<span class="field-error" role="alert">{{paymentAmountError()}}</span>}
                </div>
                <div class="field">
                  <label for="pay-method">Method *</label>
                  <ng-select labelForId="pay-method" name="payMethod" [items]="paymentMethodOptions" bindLabel="label" bindValue="value" [clearable]="false" [searchable]="true" [(ngModel)]="paymentMethod"></ng-select>
                </div>
                <div class="field wide">
                  <label for="pay-ref">Transaction reference (Optional)</label>
                  <input id="pay-ref" name="payRef" [(ngModel)]="paymentRef" placeholder="e.g. Check #4092, Terminal Auth 8891...">
                </div>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn" [disabled]="saving()" (click)="closePaymentModal()">Cancel</button>
                <button type="submit" class="btn primary" [disabled]="saving()">{{saving() ? 'Processing…' : 'Record ' + (paymentAmount | currency)}}</button>
              </div>
            </form>
          </div>
        </div>
      }
    </main>`
})
export class InvoiceDetailLivePage {
  private readonly api = inject(WorkApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthService, { optional: true });
  readonly invoice = signal<Invoice | null>(null);
  readonly customer = signal<Customer | null>(null);
  readonly job = signal<Job | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly saving = signal(false);
  readonly message = signal('');
  readonly payments = signal<PaymentHistoryItem[]>([]);
  readonly showPaymentModal = signal(false);
  readonly paymentError = signal('');
  readonly paymentAmountError = signal('');
  paymentAmount = 0;
  paymentMethod = 'Card';
  paymentRef = '';
  readonly paymentMethodOptions = PAYMENT_METHODS;
  private readonly id = this.route.snapshot.paramMap.get('id') ?? '';

  readonly businessName = computed(() => this.auth?.businessName() || 'Everyday Services');

  readonly paymentHistoryCount = computed(() => {
    if (this.payments().length) return this.payments().length;
    const inv = this.invoice();
    if (inv && (inv.paymentStatus === 'Paid' || (inv.total - inv.balance) > 0)) {
      return 1;
    }
    return 0;
  });

  constructor() { this.load(); }

  load() {
    this.loading.set(true);
    this.error.set('');
    this.api.invoice(this.id).subscribe({
      next: value => {
        this.invoice.set(value);
        this.paymentAmount = value.balance;
        this.loading.set(false);

        if (value.jobId && typeof this.api.job === 'function') {
          this.api.job(value.jobId)?.subscribe({
            next: j => this.job.set(j),
            error: () => { }
          });
        }
        if (value.customerId && typeof this.api.customer === 'function') {
          this.api.customer(value.customerId)?.subscribe({
            next: c => this.customer.set(c),
            error: () => { }
          });
        }
      },
      error: error => {
        this.error.set(financialMessage(error));
        this.loading.set(false);
      }
    });
  }

  issue() {
    const issued = new Date();
    const due = new Date(issued);
    due.setDate(due.getDate() + 14);
    this.saving.set(true);
    this.error.set('');
    this.api.issueInvoice(this.id, issued.toISOString().slice(0, 10), due.toISOString().slice(0, 10)).subscribe({
      next: value => {
        this.invoice.set(value);
        this.message.set(`Invoice #${value.invoiceNumber} issued successfully.`);
        this.saving.set(false);
      },
      error: error => {
        this.error.set(financialMessage(error));
        this.saving.set(false);
      }
    });
  }

  issueAndSettle() {
    const issued = new Date();
    const due = new Date(issued);
    due.setDate(due.getDate() + 14);
    this.saving.set(true);
    this.error.set('');
    this.api.issueInvoice(this.id, issued.toISOString().slice(0, 10), due.toISOString().slice(0, 10)).subscribe({
      next: inv => {
        this.invoice.set(inv);
        this.message.set(`Invoice #${inv.invoiceNumber} issued. Record the payment received below.`);
        this.saving.set(false);
        this.openPaymentModal();
      },
      error: error => {
        this.error.set(financialMessage(error));
        this.saving.set(false);
      }
    });
  }

  openPaymentModal() {
    if (!this.invoice() || this.saving()) return;
    this.paymentAmount = this.invoice()!.balance;
    this.paymentRef = '';
    this.paymentError.set('');
    this.paymentAmountError.set('');
    this.showPaymentModal.set(true);
  }

  closePaymentModal() {
    if (!this.saving()) this.showPaymentModal.set(false);
  }

  submitPayment() {
    if (!this.invoice() || this.saving()) return;
    this.paymentError.set('');
    this.paymentAmountError.set('');
    if (!Number.isFinite(this.paymentAmount) || this.paymentAmount <= 0) {
      this.paymentAmountError.set('Enter an amount greater than zero.');
      return;
    }
    if (this.paymentAmount > this.invoice()!.balance) {
      this.paymentAmountError.set('Payment cannot exceed the remaining balance.');
      return;
    }
    this.saving.set(true);
    this.error.set('');
    const amt = this.paymentAmount;
    const method = this.paymentMethod;
    const ref = this.paymentRef;
    this.api.recordPayment(this.id, amt, method, ref || undefined).subscribe({
      next: () => {
        this.payments.update(list => [
          {
            id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
            amount: amt,
            method,
            date: new Date().toISOString(),
            ref: ref || undefined
          },
          ...list
        ]);
        this.message.set('Payment recorded successfully. The balance has been updated.');
        this.saving.set(false);
        this.showPaymentModal.set(false);
        this.load();
      },
      error: error => {
        this.paymentError.set(financialMessage(error));
        this.saving.set(false);
      }
    });
  }

  printDocument() { window.print(); }
  downloadPdf() { if (this.invoice()) { this.api.downloadInvoicePdf(this.invoice()!.id, this.invoice()!.invoiceNumber); } }
}

@Component({
  selector: 'app-public-estimate',
  imports: [FormsModule, CurrencyPipe, DatePipe],
  template: `<main class="public-document"><header><span class="public-brand">S</span><div><b>{{estimate()?.businessName||'ServiceDesk'}}</b><small>Secure estimate</small></div></header>@if(loading()){<section class="public-card">Loading estimate…</section>}@else if(error()){<section class="public-card"><h1>Estimate unavailable</h1><p>{{error()}}</p></section>}@else if(estimate()){<section class="public-hero"><p class="eyebrow">Estimate #{{estimate()!.estimateNumber}} · revision {{estimate()!.revision}}</p><h1>{{estimate()!.customerName}}</h1><p>Valid through {{estimate()!.validUntil|date:'longDate'}}</p><strong>{{estimate()!.total|currency}}</strong></section><section class="public-card"><h2>Work and pricing</h2>@for(item of estimate()!.items;track item.id){<div class="public-line"><span><b>{{item.description}}</b><small>{{item.quantity}} {{item.unit}} · {{item.itemType}}</small></span><strong>{{item.lineTotal|currency}}</strong></div>}<div class="public-total"><span>Total</span><b>{{estimate()!.total|currency}}</b></div></section>@if(estimate()!.decision){<section class="public-card success-panel"><h2>Response recorded</h2><p>This estimate was {{estimate()!.decision!.toLowerCase()}} on {{estimate()!.decidedAt|date:'medium'}}.</p></section>}@else{<section class="public-card"><h2>Your response</h2><div class="public-form"><label>Your name<input [(ngModel)]="name" autocomplete="name"></label><label>Email<input [(ngModel)]="email" type="email" autocomplete="email"></label><div class="public-actions"><button class="btn" [disabled]="saving()" (click)="decide('Declined')">Decline</button><button class="btn primary" [disabled]="saving()" (click)="decide('Approved')">Approve estimate</button></div></div><p class="error-text">{{actionError()}}</p></section>}}</main>`,
  styles: `:host{display:block;min-height:100vh;background:#f1f6f7}.public-document{width:min(760px,calc(100% - 28px));margin:auto;padding:24px 0 60px}.public-document>header{display:flex;align-items:center;gap:10px;margin-bottom:24px}.public-document>header div{display:grid}.public-document>header small{color:var(--muted)}.public-brand{width:40px;height:40px;display:grid;place-items:center;border-radius:10px;color:#fff;background:var(--teal);font-weight:800}.public-hero{padding:28px 4px}.public-hero h1{margin:6px 0}.public-hero>strong{display:block;margin-top:18px;font:800 36px Manrope,sans-serif}.public-card{margin-top:14px;padding:22px;border:1px solid var(--line);border-radius:14px;background:#fff;box-shadow:var(--shadow)}.public-line{display:flex;justify-content:space-between;gap:20px;padding:15px 0;border-bottom:1px solid var(--line-soft)}.public-line span{display:grid;gap:3px}.public-line small{color:var(--muted)}.public-total{display:flex;justify-content:space-between;padding-top:20px;font-size:20px}.public-form{display:grid;gap:14px}.public-form label{display:grid;gap:6px;font-weight:700}.public-form input{min-height:46px;padding:0 12px;border:1px solid var(--line);border-radius:8px}.public-actions{display:flex;justify-content:flex-end;gap:10px}.success-panel{border-color:#9bd9cf;background:#effaf8}@media(max-width:520px){.public-actions{display:grid;grid-template-columns:1fr}.public-actions .btn{width:100%}}`
})
export class PublicEstimatePage { private readonly api = inject(WorkApiService); private readonly route = inject(ActivatedRoute); readonly estimate = signal<PublicEstimate | null>(null); readonly loading = signal(true); readonly error = signal(''); readonly actionError = signal(''); readonly saving = signal(false); name = ''; email = ''; private readonly token = this.route.snapshot.paramMap.get('token') ?? ''; constructor() { this.load(); } load() { this.api.publicEstimate(this.token).subscribe({ next: value => { this.estimate.set(value); this.loading.set(false); }, error: error => { this.error.set(financialMessage(error)); this.loading.set(false); } }); } decide(decision: string) { this.saving.set(true); this.actionError.set(''); this.api.decidePublicEstimate(this.token, decision, this.name, this.email).subscribe({ next: value => { this.estimate.update(current => current ? { ...current, status: value.decision, decision: value.decision, decidedAt: value.decidedAt } : current); this.saving.set(false); }, error: error => { this.actionError.set(financialMessage(error)); this.saving.set(false); } }); } }
