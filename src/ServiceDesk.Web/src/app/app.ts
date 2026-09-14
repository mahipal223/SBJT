import { Component, HostListener, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  imports: [RouterOutlet],
  selector: 'app-root',
  template: `<router-outlet /> @if (notice()) { <div class="demo-toast" role="status">{{ notice() }}</div> }`,
})
export class App {
  readonly notice = signal('');
  private noticeTimer?: ReturnType<typeof setTimeout>;

  @HostListener('document:click', ['$event'])
  showPrototypeFeedback(event: MouseEvent): void {
    const button = (event.target as HTMLElement | null)?.closest('button');
    if (!button || button.matches('.menu-button,.close-menu,.scrim,.user-card') || button.textContent?.includes('Continue as demo owner')) return;
    if (!button.closest('app-dashboard,app-schedule,app-reports,app-team,app-subscription,app-settings,app-admin,app-technician') && !button.hasAttribute('data-prototype')) return;
    if (button.matches('.toggle')) button.classList.toggle('on');
    const label = (button.getAttribute('aria-label') || button.getAttribute('title') || button.textContent || 'Action').replace(/\s+/g, ' ').trim();
    this.notice.set(`${label} is ready for API connection.`);
    clearTimeout(this.noticeTimer);
    this.noticeTimer = setTimeout(() => this.notice.set(''), 2200);
  }
}
