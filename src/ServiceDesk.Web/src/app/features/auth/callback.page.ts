import { Component, inject, OnInit } from '@angular/core';
import { AuthService } from '../../core/auth.service';

/**
 * Handles the Auth0 PKCE authorization code redirect.
 * Auth0 redirects here after login with ?code=... and ?state=...
 * The Auth0 SDK exchanges the code for tokens automatically.
 * This component then calls syncAfterLogin() to register the user in our backend.
 */
@Component({
  selector: 'app-callback-page',
  template: `
    <div class="callback-screen" role="status" aria-live="polite">
      <div class="spinner-ring" aria-hidden="true"></div>
      <p>Signing you in…</p>
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
  private readonly auth = inject(AuthService);

  ngOnInit(): void {
    // Auth0 SDK has already exchanged the code for tokens at this point.
    // Sync the authenticated user with our backend.
    this.auth.syncAfterLogin();
  }
}
