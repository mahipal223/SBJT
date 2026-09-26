import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { Subject } from 'rxjs';
import { vi } from 'vitest';
import { Customer, WorkApiService } from '../core/work-api.service';
import { CustomerFormLivePage } from './work-pages';

describe('Customer popup submission', () => {
  async function setup() {
    const response = new Subject<Customer>();
    const createCustomer = vi.fn(() => response);
    await TestBed.configureTestingModule({
      imports: [CustomerFormLivePage],
      providers: [provideRouter([]), { provide: WorkApiService, useValue: { createCustomer } }]
    }).compileComponents();
    const fixture = TestBed.createComponent(CustomerFormLivePage);
    fixture.componentRef.setInput('popup', true);
    const form = fixture.componentInstance;
    form.model = { ...form.model, name: 'QA Popup Customer', phone: '5125550199', addressLine1: '100 Test Road' };
    fixture.detectChanges();
    return { fixture, form, response, createCustomer };
  }

  it('emits the saved customer without navigating and blocks duplicate submissions', async () => {
    const { form, response, createCustomer } = await setup();
    const saved = vi.fn();
    form.saved.subscribe(saved);
    const navigation = vi.spyOn(TestBed.inject(Router), 'navigate');
    form.save();
    form.save();
    expect(createCustomer).toHaveBeenCalledTimes(1);
    const customer = { id: 'qa-popup-customer', name: form.model.name } as Customer;
    response.next(customer);
    expect(saved).toHaveBeenCalledWith(customer);
    expect(navigation).not.toHaveBeenCalled();
    expect(form.saving()).toBe(false);
    expect(form.model.name).toBe('');
  });

  it('keeps entered details and displays an API failure for retry', async () => {
    const { form, fixture, response } = await setup();
    const saved = vi.fn();
    form.saved.subscribe(saved);
    form.save();
    response.error(new HttpErrorResponse({ status: 503, error: { detail: 'Please try again.' } }));
    fixture.detectChanges();
    expect(saved).not.toHaveBeenCalled();
    expect(form.model.name).toBe('QA Popup Customer');
    expect(form.saving()).toBe(false);
    expect(fixture.nativeElement.querySelector('#form-error-banner').textContent).toContain('Please try again.');
  });
});
