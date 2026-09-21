import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  avatarUrl: string | null;
  emailVerified: boolean;
  providers: string[];
}

export interface AuthTokenResponse {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
  user: UserProfile;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly router = inject(Router);
  private readonly http   = inject(HttpClient);

  private readonly _token      = signal<string | null>(sessionStorage.getItem('sd.token'));
  private readonly _userId     = signal<string | null>(sessionStorage.getItem('sd.userId'));
  private readonly _businessId = signal<string | null>(sessionStorage.getItem('sd.businessId'));
  private readonly _email      = signal<string | null>(sessionStorage.getItem('sd.email'));
  private readonly _fullName   = signal<string | null>(sessionStorage.getItem('sd.fullName'));
  private readonly _businessName = signal<string | null>(sessionStorage.getItem('sd.businessName'));
  private readonly _role = signal<string | null>(sessionStorage.getItem('sd.role'));

  readonly token      = computed(() => this._token());
  readonly userId     = computed(() => this._userId());
  readonly businessId = computed(() => this._businessId());
  readonly email      = computed(() => this._email() ?? '');
  readonly fullName   = computed(() => this._fullName() ?? '');
  readonly businessName = computed(() => this._businessName() ?? 'Workspace');
  readonly role = computed(() => this._role() ?? 'Member');

  readonly isAuthenticated = computed(() => Boolean(this.token() || this.userId()));

  handleAuthSuccess(authResponse: AuthTokenResponse): void {
    sessionStorage.setItem('sd.token',    authResponse.accessToken);
    sessionStorage.setItem('sd.userId',   authResponse.user.id);
    sessionStorage.setItem('sd.email',    authResponse.user.email);
    sessionStorage.setItem('sd.fullName', authResponse.user.fullName);

    this._token.set(authResponse.accessToken);
    this._userId.set(authResponse.user.id);
    this._email.set(authResponse.user.email);
    this._fullName.set(authResponse.user.fullName);

    this.syncAfterLogin();
  }

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
        // Fallback directly to onboarding if sync fails on new user
        void this.router.navigate(['/onboarding']);
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
    this._token.set(null);
    this._userId.set(null);
    this._businessId.set(null);
    this._email.set(null);
    this._fullName.set(null);
    this._businessName.set(null);
    this._role.set(null);

    void this.router.navigate(['/login']);
  }
}
