import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { vi } from 'vitest';
import { Estimate, Invoice, WorkApiService } from '../core/work-api.service';
import { EstimatesLivePage, InvoiceDetailLivePage, InvoicesLivePage } from './financial-pages';

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

describe('Estimates search and filtering', () => {
  let page: EstimatesLivePage;
  const mockEstimates: Estimate[] = [
    { id: 'est-1', estimateNumber: 'EST-1001', customerName: 'Apex Logistics', status: 'Sent', total: 500 } as Estimate,
    { id: 'est-2', estimateNumber: 'EST-1002', customerName: 'Beacon Homes', status: 'Draft', total: 1200 } as Estimate,
    { id: 'est-3', estimateNumber: 'EST-1003', customerName: 'Apex Solar', status: 'Approved', total: 750 } as Estimate
  ];

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: WorkApiService,
          useValue: { estimates: vi.fn(() => of(mockEstimates)) }
        }
      ]
    });
    page = TestBed.runInInjectionContext(() => new EstimatesLivePage());
  });

  it('filters estimates reactively by estimate number with or without hash prefix', () => {
    expect(page.filteredEstimates().length).toBe(3);

    page.search.set('1002');
    expect(page.filteredEstimates().map(e => e.estimateNumber)).toEqual(['EST-1002']);

    page.search.set('#EST-1001');
    expect(page.filteredEstimates().map(e => e.estimateNumber)).toEqual(['EST-1001']);
  });

  it('filters estimates reactively by customer name and status text', () => {
    page.search.set('Apex');
    expect(page.filteredEstimates().length).toBe(2);

    page.search.set('Approved');
    expect(page.filteredEstimates().map(e => e.estimateNumber)).toEqual(['EST-1003']);
  });

  it('resets search query and reloads when clearFilters is called', () => {
    page.search.set('Apex');
    expect(page.filteredEstimates().length).toBe(2);

    page.clearFilters();
    expect(page.search()).toBe('');
    expect(page.status).toBe('');
    expect(page.filteredEstimates().length).toBe(3);
  });
});

describe('Invoices search and filtering', () => {
  let page: InvoicesLivePage;
  const mockInvoices: Invoice[] = [
    { id: 'inv-1', invoiceNumber: 'INV-2001', customerName: 'Starlight Retail', status: 'Issued', paymentStatus: 'Unpaid', total: 400, balance: 400 } as Invoice,
    { id: 'inv-2', invoiceNumber: 'INV-2002', customerName: 'Zenith Labs', status: 'Issued', paymentStatus: 'Paid', total: 800, balance: 0 } as Invoice,
    { id: 'inv-3', invoiceNumber: 'INV-2003', customerName: 'Starlight Warehouse', status: 'Draft', paymentStatus: 'Unpaid', total: 300, balance: 300 } as Invoice
  ];

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: WorkApiService,
          useValue: { invoices: vi.fn(() => of(mockInvoices)) }
        }
      ]
    });
    page = TestBed.runInInjectionContext(() => new InvoicesLivePage());
  });

  it('filters invoices reactively by invoice number with or without hash prefix', () => {
    expect(page.filteredInvoices().length).toBe(3);

    page.search.set('2002');
    expect(page.filteredInvoices().map(i => i.invoiceNumber)).toEqual(['INV-2002']);

    page.search.set('#INV-2001');
    expect(page.filteredInvoices().map(i => i.invoiceNumber)).toEqual(['INV-2001']);
  });

  it('filters invoices reactively by customer name, status, or payment status', () => {
    page.search.set('Starlight');
    expect(page.filteredInvoices().length).toBe(2);

    page.search.set('Paid');
    expect(page.filteredInvoices().map(i => i.invoiceNumber)).toEqual(['INV-2002']);

    page.search.set('Draft');
    expect(page.filteredInvoices().map(i => i.invoiceNumber)).toEqual(['INV-2003']);
  });

  it('resets search query and reloads when clearFilters is called', () => {
    page.search.set('Zenith');
    expect(page.filteredInvoices().length).toBe(1);

    page.clearFilters();
    expect(page.search()).toBe('');
    expect(page.status).toBe('');
    expect(page.filteredInvoices().length).toBe(3);
  });
});

