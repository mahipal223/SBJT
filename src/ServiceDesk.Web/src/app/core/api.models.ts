export interface MembershipSummary {
  businessId: string;
  businessName: string;
  memberId: string;
  role: string;
  status: string;
}

export interface CurrentUser {
  id: string;
  email: string;
  fullName: string;
  memberships: MembershipSummary[];
}

export interface WorkspaceContext {
  businessId: string;
  businessName: string;
  memberId: string;
  userId: string;
  role: string;
  permissions: string[];
  business: BusinessProfile;
}

export interface BusinessProfile {
  id: string;
  name: string;
  industry: string;
  status: string;
  timeZone: string;
  currency: string;
  billingEmail: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  soloMode: boolean;
  createdAt: string;
}
