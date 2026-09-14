import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAuth0 } from '@auth0/auth0-angular';
import { routes } from './app.routes';
import { apiContextInterceptor } from './core/api-context.interceptor';

/**
 * Auth0 configuration.
 * Replace the placeholder values with your Auth0 tenant details.
 *
 * How to find these values:
 *   1. Sign up at https://auth0.com (free — no credit card required)
 *   2. Create a "Single Page Application" → note Domain and Client ID
 *   3. Create an API → set Identifier to https://api.servicedesk.local
 *   4. Enable Google social connection under Authentication → Social
 *   5. Set Callback URL to http://localhost:4200/callback
 */
const AUTH0_DOMAIN    = 'FILL_IN.us.auth0.com';        // e.g. my-app.us.auth0.com
const AUTH0_CLIENT_ID = 'FILL_IN_CLIENT_ID';            // from Auth0 SPA application
const AUTH0_AUDIENCE  = 'https://api.servicedesk.local';// must match the Auth0 API identifier

export const isAuth0Configured = !AUTH0_DOMAIN.includes('FILL_IN');

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withInterceptors([apiContextInterceptor])),

    // Auth0 is registered when the Domain and Client ID are filled in.
    // Until then the app continues to use the dev mock login.
    ...(isAuth0Configured
      ? [
          provideAuth0({
            domain: AUTH0_DOMAIN,
            clientId: AUTH0_CLIENT_ID,
            authorizationParams: {
              redirect_uri: `${window.location.origin}/callback`,
              audience: AUTH0_AUDIENCE,
              scope: 'openid profile email',
            },
            httpInterceptor: {
              // Attach Bearer tokens automatically to all /api/* calls.
              allowedList: [
                {
                  uri: '/api/*',
                  tokenOptions: { authorizationParams: { audience: AUTH0_AUDIENCE } },
                },
              ],
            },
          }),
        ]
      : []),
  ],
};
