import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService as Auth0Service } from '@auth0/auth0-angular';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly router = inject(Router);
  private readonly http   = inject(HttpClient);
  private readonly auth0  = inject(Auth0Service, { optional: true });

  private readonly _userId     = signal<string | null>(sessionStorage.getItem('sd.userId'));
  private readonly _businessId = signal<string | null>(sessionStorage.getItem('sd.businessId'));
  private readonly _email      = signal<string | null>(sessionStorage.getItem('sd.email'));
  private readonly _fullName   = signal<string | null>(sessionStorage.getItem('sd.fullName'));
  private readonly _businessName = signal<string | null>(sessionStorage.getItem('sd.businessName'));
  private readonly _role = signal<string | null>(sessionStorage.getItem('sd.role'));

  readonly userId     = computed(() => this._userId());
  readonly businessId = computed(() => this._businessId());
  readonly email      = computed(() => this._email() ?? '');
  readonly fullName   = computed(() => this._fullName() ?? '');
  readonly businessName = computed(() => this._businessName() ?? 'Workspace');
  readonly role = computed(() => this._role() ?? 'Member');

  readonly isAuthenticated = computed(() => Boolean(this.userId()));

  syncAfterLogin(): void {
    this.http.post<{
      userId: string;
      email: string;
      fullName: string;
      status: 'existing' | 'new_user';
      businessId: string | null;
      businessName: string | null;
      role: string | null;
    }>('/api/v1/auth/sync-user', {}).subscribe({
      next: (result) => {
        sessionStorage.setItem('sd.userId',   result.userId);
        sessionStorage.setItem('sd.email',    result.email);
        sessionStorage.setItem('sd.fullName', result.fullName);
        this._userId.set(result.userId);
        this._email.set(result.email);
        this._fullName.set(result.fullName);

        if (result.status === 'new_user' || !result.businessId) {
          // First-time user — go to onboarding wizard.
          void this.router.navigate(['/onboarding']);
        } else {
          this.activateWorkspace(result.businessId, result.businessName, result.role ?? 'Owner');
          void this.router.navigate(['/app/overview']);
        }
      },
      error: () => {
        void this.router.navigate(['/login']);
      }
    });
  }

  activateWorkspace(businessId: string, businessName?: string | null, role = 'Owner'): void {
    sessionStorage.setItem('sd.businessId', businessId);
    this._businessId.set(businessId);

    if (businessName) {
      sessionStorage.setItem('sd.businessName', businessName);
      this._businessName.set(businessName);
    }

    if (role) {
      sessionStorage.setItem('sd.role', role);
      this._role.set(role);
    }
  }

  logout(): void {
    localStorage.clear();
    sessionStorage.clear();
    this._userId.set(null);
    this._businessId.set(null);
    this._email.set(null);
    this._fullName.set(null);
    this._businessName.set(null);
    this._role.set(null);

    if (this.auth0) {
      this.auth0.logout({
        logoutParams: {
          returnTo: `${window.location.origin}/login`,
        },
      });
    } else {
      void this.router.navigate(['/login']);
    }
  }
}
