import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { Job, WorkApiService } from '../core/work-api.service';
import { SchedulePage } from './management-pages';

describe('Mobile schedule agenda', () => {
  it('shows every weekend visit, including visits sharing an arrival window', async () => {
    await TestBed.configureTestingModule({
      imports: [SchedulePage],
      providers: [provideRouter([]), { provide: WorkApiService, useValue: {
        jobs: () => of({ items: [] })
      } }]
    }).compileComponents();
    const fixture = TestBed.createComponent(SchedulePage);
    fixture.detectChanges();
    const saturday = fixture.componentInstance.days()[5];
    fixture.componentInstance.rawJobs.set([
      { id: 'first', title: 'First weekend visit', scheduledDate: saturday.fullDate, arrivalWindow: '9:00 AM – 11:00 AM', status: 'Scheduled' },
      { id: 'second', title: 'Second weekend visit', scheduledDate: saturday.fullDate, arrivalWindow: '9:00 AM – 11:00 AM', status: 'Scheduled' }
    ] as Job[]);
    fixture.detectChanges();
    const agenda = fixture.nativeElement.querySelector('.mobile-agenda') as HTMLElement;
    expect(agenda.querySelectorAll('.agenda-day').length).toBe(7);
    expect(agenda.textContent).toContain('First weekend visit');
    expect(agenda.textContent).toContain('Second weekend visit');
    expect(agenda.querySelectorAll('a').length).toBe(2);
  });
});
