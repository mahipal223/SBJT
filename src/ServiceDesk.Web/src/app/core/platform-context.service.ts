import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { PlatformAdminApiService, PlatformOperatorResponse } from './platform-admin-api.service';

@Injectable({ providedIn: 'root' })
export class PlatformContextService {
  private readonly api = inject(PlatformAdminApiService);
  private readonly router = inject(Router);

  readonly operator = signal<PlatformOperatorResponse | null>(null);
  readonly isLoading = signal<boolean>(false);
  readonly error = signal<string | null>(null);

  // In development, store operator dev identity in sessionStorage (isolated from tenant storage)
  readonly devAdminId = signal<string | null>(
    sessionStorage.getItem('servicedesk.devPlatformAdminId') ?? '99999999-9999-9999-9999-999999999999'
  );

  readonly isAuthenticated = computed(() => Boolean(this.operator()));
  readonly role = computed(() => this.operator()?.role ?? '');
  readonly fullName = computed(() => this.operator()?.fullName ?? '');
  readonly email = computed(() => this.operator()?.email ?? '');
  readonly permissions = computed(() => this.operator()?.permissions ?? []);

  // Capabilities
  readonly canViewWorkspaces = computed(() => this.hasPermission('platform:Support'));
  readonly canViewPlans = computed(() => this.hasPermission('platform:BillingAdmin'));
  readonly canViewMetrics = computed(() => this.hasPermission('platform:OperationsAdmin'));
  readonly canViewBackups = computed(() => this.hasPermission('platform:OperationsAdmin'));
  readonly canViewAudit = computed(() => this.hasPermission('platform:OperationsAdmin'));
  readonly canManageSmtp = computed(() => this.hasPermission('platform:OperationsAdmin'));

  hasPermission(permission: string): boolean {
    return this.operator()?.permissions?.includes(permission) ?? false;
  }

  async loadCurrentOperator(): Promise<PlatformOperatorResponse | null> {
    this.isLoading.set(true);
    this.error.set(null);

    try {
      const result = await firstValueFrom(this.api.getMe());
      this.operator.set(result);
      this.isLoading.set(false);
      return result;
    } catch (err: any) {
      this.operator.set(null);
      this.isLoading.set(false);
      const detail = err?.error?.detail || err?.message || 'Failed to authenticate platform operator';
      this.error.set(detail);
      return null;
    }
  }

  async switchDevRole(newAdminId: string): Promise<boolean> {
    sessionStorage.setItem('servicedesk.devPlatformAdminId', newAdminId);
    this.devAdminId.set(newAdminId);
    const op = await this.loadCurrentOperator();
    return op !== null;
  }

  exitToTenant(): void {
    this.operator.set(null);
    void this.router.navigate(['/app/overview']);
  }

  logout(): void {
    sessionStorage.removeItem('servicedesk.devPlatformAdminId');
    this.operator.set(null);
    this.devAdminId.set(null);
    void this.router.navigate(['/platform-admin/login']);
  }
}
