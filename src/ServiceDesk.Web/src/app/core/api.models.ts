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
  memberId: string;
  role: string;
  permissions: string[];
}
