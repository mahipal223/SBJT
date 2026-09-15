import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface PlatformOperatorResponse {
  id: string;
  fullName: string;
  email: string;
  role: string;
  permissions: string[];
}

export interface PlatformBusinessSummaryResponse {
  id: string;
  name: string;
  industry: string;
  status: string;
  timeZone: string;
  currency: string;
  billingEmail: string;
  createdAt: string;
  planCode?: string;
  planName?: string;
  planPrice?: number;
  memberCount: number;
  subscriptionStatus?: string;
}

export interface PlatformPlanDistributionItem {
  planName: string;
  businessCount: number;
  percentage: number;
}

export interface PlatformIndustryDistributionItem {
  industry: string;
  businessCount: number;
  percentage: number;
}

export interface PlatformMetricsResponse {
  totalBusinesses: number;
  activeBusinesses: number;
  suspendedBusinesses: number;
  trialBusinesses: number;
  monthlyRecurringRevenue: number;
  trialConversionRate: number;
  serviceHealthPercentage: number;
  systemStatus: string;
  planDistribution: PlatformPlanDistributionItem[];
  industryDistribution: PlatformIndustryDistributionItem[];
}

export interface PlatformPlanEntitlementRow {
  featureCode: string;
  enabled: boolean;
  limitValue?: number;
  displayText: string;
}

export interface PlatformPlanDetailResponse {
  id: string;
  code: string;
  revision: number;
  name: string;
  billingInterval: string;
  price: number;
  currency: string;
  isPublished: boolean;
  entitlements: PlatformPlanEntitlementRow[];
}

export interface CreatePlatformPlanRequest {
  code: string;
  name: string;
  billingInterval: string;
  price: number;
  currency: string;
  isPublished: boolean;
  entitlements: PlatformPlanEntitlementRow[];
}

export interface BackupRunResponse {
  id: string;
  providerReference: string;
  status: string;
  startedAt: string;
  completedAt?: string;
}

export interface RestoreRunResponse {
  id: string;
  backupRunId: string;
  requestedByUserId: string;
  targetEnvironment: string;
  status: string;
  startedAt: string;
  completedAt?: string;
}

export interface CreateRestoreRequest {
  backupRunId: string;
  targetEnvironment: string;
}

export interface PlatformAdminAuditEventResponse {
  id: string;
  actorUserId: string;
  businessId?: string;
  businessName?: string;
  action: string;
  details?: string;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class PlatformAdminApiService {
  private readonly http = inject(HttpClient);
  private readonly apiBase = '/api/v1/admin';

  getMe(): Observable<PlatformOperatorResponse> {
    return this.http.get<PlatformOperatorResponse>(`${this.apiBase}/me`);
  }

  getBusinesses(
    search?: string,
    status?: string,
    page = 1,
    pageSize = 25
  ): Observable<PlatformBusinessSummaryResponse[]> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('pageSize', pageSize.toString());

    if (search?.trim()) {
      params = params.set('search', search.trim());
    }
    if (status?.trim()) {
      params = params.set('status', status.trim());
    }

    return this.http.get<PlatformBusinessSummaryResponse[]>(`${this.apiBase}/businesses`, { params });
  }

  getBusiness(businessId: string): Observable<PlatformBusinessSummaryResponse> {
    return this.http.get<PlatformBusinessSummaryResponse>(`${this.apiBase}/businesses/${businessId}`);
  }

  updateBusinessStatus(
    businessId: string,
    status: string,
    reason: string
  ): Observable<void> {
    return this.http.patch<void>(`${this.apiBase}/businesses/${businessId}/status`, {
      status,
      reason,
    });
  }

  getMetrics(): Observable<PlatformMetricsResponse> {
    return this.http.get<PlatformMetricsResponse>(`${this.apiBase}/metrics`);
  }

  getPlans(): Observable<PlatformPlanDetailResponse[]> {
    return this.http.get<PlatformPlanDetailResponse[]>(`${this.apiBase}/plans`);
  }

  createPlan(request: CreatePlatformPlanRequest): Observable<PlatformPlanDetailResponse> {
    return this.http.post<PlatformPlanDetailResponse>(`${this.apiBase}/plans`, request);
  }

  getBackupRuns(limit = 20): Observable<BackupRunResponse[]> {
    const params = new HttpParams().set('limit', limit.toString());
    return this.http.get<BackupRunResponse[]>(`${this.apiBase}/backups`, { params });
  }

  createRestoreRun(request: CreateRestoreRequest): Observable<RestoreRunResponse> {
    return this.http.post<RestoreRunResponse>(`${this.apiBase}/restores`, request);
  }

  getRestoreRun(restoreId: string): Observable<RestoreRunResponse> {
    return this.http.get<RestoreRunResponse>(`${this.apiBase}/restores/${restoreId}`);
  }

  getAdminAuditEvents(limit = 50): Observable<PlatformAdminAuditEventResponse[]> {
    const params = new HttpParams().set('limit', limit.toString());
    return this.http.get<PlatformAdminAuditEventResponse[]>(`${this.apiBase}/audit-events`, { params });
  }
}
