import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { vi } from 'vitest';
import {
  PlatformAdminApiService,
  PlatformUserDetailResponse
} from '../../core/platform-admin-api.service';
import { PlatformContextService } from '../../core/platform-context.service';
import { PlatformUsersPageComponent } from './users-page.component';

describe('PlatformUsersPageComponent', () => {
  const mockUsers: PlatformUserDetailResponse[] = [
    {
      id: '11111111-1111-1111-1111-111111111111',
      fullName: 'Mahipal Sharma',
      email: 'mahipal@servicedesk.local',
      role: 'OperationsAdmin',
      isActive: true,
      pageAccess: ['overview', 'workspaces', 'plans', 'users', 'backups', 'audit', 'smtp', 'security'],
      createdAt: '2026-09-01T10:00:00Z'
    },
    {
      id: '22222222-2222-2222-2222-222222222222',
      fullName: 'Support Agent',
      email: 'support@servicedesk.local',
      role: 'Support',
      isActive: true,
      pageAccess: ['overview', 'workspaces'],
      createdAt: '2026-09-05T12:00:00Z'
    }
  ];

  it('loads and displays registered platform users', async () => {
    const getPlatformUsers = vi.fn().mockReturnValue(of(mockUsers));
    const createPlatformUser = vi.fn();
    const updatePlatformUser = vi.fn();
    const deletePlatformUser = vi.fn();

    await TestBed.configureTestingModule({
      imports: [PlatformUsersPageComponent],
      providers: [
        {
          provide: PlatformAdminApiService,
          useValue: { getPlatformUsers, createPlatformUser, updatePlatformUser, deletePlatformUser }
        },
        {
          provide: PlatformContextService,
          useValue: {
            fullName: () => 'Mahipal Sharma',
            operator: () => ({ id: '11111111-1111-1111-1111-111111111111' })
          }
        }
      ]
    }).compileComponents();

    const fixture = TestBed.createComponent(PlatformUsersPageComponent);
    fixture.detectChanges();

    expect(getPlatformUsers).toHaveBeenCalledTimes(1);
    expect(fixture.componentInstance.users().length).toBe(2);

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Mahipal Sharma');
    expect(el.textContent).toContain('support@servicedesk.local');
    expect(el.textContent).toContain('Overview & Telemetry');
  });

  it('validates create form and successfully creates user with custom access', async () => {
    const getPlatformUsers = vi.fn().mockReturnValue(of(mockUsers));
    const newUser: PlatformUserDetailResponse = {
      id: '33333333-3333-3333-3333-333333333333',
      fullName: 'Billing User',
      email: 'billing@servicedesk.local',
      role: 'BillingAdmin',
      isActive: true,
      pageAccess: ['overview', 'plans'],
      createdAt: '2026-09-10T14:00:00Z'
    };
    const createPlatformUser = vi.fn().mockReturnValue(of(newUser));

    await TestBed.configureTestingModule({
      imports: [PlatformUsersPageComponent],
      providers: [
        {
          provide: PlatformAdminApiService,
          useValue: { getPlatformUsers, createPlatformUser, updatePlatformUser: vi.fn(), deletePlatformUser: vi.fn() }
        },
        {
          provide: PlatformContextService,
          useValue: {
            fullName: () => 'Mahipal Sharma',
            operator: () => ({ id: '11111111-1111-1111-1111-111111111111' })
          }
        }
      ]
    }).compileComponents();

    const fixture = TestBed.createComponent(PlatformUsersPageComponent);
    fixture.detectChanges();

    fixture.componentInstance.openCreateModal();
    expect(fixture.componentInstance.isCreateModalOpen()).toBe(true);

    // Missing fields validation
    fixture.componentInstance.createForm.fullName = '';
    fixture.componentInstance.submitCreate();
    expect(createPlatformUser).not.toHaveBeenCalled();
    expect(fixture.componentInstance.formErrors().fullName).toBe('Full name is required.');

    // Valid submission
    fixture.componentInstance.createForm.fullName = 'Billing User';
    fixture.componentInstance.createForm.email = 'billing@servicedesk.local';
    fixture.componentInstance.createForm.pageAccess = ['overview', 'plans'];
    fixture.componentInstance.submitCreate();

    expect(createPlatformUser).toHaveBeenCalledWith({
      fullName: 'Billing User',
      email: 'billing@servicedesk.local',
      initialPassword: undefined,
      pageAccess: ['overview', 'plans']
    });
    expect(fixture.componentInstance.isCreateModalOpen()).toBe(false);
  });

  it('updates platform user page access', async () => {
    const getPlatformUsers = vi.fn().mockReturnValue(of(mockUsers));
    const updatedUser: PlatformUserDetailResponse = {
      ...mockUsers[1],
      fullName: 'Senior Support Agent',
      pageAccess: ['overview', 'workspaces', 'security']
    };
    const updatePlatformUser = vi.fn().mockReturnValue(of(updatedUser));

    await TestBed.configureTestingModule({
      imports: [PlatformUsersPageComponent],
      providers: [
        {
          provide: PlatformAdminApiService,
          useValue: { getPlatformUsers, createPlatformUser: vi.fn(), updatePlatformUser, deletePlatformUser: vi.fn() }
        },
        {
          provide: PlatformContextService,
          useValue: {
            fullName: () => 'Mahipal Sharma',
            operator: () => ({ id: '11111111-1111-1111-1111-111111111111' })
          }
        }
      ]
    }).compileComponents();

    const fixture = TestBed.createComponent(PlatformUsersPageComponent);
    fixture.detectChanges();

    fixture.componentInstance.openEditModal(mockUsers[1]);
    expect(fixture.componentInstance.isEditModalOpen()).toBe(true);

    fixture.componentInstance.editForm.fullName = 'Senior Support Agent';
    fixture.componentInstance.editForm.pageAccess = ['overview', 'workspaces', 'security'];
    fixture.componentInstance.submitEdit();

    expect(updatePlatformUser).toHaveBeenCalledWith(
      mockUsers[1].id,
      {
        fullName: 'Senior Support Agent',
        isActive: true,
        pageAccess: ['overview', 'workspaces', 'security']
      }
    );
    expect(fixture.componentInstance.isEditModalOpen()).toBe(false);
  });
});
