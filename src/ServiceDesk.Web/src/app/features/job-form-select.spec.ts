import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { WorkApiService } from '../core/work-api.service';
import { JobFormLivePage } from './work-pages';

describe('Job form selected values', () => {
  it('shows the chosen customer and arrival window without their placeholders', async () => {
    await TestBed.configureTestingModule({
      imports: [JobFormLivePage],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap({}) } } },
        { provide: WorkApiService, useValue: {
          customers: () => of({ items: [{ id: 'customer-1', name: 'QA Customer', phone: '5125550100', addressLine1: 'Test Road' }] }),
          catalog: () => of({ items: [] })
        } }
      ]
    }).compileComponents();

    const fixture = TestBed.createComponent(JobFormLivePage);
    fixture.componentInstance.model.customerId = 'customer-1';
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const customer = fixture.nativeElement.querySelector('#customerId') as HTMLElement;
    const arrival = fixture.nativeElement.querySelector('#arrivalWindow') as HTMLElement;
    expect(customer.querySelector('.ng-value-label')?.textContent).toContain('QA Customer');
    expect(customer.querySelector('.ng-placeholder')?.textContent?.trim() || '').toBe('');
    expect(arrival.querySelector('.ng-value-label')?.textContent).toContain('9:00 AM');
    expect(arrival.querySelector('.ng-placeholder')?.textContent?.trim() || '').toBe('');
  });
});
