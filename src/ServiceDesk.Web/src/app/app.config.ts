import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { authHttpInterceptorFn, provideAuth0 } from '@auth0/auth0-angular';
import { routes } from './app.routes';
import { apiContextInterceptor } from './core/api-context.interceptor';

const AUTH0_DOMAIN = 'servicesdesk.us.auth0.com';
const AUTH0_CLIENT_ID = 'QXuve2mmsgfdNSkIESWjMXiYd6fYcdZS';
const AUTH0_AUDIENCE = 'https://servicesdesk.us.auth0.com/api/v2/';

export const isAuth0Configured = true;

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withInterceptors([
      apiContextInterceptor,
    ])),

    provideAuth0({
      domain: AUTH0_DOMAIN,
      clientId: AUTH0_CLIENT_ID,
      authorizationParams: {
        redirect_uri: `${window.location.origin}/callback`,
        audience: AUTH0_AUDIENCE,
        scope: 'openid profile email',
      },
      httpInterceptor: {
        allowedList: [
          {
            uri: '/api/*',
            tokenOptions: { authorizationParams: { audience: AUTH0_AUDIENCE } },
          },
        ],
      },
    }),
  ],
};
