import { HttpClient } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { AuthService } from '../../core/auth.service';
import { CurrentUser, WorkspaceContext } from '../../core/api.models';

@Component({
  selector: 'app-overview-page',
  template: `
    <main class="page">
      <div class="heading">
        <div>
          <p class="eyebrow">PHASE 1 FOUNDATION</p>
          <h1>Your business, at a glance</h1>
          <p>Authentication and tenant access are connected to the ASP.NET Core API.</p>
        </div>
        <span class="status" [class.error]="status() === 'Unavailable'">API {{ status() }}</span>
      </div>

      @if (error()) {
        <section class="alert" role="alert">
          <strong>Could not load the workspace.</strong>
          <span>{{ error() }}</span>
        </section>
      }

      <section class="cards" aria-label="Workspace foundation status">
        <article>
          <span>Business</span>
          <strong>{{ user()?.memberships?.[0]?.businessName ?? 'Loading…' }}</strong>
          <small>Private workspace</small>
        </article>
        <article>
          <span>Current role</span>
          <strong>{{ workspace()?.role ?? 'Loading…' }}</strong>
          <small>Resolved by the API</small>
        </article>
        <article>
          <span>Permissions</span>
          <strong>{{ workspace()?.permissions?.length ?? 0 }}</strong>
          <small>Server-authorized capabilities</small>
        </article>
      </section>

      <section class="panel">
        <h2>Foundation checklist</h2>
        <div class="check"><b>✓</b><span><strong>Angular application shell</strong><small>Responsive navigation and guarded routes</small></span></div>
        <div class="check"><b>✓</b><span><strong>Development authentication</strong><small>Enabled only in Development; production requests remain unauthorized</small></span></div>
        <div class="check"><b>✓</b><span><strong>Tenant membership boundary</strong><small>Business routes resolve active membership before authorization</small></span></div>
        <div class="check"><b>✓</b><span><strong>SQL Server contract</strong><small>Schema, row-level security and API contracts are ready for migration execution</small></span></div>
      </section>
    </main>
  `,
  styles: `
    .heading { display: flex; align-items: start; justify-content: space-between; gap: 24px; }
    .eyebrow { margin: 0 0 8px; color: #087f74; font-size: 12px; font-weight: 800; letter-spacing: .08em; }
    h1 { margin: 0; color: #142d3b; font-size: clamp(28px, 4vw, 38px); }
    .heading p:not(.eyebrow) { color: #5c7180; }
    .status { padding: 9px 12px; border-radius: 999px; color: #196d49; background: #e3f4ef; font-size: 13px; font-weight: 700; }
    .status.error { color: #8c2e2e; background: #ffe8e8; }
    .alert { display: grid; gap: 5px; margin: 22px 0; padding: 16px; border-left: 4px solid #b44; background: #fff1f1; }
    .cards { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 18px; margin: 30px 0; }
    article, .panel { border: 1px solid #dce5ea; border-radius: 12px; background: #fff; }
    article { display: grid; gap: 8px; padding: 24px; }
    article span, article small, .check small { color: #5c7180; }
    article strong { color: #142d3b; font-size: 22px; }
    .panel { padding: 28px; }
    h2 { margin: 0 0 22px; color: #142d3b; }
    .check { display: grid; grid-template-columns: 28px 1fr; gap: 12px; padding: 14px 0; border-top: 1px solid #edf2f5; }
    .check b { color: #087f74; }
    .check span { display: grid; gap: 4px; }
    @media (max-width: 850px) { .cards { grid-template-columns: 1fr; } .heading { display: grid; } }
  `,
})
export class OverviewPage implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);

  readonly user = signal<CurrentUser | null>(null);
  readonly workspace = signal<WorkspaceContext | null>(null);
  readonly status = signal('Checking…');
  readonly error = signal('');

  ngOnInit(): void {
    this.http.get<{ status: string }>('/health/live').subscribe({
      next: () => this.status.set('Connected'),
      error: () => this.status.set('Unavailable'),
    });

    this.http.get<CurrentUser>('/api/v1/me').subscribe({
      next: (user) => this.user.set(user),
      error: () => this.error.set('Sign in again or start the local API on port 5080.'),
    });

    const businessId = this.auth.businessId();
    if (businessId) {
      this.http.get<WorkspaceContext>(`/api/v1/businesses/${businessId}/workspace`).subscribe({
        next: (workspace) => this.workspace.set(workspace),
        error: () => this.error.set('Your business membership could not be verified.'),
      });
    }
  }
}
