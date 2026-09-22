import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { AuthService } from './auth.service';

export interface PageResult<T> { items: T[]; total: number; page: number; pageSize: number; }
export interface Customer {
  id: string; name: string; companyName?: string; email?: string; phone: string;
  customerType: string; addressLine1: string; city: string; stateCode: string;
  postalCode: string; isArchived: boolean; createdAt: string;
}
export interface CreateCustomer {
  name: string; companyName?: string; email?: string; phone: string; customerType: string;
  addressLine1: string; city: string; stateCode: string; postalCode: string;
}
export interface Job {
  id: string; customerId: string; jobNumber: string; title: string; description?: string;
  status: string; priority: string; scheduledDate?: string; arrivalWindow?: string;
  assignedMemberId?: string; total: number; createdAt: string;
}
export interface CreateJob {
  customerId: string; title: string; description?: string; priority: string;
  scheduledDate?: string; arrivalWindow?: string; assignedMemberId?: string;
}
export interface CatalogItem { id: string; itemType: string; name: string; unit: string; unitCost: number; unitPrice: number; taxCategory?: string; isArchived: boolean; }
export interface JobItem { id?: string; catalogItemId?: string; itemType: string; description: string; quantity: number; unit: string; unitPrice: number; discountAmount: number; taxAmount: number; sortOrder?: number; lineTotal?: number; }
export interface JobItemSet { items: JobItem[]; subtotal: number; discountTotal: number; taxTotal: number; total: number; }
export interface FinancialLine { id: string; itemType: string; description: string; quantity: number; unit: string; unitPrice: number; discountAmount: number; taxAmount: number; sortOrder: number; lineTotal: number; }
export interface Estimate { id: string; jobId: string; estimateNumber: string; revision: number; status: string; validUntil: string; customerName: string; subtotal: number; discountTotal: number; taxTotal: number; total: number; sentAt?: string; createdAt: string; items: FinancialLine[]; }
export interface Invoice { id: string; jobId: string; customerId: string; invoiceNumber: string; customerName: string; status: string; deliveryStatus: string; issuedOn?: string; dueOn?: string; subtotal: number; discountTotal: number; taxTotal: number; total: number; balance: number; paymentStatus: string; isOverdue: boolean; createdAt: string; items: FinancialLine[]; }
export interface PublicEstimateLink { token: string; expiresAt: string; }
export interface PublicEstimate { estimateId: string; businessName: string; customerName: string; estimateNumber: string; revision: number; status: string; validUntil: string; subtotal: number; discountTotal: number; taxTotal: number; total: number; decision?: string; decidedAt?: string; items: FinancialLine[]; }
export interface EstimateDecision { id: string; estimateId: string; decision: string; approverName: string; approverEmail: string; decidedAt: string; }

export interface SmtpSettings {
  host: string;
  port: number;
  username: string;
  maskedPassword?: string;
  fromEmail: string;
  fromName: string;
  enableSsl: boolean;
  isEnabled: boolean;
}
export interface SaveSmtpSettings {
  host: string;
  port: number;
  username: string;
  password?: string;
  fromEmail: string;
  fromName: string;
  enableSsl: boolean;
  isEnabled: boolean;
}
export interface TestSmtpResult {
  success: boolean;
  message: string;
}

export interface PlanEntitlement {
  featureCode: string;
  enabled: boolean;
  limitValue?: number;
  displayText: string;
}

export interface SubscriptionPlan {
  id: string;
  code: string;
  name: string;
  billingInterval: string;
  price: number;
  currency: string;
  isPublished: boolean;
  entitlements: PlanEntitlement[];
}

export interface SubscriptionDetail {
  id: string;
  businessId: string;
  planId: string;
  planCode: string;
  planName: string;
  price: number;
  billingInterval: string;
  status: string;
  trialEndsAt?: string;
  periodStartsAt: string;
  periodEndsAt: string;
  graceEndsAt?: string;
  cancelAtPeriodEnd: boolean;
  isCurrent: boolean;
  isReadOnly: boolean;
}

export interface UsageQuota {
  featureCode: string;
  name: string;
  currentUsage: number;
  limitValue?: number;
  unit: string;
  percentageUsed: number;
  isExceeded: boolean;
  description: string;
}

export interface SubscriptionOverview {
  subscription: SubscriptionDetail;
  availablePlans: SubscriptionPlan[];
  usage: UsageQuota[];
}

export interface ChangePlanResult {
  success: boolean;
  message: string;
  subscription?: SubscriptionDetail;
  blockers: string[];
}

export interface TodayJobItem {
  id: string;
  jobNumber: string;
  title: string;
  customerName: string;
  status: string;
  priority: string;
  scheduledStartAt?: string;
  assignedMemberName?: string;
}

