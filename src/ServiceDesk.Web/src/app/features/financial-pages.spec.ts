import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { vi } from 'vitest';
import { Invoice, WorkApiService } from '../core/work-api.service';
import { InvoiceDetailLivePage } from './financial-pages';

describe('Invoice payment workflow', () => {
  const invoice = { id: 'invoice-1', invoiceNumber: 'INV-QA', balance: 165, status: 'Issued' } as Invoice;
  let page: InvoiceDetailLivePage;
  let api: { invoice: ReturnType<typeof vi.fn>; recordPayment: ReturnType<typeof vi.fn>; issueInvoice: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    api = {
      invoice: vi.fn(() => of(invoice)),
      recordPayment: vi.fn(() => of({})),
      issueInvoice: vi.fn(() => of(invoice))
    };
    TestBed.configureTestingModule({ providers: [
      { provide: WorkApiService, useValue: api },
      { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: invoice.id }) } } }
    ] });
    page = TestBed.runInInjectionContext(() => new InvoiceDetailLivePage());
  });

  it('rejects overpayments and invalid amounts before sending a request', () => {
    for (const amount of [0, -1, NaN, 166]) {
      page.paymentAmount = amount;
      page.submitPayment();
      expect(page.paymentAmountError()).toBeTruthy();
    }
    expect(api.recordPayment).not.toHaveBeenCalled();
  });

  it('records a partial card payment once while the request is pending', () => {
    const pending = new Subject<unknown>();
    api.recordPayment.mockReturnValue(pending);
    page.openPaymentModal();
    page.paymentAmount = 65;
    page.submitPayment();
    page.submitPayment();
    page.closePaymentModal();
    expect(api.recordPayment).toHaveBeenCalledExactlyOnceWith(invoice.id, 65, 'Card', undefined);
    expect(page.showPaymentModal()).toBe(true);
    pending.next({});
    pending.complete();
    expect(page.showPaymentModal()).toBe(false);
  });

  it('keeps payment failures in the modal and preserves the invoice', () => {
    api.recordPayment.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 409, error: { detail: 'Reference already used.' } })));
    page.openPaymentModal();
    page.submitPayment();
    expect(page.paymentError()).toBe('Reference already used.');
    expect(page.error()).toBe('');
    expect(page.invoice()).toBe(invoice);
    expect(page.showPaymentModal()).toBe(true);
    expect(page.saving()).toBe(false);
  });

  it('issues an invoice before asking for the actual payment method and amount', () => {
    page.issueAndSettle();
    expect(api.issueInvoice).toHaveBeenCalledOnce();
    expect(api.recordPayment).not.toHaveBeenCalled();
    expect(page.showPaymentModal()).toBe(true);
    expect(page.paymentAmount).toBe(165);
  });

  it('clears the previous transaction reference for the next payment', () => {
    page.paymentRef = 'QA-first-payment';
    page.openPaymentModal();
    expect(page.paymentRef).toBe('');
    expect(page.paymentMethodOptions.map(option => option.value)).toContain('BankTransfer');
  });
});
