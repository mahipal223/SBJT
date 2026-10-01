import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { vi } from 'vitest';
import {
  PlatformAdminApiService,
  PlatformPlanDetailResponse
} from '../../core/platform-admin-api.service';
import { PlatformContextService } from '../../core/platform-context.service';
import { PlatformPlansComponent } from './plans-page.component';

describe('PlatformPlansComponent', () => {
  const mockPlans: PlatformPlanDetailResponse[] = [
    {
      id: '11111111-1111-1111-1111-111111111111',
      code: 'SOLO',
      name: 'Solo Operator',
      billingInterval: 'Month',
      price: 29.0,
      currency: 'USD',
      isPublished: true,
      revision: 1,
      entitlements: [
        { featureCode: 'staff.seats', enabled: true, limitValue: 1, displayText: '1 staff seat' },
        { featureCode: 'jobs.per_period', enabled: true, limitValue: 100, displayText: '100 jobs per billing period' },
        { featureCode: 'storage.bytes', enabled: true, limitValue: 1073741824, displayText: '1 GB storage' },
        { featureCode: 'estimates.enabled', enabled: true, limitValue: undefined, displayText: 'Estimates enabled' }
      ]
    },
    {
      id: '22222222-2222-2222-2222-222222222222',
      code: 'TEAM',
      name: 'Growing Team',
      billingInterval: 'Month',
      price: 79.0,
      currency: 'USD',
      isPublished: false,
      revision: 1,
      entitlements: [
        { featureCode: 'staff.seats', enabled: true, limitValue: 5, displayText: '5 staff seats' },
        { featureCode: 'jobs.per_period', enabled: true, limitValue: 500, displayText: '500 jobs per billing period' },
        { featureCode: 'storage.bytes', enabled: true, limitValue: 10737418240, displayText: '10 GB storage' }
      ]
    }
  ];

  it('loads and displays platform plans and entitlements', async () => {
    const getPlans = vi.fn().mockReturnValue(of(mockPlans));

    await TestBed.configureTestingModule({
      imports: [PlatformPlansComponent],
      providers: [
        {
          provide: PlatformAdminApiService,
          useValue: {
            getPlans,
            createPlan: vi.fn(),
            updatePlan: vi.fn(),
            togglePlanPublish: vi.fn(),
            deletePlan: vi.fn()
          }
        },
        {
          provide: PlatformContextService,
          useValue: {
            canViewPlans: () => true
          }
        }
      ]
    }).compileComponents();

    const fixture = TestBed.createComponent(PlatformPlansComponent);
    fixture.detectChanges();

    expect(getPlans).toHaveBeenCalledTimes(1);
    expect(fixture.componentInstance.plans().length).toBe(2);

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Solo Operator');
    expect(el.textContent).toContain('Growing Team');
    expect(el.textContent).toContain('$29.00');
    expect(el.textContent).toContain('$79.00');
    expect(el.textContent).toContain('1 staff seat');
    expect(el.textContent).toContain('5 staff seats');
  });

  it('validates create form and creates plan with quotas and feature entitlements', async () => {
    const getPlans = vi.fn().mockReturnValue(of(mockPlans));
    const createdPlan: PlatformPlanDetailResponse = {
      id: '33333333-3333-3333-3333-333333333333',
      code: 'ENTERPRISE',
      name: 'Enterprise Tier',
      billingInterval: 'Month',
      price: 299.0,
      currency: 'USD',
      isPublished: true,
      revision: 1,
      entitlements: []
    };
    const createPlan = vi.fn().mockReturnValue(of(createdPlan));

    await TestBed.configureTestingModule({
      imports: [PlatformPlansComponent],
      providers: [
        {
          provide: PlatformAdminApiService,
          useValue: {
            getPlans,
            createPlan,
            updatePlan: vi.fn(),
            togglePlanPublish: vi.fn(),
            deletePlan: vi.fn()
          }
        },
        {
          provide: PlatformContextService,
          useValue: {
            canViewPlans: () => true
          }
        }
      ]
    }).compileComponents();

    const fixture = TestBed.createComponent(PlatformPlansComponent);
    fixture.detectChanges();

    fixture.componentInstance.openCreateModal();
    expect(fixture.componentInstance.createModalOpen()).toBe(true);

    // Validation failure: missing code & name
    fixture.componentInstance.createForm.code = '';
    fixture.componentInstance.createForm.name = '';
    fixture.componentInstance.submitCreatePlan();
    expect(createPlan).not.toHaveBeenCalled();
    expect(fixture.componentInstance.formErrors().code).toBe('Plan code is required.');
    expect(fixture.componentInstance.formErrors().name).toBe('Display name is required.');

    // Valid submission
    fixture.componentInstance.createForm.code = 'ENTERPRISE';
    fixture.componentInstance.createForm.name = 'Enterprise Tier';
    fixture.componentInstance.createForm.price = 299.0;
    fixture.componentInstance.createForm.staffSeats = 50;
    fixture.componentInstance.createForm.jobsPerPeriod = 10000;
    fixture.componentInstance.createForm.storageGb = 100;
    fixture.componentInstance.createForm.apiEnabled = true;

    fixture.componentInstance.submitCreatePlan();

    expect(createPlan).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'ENTERPRISE',
        name: 'Enterprise Tier',
        price: 299.0,
        billingInterval: 'Month',
        currency: 'USD',
        isPublished: true,
        entitlements: expect.arrayContaining([
          expect.objectContaining({ featureCode: 'staff.seats', limitValue: 50 }),
          expect.objectContaining({ featureCode: 'jobs.per_period', limitValue: 10000 }),
          expect.objectContaining({ featureCode: 'storage.bytes', limitValue: 100 * 1073741824 }),
          expect.objectContaining({ featureCode: 'api.access.enabled', enabled: true })
        ])
      })
    );
    expect(fixture.componentInstance.createModalOpen()).toBe(false);
  });

  it('opens edit modal with prefilled data and submits updates', async () => {
    const getPlans = vi.fn().mockReturnValue(of(mockPlans));
    const updatedPlan: PlatformPlanDetailResponse = {
      ...mockPlans[0],
      name: 'Solo Operator Pro',
      price: 39.0
    };
    const updatePlan = vi.fn().mockReturnValue(of(updatedPlan));

    await TestBed.configureTestingModule({
      imports: [PlatformPlansComponent],
      providers: [
        {
          provide: PlatformAdminApiService,
          useValue: {
            getPlans,
            createPlan: vi.fn(),
            updatePlan,
            togglePlanPublish: vi.fn(),
            deletePlan: vi.fn()
          }
        },
        {
          provide: PlatformContextService,
          useValue: {
            canViewPlans: () => true
          }
        }
      ]
    }).compileComponents();

    const fixture = TestBed.createComponent(PlatformPlansComponent);
    fixture.detectChanges();

    fixture.componentInstance.openEditModal(mockPlans[0]);
    expect(fixture.componentInstance.editModalOpen()).toBe(true);
    expect(fixture.componentInstance.editForm.name).toBe('Solo Operator');
    expect(fixture.componentInstance.editForm.staffSeats).toBe(1);
    expect(fixture.componentInstance.editForm.storageGb).toBe(1);

    // Modify values
    fixture.componentInstance.editForm.name = 'Solo Operator Pro';
    fixture.componentInstance.editForm.price = 39.0;
    fixture.componentInstance.editForm.staffSeats = 2;
    fixture.componentInstance.submitEditPlan();

    expect(updatePlan).toHaveBeenCalledWith(
      mockPlans[0].id,
      expect.objectContaining({
        name: 'Solo Operator Pro',
        price: 39.0,
        billingInterval: 'Month',
        entitlements: expect.arrayContaining([
          expect.objectContaining({ featureCode: 'staff.seats', limitValue: 2 })
        ])
      })
    );
    expect(fixture.componentInstance.editModalOpen()).toBe(false);
  });

  it('toggles publish state', async () => {
    const getPlans = vi.fn().mockReturnValue(of(mockPlans));
    const togglePlanPublish = vi.fn().mockReturnValue(of({ ...mockPlans[1], isPublished: true }));

    await TestBed.configureTestingModule({
      imports: [PlatformPlansComponent],
      providers: [
        {
          provide: PlatformAdminApiService,
          useValue: {
            getPlans,
            createPlan: vi.fn(),
            updatePlan: vi.fn(),
            togglePlanPublish,
            deletePlan: vi.fn()
          }
        },
        {
          provide: PlatformContextService,
          useValue: {
            canViewPlans: () => true
          }
        }
      ]
    }).compileComponents();

    const fixture = TestBed.createComponent(PlatformPlansComponent);
    fixture.detectChanges();

    fixture.componentInstance.togglePublish(mockPlans[1]); // currently unpublished
    expect(togglePlanPublish).toHaveBeenCalledWith(mockPlans[1].id, true);
  });

  it('handles plan deletion after confirmation', async () => {
    const getPlans = vi.fn().mockReturnValue(of(mockPlans));
    const deletePlan = vi.fn().mockReturnValue(of(undefined));
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    await TestBed.configureTestingModule({
      imports: [PlatformPlansComponent],
      providers: [
        {
          provide: PlatformAdminApiService,
          useValue: {
            getPlans,
            createPlan: vi.fn(),
            updatePlan: vi.fn(),
            togglePlanPublish: vi.fn(),
            deletePlan
          }
        },
        {
          provide: PlatformContextService,
          useValue: {
            canViewPlans: () => true
          }
        }
      ]
    }).compileComponents();

    const fixture = TestBed.createComponent(PlatformPlansComponent);
    fixture.detectChanges();

    fixture.componentInstance.confirmDelete(mockPlans[0]);
    expect(deletePlan).toHaveBeenCalledWith(mockPlans[0].id);
  });
});