export interface NeedsAttentionItem {
  type: string;
  severity: string;
  title: string;
  description: string;
  actionUrl?: string;
}

export interface DashboardSummary {
  jobsTodayCount: number;
  jobsCompletedTodayCount: number;
  jobsRemainingTodayCount: number;
  openEstimatesCount: number;
  openEstimatesValue: number;
  outstandingInvoicesCount: number;
  outstandingInvoicesValue: number;
  revenueThisMonth: number;
  revenueLastMonth: number;
  todaySchedule: TodayJobItem[];
  attentionItems: NeedsAttentionItem[];
}

export interface MonthlyTrend {
  monthLabel: string;
  revenue: number;
  jobsCount: number;
}

export interface CategoryBreakdown {
  categoryName: string;
  totalRevenue: number;
  percentage: number;
  itemCount: number;
}

export interface TechnicianPerformance {
  memberName: string;
  jobsCompleted: number;
  totalRevenue: number;
}

export interface InvoiceAging {
  current: number;
  days1To30: number;
  days31To60: number;
  days60Plus: number;
}

export interface BusinessReport {
  periodStart: string;
  periodEnd: string;
  totalRevenue: number;
  revenueGrowthPercent: number;
  jobsCompletedCount: number;
  averageJobValue: number;
  newCustomersCount: number;
  monthlyTrends: MonthlyTrend[];
  categoryBreakdown: CategoryBreakdown[];
  technicianPerformance: TechnicianPerformance[];
  invoiceAging: InvoiceAging;
}

export interface ExportRequest {
  id: string;
  businessId: string;
  requestedByMemberId: string;
  exportType: string;
  status: string;
  storageKey?: string;
  createdAt: string;
  expiresAt?: string;
}

export interface AuditEvent {
  id: string;
  actorUserId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  changes?: string;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class WorkApiService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private get root(): string { return `/api/v1/businesses/${this.auth.businessId()}`; }

