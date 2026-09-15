import { Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';
import { platformAdminGuard } from './core/platform-admin.guard';
import { LoginPage } from './features/auth/login.page';
import { CallbackPage } from './features/auth/callback.page';
import { OnboardingPage } from './features/auth/onboarding.page';
import { AppShell } from './layout/app-shell';
import { CustomerDetailPage, CustomerFormPage, CustomersPage, DashboardPage, JobDetailPage, JobFormPage, JobsPage } from './features/prototype-pages';
import { AdminPage, ReportsPage, SchedulePage, SettingsPage, SubscriptionPage, TeamPage, TechnicianPage } from './features/management-pages';
import { CustomerFormLivePage, CustomerLivePage, CustomersLivePage, JobFormLivePage, JobLivePage, JobsLivePage } from './features/work-pages';
import { CatalogLivePage } from './features/catalog-page';
import { EstimateDetailLivePage, EstimatesLivePage, InvoiceDetailLivePage, InvoicesLivePage, PublicEstimatePage } from './features/financial-pages';
import { SmtpSettingsPage } from './features/smtp-settings.page';
import { SubscriptionLivePage } from './features/subscription.page';
import { DashboardLivePage } from './features/dashboard-live.page';
import { ReportsLivePage } from './features/reports-live.page';

export const routes: Routes = [
  // ── Public auth routes ──────────────────────────────────────────────────────
  { path: 'login', component: LoginPage },
  { path: 'callback', component: CallbackPage },           // Auth0 PKCE callback

  // ── Onboarding wizard (authenticated, no existing workspace yet) ────────────
  { path: 'onboarding', component: OnboardingPage, canActivate: [authGuard] },

  // ── Main authenticated app shell (Business module) ──────────────────────────
  {
    path: 'app',
    component: AppShell,
    canActivate: [authGuard],
    children: [
      { path: 'overview', component: DashboardLivePage },
      { path: 'customers', component: CustomersLivePage },
      { path: 'customers/new', component: CustomerFormLivePage },
      { path: 'customers/:id', component: CustomerLivePage },
      { path: 'customers/detail', component: CustomerDetailPage },
      { path: 'jobs', component: JobsLivePage },
      { path: 'jobs/new', component: JobFormLivePage },
      { path: 'jobs/:id', component: JobLivePage },
      { path: 'jobs/detail', component: JobDetailPage },
      { path: 'schedule', component: SchedulePage },
      { path: 'catalog', component: CatalogLivePage },
      { path: 'estimates', component: EstimatesLivePage },
      { path: 'estimates/:id', component: EstimateDetailLivePage },
      { path: 'invoices', component: InvoicesLivePage },
      { path: 'invoices/:id', component: InvoiceDetailLivePage },
      { path: 'reports', component: ReportsLivePage },
      { path: 'team', component: TeamPage },
      { path: 'subscription', component: SubscriptionLivePage },
      { path: 'settings', component: SettingsPage },
      { path: 'settings/smtp', component: SmtpSettingsPage },
      { path: 'admin', redirectTo: '/platform-admin', pathMatch: 'full' },
      { path: 'technician', component: TechnicianPage },
      { path: '', pathMatch: 'full', redirectTo: 'overview' },
    ],
  },

  // ── Platform Admin module (isolated control plane) ──────────────────────────
  {
    path: 'platform-admin',
    children: [
      {
        path: 'login',
        loadComponent: () =>
          import('./features/platform/platform-login.component').then(m => m.PlatformLoginPage),
      },
      {
        path: '',
        loadComponent: () =>
          import('./features/platform/platform-shell.component').then(m => m.PlatformShellComponent),
        canActivate: [platformAdminGuard],
        children: [
          {
            path: 'overview',
            loadComponent: () =>
              import('./features/platform/overview-page.component').then(m => m.PlatformOverviewComponent),
          },
          {
            path: 'workspaces',
            loadComponent: () =>
              import('./features/platform/workspaces-page.component').then(m => m.PlatformWorkspacesComponent),
          },
          {
            path: 'plans',
            loadComponent: () =>
              import('./features/platform/plans-page.component').then(m => m.PlatformPlansComponent),
          },
          {
            path: 'backups',
            loadComponent: () =>
              import('./features/platform/backups-page.component').then(m => m.PlatformBackupsComponent),
          },
          {
            path: 'audit',
            loadComponent: () =>
              import('./features/platform/audit-page.component').then(m => m.PlatformAuditComponent),
          },
          { path: '', pathMatch: 'full', redirectTo: 'overview' },
        ],
      },
    ],
  },
  { path: 'platform-login', redirectTo: 'platform-admin/login', pathMatch: 'full' },

  // ── Public estimate approval portal (no auth required) ─────────────────────
  { path: 'estimate/:token', component: PublicEstimatePage },

  // ── Fallback redirects ───────────────────────────────────────────────────────
  { path: '', pathMatch: 'full', redirectTo: 'app' },
  { path: '**', redirectTo: 'app' },
];
