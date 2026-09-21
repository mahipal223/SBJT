import { Component, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService, AuthTokenResponse } from '../../core/auth.service';

/**
 * OAuth callback landing page.
 *
 * Google redirects here after the user selects their account:
 *   http://localhost:4200/callback?code=...&state=google_oauth
 *
 * This page:
 *  1. Reads the ?code and ?state params from the URL.
 *  2. If state === 'google_oauth', POSTs { code, redirectUri } to /api/v1/auth/google.
 *  3. The API exchanges the code with Google's token endpoint, validates the id_token,
 *     and returns a native ServiceDesk JWT.
 *  4. On success, calls handleAuthSuccess() → navigate to /app or /onboarding.
 */
@Component({
  selector: 'app-callback-page',
  imports: [],
  template: `
    <div class="callback-screen" role="status" aria-live="polite">
      <div class="spinner-ring" aria-hidden="true"></div>
      @if (statusMsg()) {
        <p>{{ statusMsg() }}</p>
      } @else {
        <p>Signing you in…</p>
      }
    </div>
  `,
  styles: `
    .callback-screen {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 20px;
      background: #f4f7fa;
      color: #5c7180;
      font-size: 16px;
    }
    .spinner-ring {
      width: 48px;
      height: 48px;
      border: 4px solid rgba(8, 127, 116, 0.2);
      border-top-color: #087f74;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  `,
})
export class CallbackPage implements OnInit {
  private readonly auth   = inject(AuthService);
  private readonly router = inject(Router);
  private readonly http   = inject(HttpClient);

  readonly statusMsg = signal('Signing you in…');

  ngOnInit(): void {
    const params = new URLSearchParams(window.location.search);
    const code   = params.get('code');
    const state  = params.get('state');
    const error  = params.get('error');

    // ── Google OAuth callback ───────────────────────────────────────────────
    if (state === 'google_oauth') {
      if (error) {
        // User denied consent or an error occurred.
        void this.router.navigate(['/login'], {
          queryParams: { error: 'google_cancelled' },
        });
        return;
      }

      if (code) {
        const redirectUri = `${window.location.origin}/callback`;
        this.http.post<AuthTokenResponse>('/api/v1/auth/google', {
          code,
          redirectUri,
        }).subscribe({
          next: (res) => {
            this.auth.handleAuthSuccess(res);
          },
          error: () => {
            void this.router.navigate(['/login'], {
              queryParams: { error: 'google_failed' },
            });
          },
        });
        return;
      }
    }

    // ── Fallback: already authenticated ────────────────────────────────────
    if (this.auth.isAuthenticated()) {
      this.auth.syncAfterLogin();
    } else {
      void this.router.navigate(['/login']);
    }
  }
}
