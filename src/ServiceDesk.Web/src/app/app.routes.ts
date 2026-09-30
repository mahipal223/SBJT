import { Routes } from '@angular/router';
import { authGuard, workspaceGuard } from './core/auth.guard';
import { platformAdminGuard } from './core/platform-admin.guard';
import { LoginPage } from './features/auth/login.page';
import { CallbackPage } from './features/auth/callback.page';
import { OnboardingPage } from './features/auth/onboarding.page';
import { AppShell } from './layout/app-shell';
import { SchedulePage, SettingsPage, TeamPage, TechnicianPage } from './features/management-pages';
import { CustomerFormLivePage, CustomerLivePage, CustomersLivePage, JobFormLivePage, JobLivePage, JobsLivePage } from './features/work-pages';
import { CatalogLivePage } from './features/catalog-page';
import { EstimateDetailLivePage, EstimatesLivePage, InvoiceDetailLivePage, InvoicesLivePage, PublicEstimatePage } from './features/financial-pages';
import { SmtpSettingsPage } from './features/smtp-settings.page';
import { SubscriptionLivePage } from './features/subscription.page';
import { DashboardLivePage } from './features/dashboard-live.page';
import { ReportsLivePage } from './features/reports-live.page';
import { NotFoundPage } from './features/not-found.page';

export const routes: Routes = [
  // ── Public auth routes ──────────────────────────────────────────────────────
  { path: 'login', component: LoginPage },
  { path: 'callback', component: CallbackPage },           // Google OAuth callback (GSI popup handles token exchange in LoginPage)

  // ── Onboarding wizard (authenticated, no existing workspace yet) ────────────
  { path: 'onboarding', component: OnboardingPage, canActivate: [authGuard] },

  // ── Main authenticated app shell (Business module) ──────────────────────────
  {
    path: 'app',
    component: AppShell,
    canActivate: [authGuard, workspaceGuard],
    children: [
      { path: 'overview', component: DashboardLivePage, title: 'Dashboard | ServiceDesk' },
      { path: 'customers', component: CustomersLivePage, title: 'Customers | ServiceDesk' },
      { path: 'customers/new', component: CustomerFormLivePage, title: 'New Customer | ServiceDesk' },
      { path: 'customers/:id', component: CustomerLivePage, title: 'Customer Details | ServiceDesk' },
      { path: 'customers/detail', redirectTo: 'customers', pathMatch: 'full' },
      { path: 'jobs', component: JobsLivePage, title: 'Jobs | ServiceDesk' },
      { path: 'jobs/new', component: JobFormLivePage, title: 'New Job | ServiceDesk' },
      { path: 'jobs/:id', component: JobLivePage, title: 'Job Details | ServiceDesk' },
      { path: 'jobs/detail', redirectTo: 'jobs', pathMatch: 'full' },
      { path: 'schedule', component: SchedulePage, title: 'Schedule | ServiceDesk' },
      { path: 'catalog', component: CatalogLivePage, title: 'Services & Parts | ServiceDesk' },
      { path: 'estimates', component: EstimatesLivePage, title: 'Estimates | ServiceDesk' },
      { path: 'estimates/:id', component: EstimateDetailLivePage, title: 'Estimate Details | ServiceDesk' },
      { path: 'invoices', component: InvoicesLivePage, title: 'Invoices & Payments | ServiceDesk' },
      { path: 'invoices/:id', component: InvoiceDetailLivePage, title: 'Invoice Details | ServiceDesk' },
      { path: 'reports', component: ReportsLivePage, title: 'Reports | ServiceDesk' },
      { path: 'team', component: TeamPage, title: 'Team | ServiceDesk' },
      { path: 'subscription', component: SubscriptionLivePage, title: 'Subscription & Usage | ServiceDesk' },
      { path: 'settings', component: SettingsPage, title: 'Business Settings | ServiceDesk' },
      { path: 'settings/smtp', component: SmtpSettingsPage, title: 'SMTP Settings | ServiceDesk' },
      { path: 'admin', redirectTo: '/platform-admin', pathMatch: 'full' },
      { path: 'technician', component: TechnicianPage, title: 'Technician View | ServiceDesk' },
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
          {
            path: 'smtp',
            loadComponent: () =>
              import('./features/platform/smtp-page.component').then(m => m.PlatformSmtpComponent),
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
  { path: '**', component: NotFoundPage, title: 'Page Not Found | ServiceDesk' },
];
