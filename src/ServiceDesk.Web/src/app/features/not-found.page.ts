import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-not-found',
  imports: [RouterLink],
  template: `
    <main class="not-found-page">
      <div class="not-found-card">
        <span class="badge gray">404</span>
        <h1>Page not found</h1>
        <p>The page you requested doesn't exist, has been removed, or is temporarily unavailable.</p>
        <div class="actions">
          <a class="btn primary" routerLink="/app/overview">Return to Dashboard</a>
          <a class="btn" routerLink="/app/jobs">View Jobs</a>
        </div>
      </div>
    </main>
  `,
  styles: `
    .not-found-page {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      background: var(--bg);
    }
    .not-found-card {
      max-width: 480px;
      width: 100%;
      background: #fff;
      border: 1px solid var(--line);
      border-radius: 16px;
      padding: 40px 32px;
      text-align: center;
      box-shadow: var(--shadow);
    }
    .not-found-card h1 {
      margin: 16px 0 8px;
      font-size: 26px;
      letter-spacing: -0.5px;
    }
    .not-found-card p {
      color: var(--muted);
      margin-bottom: 24px;
      line-height: 1.5;
      font-size: 14px;
    }
    .actions {
      display: flex;
      gap: 12px;
      justify-content: center;
    }
  `
})
export class NotFoundPage {}