  customers(search = '') { return this.http.get<PageResult<Customer>>(`${this.root}/customers`, { params: new HttpParams().set('search', search) }); }
  customer(id: string) { return this.http.get<Customer>(`${this.root}/customers/${id}`); }
  createCustomer(command: CreateCustomer) { return this.http.post<Customer>(`${this.root}/customers`, command); }
  jobs(search = '', status = '', pageSize = 25) {
    let params = new HttpParams().set('search', search).set('pageSize', pageSize);
    if (status) params = params.set('status', status);
    return this.http.get<PageResult<Job>>(`${this.root}/jobs`, { params });
  }
  job(id: string) { return this.http.get<Job>(`${this.root}/jobs/${id}`); }
  createJob(command: CreateJob) { return this.http.post<Job>(`${this.root}/jobs`, command); }
  catalog(search = '', itemType = '') {
    let params = new HttpParams().set('search', search);
    if (itemType) params = params.set('itemType', itemType);
    return this.http.get<PageResult<CatalogItem>>(`${this.root}/catalog-items`, { params });
  }
  createCatalogItem(command: Omit<CatalogItem, 'id'|'isArchived'>) { return this.http.post<CatalogItem>(`${this.root}/catalog-items`, command); }
  jobItems(jobId: string) { return this.http.get<JobItemSet>(`${this.root}/jobs/${jobId}/items`); }
  replaceJobItems(jobId: string, items: JobItem[]) { return this.http.put<JobItemSet>(`${this.root}/jobs/${jobId}/items`, items); }
  changeJobStatus(jobId: string, status: string, reason?: string) { return this.http.post<Job>(`${this.root}/jobs/${jobId}/status`, { status, reason }); }
  scheduleJob(jobId: string, command: { scheduledDate: string; arrivalWindow?: string; assignedMemberId?: string }) { return this.http.post<Job>(`${this.root}/jobs/${jobId}/schedule`, command); }
  estimates(status = '') { return this.http.get<Estimate[]>(`${this.root}/estimates`, { params: status ? new HttpParams().set('status', status) : undefined }); }
  estimate(estimateId: string) { return this.http.get<Estimate>(`${this.root}/estimates/${estimateId}`); }
  createEstimate(jobId: string, validUntil: string) { return this.http.post<Estimate>(`${this.root}/jobs/${jobId}/estimates`, { validUntil }); }
  sendEstimate(estimateId: string) { return this.http.post<Estimate>(`${this.root}/estimates/${estimateId}/send`, {}); }
  reviseEstimate(estimateId: string, validUntil: string) { return this.http.post<Estimate>(`${this.root}/estimates/${estimateId}/revise`, { validUntil }); }
  createPublicEstimateLink(estimateId: string) { return this.http.post<PublicEstimateLink>(`${this.root}/estimates/${estimateId}/public-link`, {}); }
  publicEstimate(token: string) { return this.http.get<PublicEstimate>(`/api/v1/public/estimates/${encodeURIComponent(token)}`); }
  decidePublicEstimate(token: string, decision: string, approverName: string, approverEmail: string) { return this.http.post<EstimateDecision>(`/api/v1/public/estimates/${encodeURIComponent(token)}/decision`, { decision, approverName, approverEmail }); }
  decideEstimate(estimateId: string, decision: 'Approved' | 'Declined', approverName?: string, approverEmail?: string) { return this.http.post<EstimateDecision>(`${this.root}/estimates/${estimateId}/decision`, { decision, approverName, approverEmail }); }
  invoices(status = '') { return this.http.get<Invoice[]>(`${this.root}/invoices`, { params: status ? new HttpParams().set('status', status) : undefined }); }
  invoice(invoiceId: string) { return this.http.get<Invoice>(`${this.root}/invoices/${invoiceId}`); }
  createInvoice(jobId: string) { return this.http.post<Invoice>(`${this.root}/jobs/${jobId}/invoices`, {}); }
  issueInvoice(invoiceId: string, issuedOn: string, dueOn: string) { return this.http.post<Invoice>(`${this.root}/invoices/${invoiceId}/issue`, { issuedOn, dueOn }); }
  recordPayment(invoiceId: string, amount: number, method = 'Cash', externalReference?: string) { return this.http.post(`${this.root}/invoices/${invoiceId}/payments`, { amount, method, externalReference }); }
  getSmtpSettings() { return this.http.get<SmtpSettings>(`${this.root}/settings/smtp`); }
  saveSmtpSettings(command: SaveSmtpSettings) { return this.http.put<SmtpSettings>(`${this.root}/settings/smtp`, command); }
  testSmtpSettings(targetEmail: string) { return this.http.post<TestSmtpResult>(`${this.root}/settings/smtp/test`, { targetEmail }); }
  downloadInvoicePdf(invoiceId: string, invoiceNumber: string) {
    const num = (invoiceNumber || '').replace(/^#+/, '').trim();
    const fileName = `Invoice-${num || 'document'}.pdf`;
    this.http.get(`${this.root}/invoices/${invoiceId}/pdf`, { responseType: 'blob' }).subscribe({
      next: blob => {
        const file = new Blob([blob], { type: 'application/pdf' });
        const url = window.URL.createObjectURL(file);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
        }, 3000);
      }
    });
  }
  downloadEstimatePdf(estimateId: string, estimateNumber: string) {
    const num = (estimateNumber || '').replace(/^#+/, '').trim();
    const fileName = `Estimate-${num || 'document'}.pdf`;
    this.http.get(`${this.root}/estimates/${estimateId}/pdf`, { responseType: 'blob' }).subscribe({
      next: blob => {
        const file = new Blob([blob], { type: 'application/pdf' });
        const url = window.URL.createObjectURL(file);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
        }, 3000);
      }
    });
  }
  getSubscriptionOverview() {
    return this.http.get<SubscriptionOverview>(`${this.root}/subscription`);
  }
  getPublishedPlans() {
    return this.http.get<SubscriptionPlan[]>(`${this.root}/subscription/plans`);
  }
  changePlan(targetPlanId: string) {
    return this.http.post<ChangePlanResult>(`${this.root}/subscription/change-plan`, { targetPlanId });
  }
  simulateBillingEvent(eventType: string) {
    return this.http.post<SubscriptionDetail>(`${this.root}/subscription/simulate-event`, { eventType });
  }
  getDashboardSummary() {
    return this.http.get<DashboardSummary>(`${this.root}/dashboard/summary`);
  }
  getBusinessReport(fromDate?: string, toDate?: string) {
    let params = new HttpParams();
    if (fromDate) params = params.set('fromDate', fromDate);
    if (toDate) params = params.set('toDate', toDate);
    return this.http.get<BusinessReport>(`${this.root}/reports/summary`, { params });
  }
  listExports() {
    return this.http.get<ExportRequest[]>(`${this.root}/exports`);
  }
  createExport(exportType: string) {
    return this.http.post<ExportRequest>(`${this.root}/exports`, { exportType });
  }
  downloadExport(exportId: string, fileName = 'export.csv') {
    this.http.get(`${this.root}/exports/${exportId}/download`, { responseType: 'blob' }).subscribe({
      next: blob => {
        const file = new Blob([blob], { type: 'text/csv;charset=utf-8;' });
        const url = window.URL.createObjectURL(file);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
        }, 3000);
      }
    });
  }
  listAuditEvents(limit = 50) {
    return this.http.get<AuditEvent[]>(`${this.root}/audit-events`, { params: new HttpParams().set('limit', limit) });
  }
}
