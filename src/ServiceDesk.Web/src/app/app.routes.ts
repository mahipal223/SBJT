import { Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';
import { LoginPage } from './features/auth/login.page';
import { CallbackPage } from './features/auth/callback.page';
import { OnboardingPage } from './features/auth/onboarding.page';
import { AppShell } from './layout/app-shell';
import { CustomerDetailPage, CustomerFormPage, CustomersPage, DashboardPage, JobDetailPage, JobFormPage, JobsPage } from './features/prototype-pages';
import { AdminPage, ReportsPage, SchedulePage, SettingsPage, SubscriptionPage, TeamPage, TechnicianPage } from './features/management-pages';
import { PlatformAdminPage } from './features/platform-admin.page';
import { CustomerFormLivePage, CustomerLivePage, CustomersLivePage, JobFormLivePage, JobLivePage, JobsLivePage } from './features/work-pages';
import { CatalogLivePage } from './features/catalog-page';
import { EstimateDetailLivePage, EstimatesLivePage, InvoiceDetailLivePage, InvoicesLivePage, PublicEstimatePage } from './features/financial-pages';
import { SmtpSettingsPage } from './features/smtp-settings.page';
import { SubscriptionLivePage } from './features/subscription.page';
import { DashboardLivePage } from './features/dashboard-live.page';
import { ReportsLivePage } from './features/reports-live.page';

export const routes: Routes = [
  // ── Public auth routes ──────────────────────────────────────────────────────
  { path: 'login',    component: LoginPage },
  { path: 'callback', component: CallbackPage },           // Auth0 PKCE callback

  // ── Onboarding wizard (authenticated, no existing workspace yet) ────────────
  { path: 'onboarding', component: OnboardingPage, canActivate: [authGuard] },

  // ── Main authenticated app shell ────────────────────────────────────────────
  {
    path: 'app',
    component: AppShell,
    canActivate: [authGuard],
    children: [
      { path: 'overview',             component: DashboardLivePage },
      { path: 'customers',            component: CustomersLivePage },
      { path: 'customers/new',        component: CustomerFormLivePage },
      { path: 'customers/:id',        component: CustomerLivePage },
      { path: 'customers/detail',     component: CustomerDetailPage },
      { path: 'jobs',                 component: JobsLivePage },
      { path: 'jobs/new',             component: JobFormLivePage },
      { path: 'jobs/:id',             component: JobLivePage },
      { path: 'jobs/detail',          component: JobDetailPage },
      { path: 'schedule',             component: SchedulePage },
      { path: 'catalog',              component: CatalogLivePage },
      { path: 'estimates',            component: EstimatesLivePage },
      { path: 'estimates/:id',        component: EstimateDetailLivePage },
      { path: 'invoices',             component: InvoicesLivePage },
      { path: 'invoices/:id',         component: InvoiceDetailLivePage },
      { path: 'reports',              component: ReportsLivePage },
      { path: 'team',                 component: TeamPage },
      { path: 'subscription',         component: SubscriptionLivePage },
      { path: 'settings',             component: SettingsPage },
      { path: 'settings/smtp',        component: SmtpSettingsPage },
      { path: 'admin',                component: PlatformAdminPage },
      { path: 'technician',           component: TechnicianPage },
      { path: '',  pathMatch: 'full', redirectTo: 'overview' },
    ],
  },

  // ── Public estimate approval portal (no auth required) ─────────────────────
  { path: 'estimate/:token', component: PublicEstimatePage },

  // ── Fallback redirects ───────────────────────────────────────────────────────
  { path: '', pathMatch: 'full', redirectTo: 'app' },
  { path: '**', redirectTo: 'app' },
];
