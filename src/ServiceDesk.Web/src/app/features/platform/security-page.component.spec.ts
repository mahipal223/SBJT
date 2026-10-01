import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { PlatformAdminApiService, PasswordPolicyResponse } from '../../core/platform-admin-api.service';
import { PlatformContextService } from '../../core/platform-context.service';
import { PlatformSecurityComponent } from './security-page.component';

describe('PlatformSecurityComponent', () => {
  const mockPolicy: PasswordPolicyResponse = {
    minLength: 10,
    maxLength: 64,
    requireUppercase: true,
    requireLowercase: true,
    requireDigit: true,
    requireNonAlphanumeric: true,
    maxFailedAccessAttempts: 5,
    lockoutDurationMinutes: 15,
    passwordExpirationDays: 90,
    preventPasswordReuseCount: 3,
    updatedAt: new Date().toISOString()
  };

  it('loads and binds security policy configuration', async () => {
    const getPasswordPolicy = vi.fn().mockReturnValue(of(mockPolicy));
    const updatePasswordPolicy = vi.fn();

    await TestBed.configureTestingModule({
      imports: [PlatformSecurityComponent],
      providers: [
        {
          provide: PlatformAdminApiService,
          useValue: { getPasswordPolicy, updatePasswordPolicy }
        },
        {
          provide: PlatformContextService,
          useValue: {
            canViewSecurity: () => true,
            canManageSecurity: () => true
          }
        }
      ]
    }).compileComponents();

    const fixture = TestBed.createComponent(PlatformSecurityComponent);
    fixture.detectChanges();

    expect(getPasswordPolicy).toHaveBeenCalledTimes(1);
    expect(fixture.componentInstance.minLength).toBe(10);
    expect(fixture.componentInstance.maxLength).toBe(64);
    expect(fixture.componentInstance.maxFailedAccessAttempts).toBe(5);

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('10 chars');
    expect(el.textContent).toContain('5 attempts');
  });

  it('rejects invalid minLength less than 8 and blocks saving', async () => {
    const getPasswordPolicy = vi.fn().mockReturnValue(of(mockPolicy));
    const updatePasswordPolicy = vi.fn().mockReturnValue(of(mockPolicy));

    await TestBed.configureTestingModule({
      imports: [PlatformSecurityComponent],
      providers: [
        {
          provide: PlatformAdminApiService,
          useValue: { getPasswordPolicy, updatePasswordPolicy }
        },
        {
          provide: PlatformContextService,
          useValue: {
            canViewSecurity: () => true,
            canManageSecurity: () => true
          }
        }
      ]
    }).compileComponents();

    const fixture = TestBed.createComponent(PlatformSecurityComponent);
    fixture.detectChanges();

    fixture.componentInstance.minLength = 6;
    fixture.componentInstance.validateMinLength();
    expect(fixture.componentInstance.isValid()).toBe(false);
    expect(fixture.componentInstance.minLengthError()).toBe('Minimum length must be at least 8 characters.');

    fixture.componentInstance.savePolicy();
    expect(updatePasswordPolicy).not.toHaveBeenCalled();
  });

  it('successfully updates policy when form is valid', async () => {
    const getPasswordPolicy = vi.fn().mockReturnValue(of(mockPolicy));
    const updatedPolicy: PasswordPolicyResponse = {
      ...mockPolicy,
      minLength: 12
    };
    const updatePasswordPolicy = vi.fn().mockReturnValue(of(updatedPolicy));

    await TestBed.configureTestingModule({
      imports: [PlatformSecurityComponent],
      providers: [
        {
          provide: PlatformAdminApiService,
          useValue: { getPasswordPolicy, updatePasswordPolicy }
        },
        {
          provide: PlatformContextService,
          useValue: {
            canViewSecurity: () => true,
            canManageSecurity: () => true
          }
        }
      ]
    }).compileComponents();

    const fixture = TestBed.createComponent(PlatformSecurityComponent);
    fixture.detectChanges();

    fixture.componentInstance.minLength = 12;
    fixture.componentInstance.savePolicy();

    expect(updatePasswordPolicy).toHaveBeenCalledWith(
      expect.objectContaining({
        minLength: 12
      })
    );
    expect(fixture.componentInstance.successMessage()).toContain('successfully updated');
  });
});
