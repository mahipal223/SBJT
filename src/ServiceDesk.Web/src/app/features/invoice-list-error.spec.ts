import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { throwError } from 'rxjs';
import { WorkApiService } from '../core/work-api.service';
import { InvoicesLivePage } from './financial-pages';

describe('Invoice list unavailable state', () => {
  it('offers retry without presenting failed data as zero balances', async () => {
    await TestBed.configureTestingModule({
      imports: [InvoicesLivePage],
      providers: [
        provideRouter([]),
        { provide: WorkApiService, useValue: {
          invoices: () => throwError(() => new HttpErrorResponse({ status: 500 }))
        } }
      ]
    }).compileComponents();
    const fixture = TestBed.createComponent(InvoicesLivePage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const page = fixture.nativeElement as HTMLElement;
    expect(page.textContent).toContain('Invoices unavailable');
    expect(page.textContent).toContain('Try again');
    expect(page.querySelector('.stat-value')).toBeNull();
    expect(page.textContent).not.toContain('0 invoices');
  });
});
