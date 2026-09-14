import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';

/**
 * AuthService wraps Auth0 when configured and falls back to the development
 * mock when Auth0 credentials are not yet filled in.
 *
 * Auth0 mode:  tokens come from @auth0/auth0-angular AuthService.
 * Dev mode:    localStorage flags as before (no real token).
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly router = inject(Router);
  private readonly http   = inject(HttpClient);

  // ── Dev-mode fallback (used when Auth0 is not configured) ──
  private readonly _devUserId     = signal<string | null>(localStorage.getItem('servicedesk.userId'));
  private readonly _devBusinessId = signal<string | null>(localStorage.getItem('servicedesk.businessId'));

  // ── Auth0-mode signals (populated after /callback exchange) ──
  private readonly _auth0UserId     = signal<string | null>(sessionStorage.getItem('sd.userId'));
  private readonly _auth0BusinessId = signal<string | null>(sessionStorage.getItem('sd.businessId'));
  private readonly _auth0Email      = signal<string | null>(sessionStorage.getItem('sd.email'));
  private readonly _auth0FullName   = signal<string | null>(sessionStorage.getItem('sd.fullName'));

  readonly isAuth0Mode = !localStorage.getItem('servicedesk.userId') || !!sessionStorage.getItem('sd.userId');

  readonly userId     = computed(() => this._auth0UserId()     ?? this._devUserId());
  readonly businessId = computed(() => this._auth0BusinessId() ?? this._devBusinessId());
  readonly email      = computed(() => this._auth0Email()      ?? 'owner@northstar.example');
  readonly fullName   = computed(() => this._auth0FullName()   ?? 'Demo User');

  readonly isAuthenticated = computed(() => Boolean(this.userId()));

  // ─────────────────────────────────────────────────────────────
  // Auth0 post-callback sync
  // ─────────────────────────────────────────────────────────────

  /**
   * Called from CallbackPage after the Auth0 code exchange completes.
   * Syncs the OIDC user to our backend and persists the result in session.
   */
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
        this._auth0UserId.set(result.userId);
        this._auth0Email.set(result.email);
        this._auth0FullName.set(result.fullName);

        if (result.status === 'new_user' || !result.businessId) {
          // First-time user — go to onboarding wizard.
          void this.router.navigate(['/onboarding']);
        } else {
          sessionStorage.setItem('sd.businessId', result.businessId);
          this._auth0BusinessId.set(result.businessId);
          void this.router.navigate(['/app/overview']);
        }
      },
      error: () => {
        void this.router.navigate(['/login']);
      }
    });
  }

  // ─────────────────────────────────────────────────────────────
  // Dev-mode helpers (unchanged behaviour for local development)
  // ─────────────────────────────────────────────────────────────

  private static readonly DEV_USER_ID     = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  private static readonly DEV_BUSINESS_ID = '11111111-1111-1111-1111-111111111111';

  loginAsDemo(): void {
    localStorage.setItem('servicedesk.userId',     AuthService.DEV_USER_ID);
    localStorage.setItem('servicedesk.businessId', AuthService.DEV_BUSINESS_ID);
    this._devUserId.set(AuthService.DEV_USER_ID);
    this._devBusinessId.set(AuthService.DEV_BUSINESS_ID);
  }

  logout(): void {
    localStorage.clear();
    sessionStorage.clear();
    this._devUserId.set(null);
    this._devBusinessId.set(null);
    this._auth0UserId.set(null);
    this._auth0BusinessId.set(null);
    this._auth0Email.set(null);
    this._auth0FullName.set(null);
  }
}
