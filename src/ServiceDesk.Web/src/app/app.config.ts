import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { routes } from './app.routes';
import { apiContextInterceptor } from './core/api-context.interceptor';

// ── Google OAuth 2.0 ────────────────────────────────────────────────────────
// Direct integration via Google Identity Services (GSI).
// The GSI script (accounts.google.com/gsi/client) is loaded in index.html.
// The credential returned by GSI is an id_token sent to POST /api/v1/auth/google.
export const GOOGLE_CLIENT_ID =
  '868339311311-cd5p3kqt9lg6lbg93rhhklnbv9a4vbur.apps.googleusercontent.com';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withInterceptors([
      apiContextInterceptor,
    ])),
    // Auth0 removed — authentication is now handled by:
    //   • Native email/password  → POST /api/v1/auth/login
    //   • Google Sign-In (GSI)  → POST /api/v1/auth/google  (id_token)
    //   • Apple Sign-In (TODO)  → POST /api/v1/auth/apple   (identity_token)
  ],
};
