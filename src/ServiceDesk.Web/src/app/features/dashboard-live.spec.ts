import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Subject } from 'rxjs';
import { vi } from 'vitest';
import { DashboardSummary, WorkApiService } from '../core/work-api.service';
import { DashboardLivePage } from './dashboard-live.page';

describe('Dashboard refresh states', () => {
  it('prevents duplicate requests and identifies retained metrics after a failed refresh', async () => {
    const first = new Subject<DashboardSummary>();
    const refresh = new Subject<DashboardSummary>();
    const getDashboardSummary = vi.fn().mockReturnValueOnce(first).mockReturnValueOnce(refresh);
    await TestBed.configureTestingModule({
      imports: [DashboardLivePage],
      providers: [provideRouter([]), { provide: WorkApiService, useValue: { getDashboardSummary } }]
    }).compileComponents();
    const fixture = TestBed.createComponent(DashboardLivePage);
    fixture.detectChanges();
    fixture.componentInstance.loadDashboard();
    expect(getDashboardSummary).toHaveBeenCalledTimes(1);
    first.next({
      jobsTodayCount: 2, jobsCompletedTodayCount: 1, jobsRemainingTodayCount: 1,
      openEstimatesCount: 1, openEstimatesValue: 200,
      outstandingInvoicesCount: 1, outstandingInvoicesValue: 100,
      revenueThisMonth: 500, revenueLastMonth: 300, todaySchedule: [], attentionItems: []
    });
    first.complete();
    fixture.componentInstance.loadDashboard();
    refresh.error({ error: { detail: 'Please try again.' } });
    fixture.detectChanges();
    const page = fixture.nativeElement as HTMLElement;
    expect(page.textContent).toContain('Showing the last loaded overview.');
    expect(page.textContent).toContain('$500.00');
    expect(page.querySelector('[role="alert"]')?.textContent).toContain('Please try again.');
    expect(fixture.componentInstance.loading()).toBe(false);
  });
});
