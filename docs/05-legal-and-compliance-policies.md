# ServiceDesk — Legal and Compliance Policies

**Document Version**: 1.0.0  
**Effective Date**: September 12, 2026  
**Jurisdiction**: United States (Delaware Law Governing) & Global Multi-Tenant Data Regulations  

---

## 1. Terms of Service (SaaS Agreement)

### 1.1 Acceptance of Terms
By creating a business workspace, signing in, or using the ServiceDesk application ("Service"), you ("Customer" or "Subscriber") agree to be bound by this Master Subscription Agreement.

### 1.2 Multi-Tenant Service & Subscription Plans
1. **Solo vs. Team Subscriptions**: Subscriptions are billed per tenant based on selected plan tiers (`Solo`, `Team`, `Growth`). Plans establish limits on active staff seats, monthly job creation volume, file storage capacity, and module access.
2. **Seat Allocations**: Each individual who accesses the Service must have an assigned user membership. Sharing user credentials between multiple individuals is strictly prohibited.
3. **Billing, Renewals & Grace Periods**: Subscriptions renew automatically at the end of each billing cycle. If a renewal payment fails, a 7-day `PastDue` grace period is provided. Upon grace expiration, workspaces transition to `ReadOnly` mode where data can be viewed and exported, but new records cannot be created.

### 1.3 Cancellation & Termination
Subscribers may cancel their subscription at any time. Cancellation takes effect at the end of the current paid billing cycle (`CancelAtPeriodEnd = true`). ServiceDesk retains customer data for 30 days following workspace termination to allow data export before permanent automated purge.

---

## 2. Privacy Policy & Data Processing

### 2.1 Information Collected
- **Account & Identity Data**: Full name, business trade name, email address, phone number, and authentication tokens.
- **Tenant Business Data**: Customer names, phone numbers, service location addresses, equipment serial numbers, vehicle VINs, work orders, photos, and invoice ledgers.
- **Financial & Payment Metadata**: Transaction IDs, payment amounts, and payment methods. ServiceDesk does not store full credit card numbers; payment tokenization is handled by PCI-DSS Level 1 compliant processors (Stripe).

### 2.2 Use of Data & Non-Disclosure
ServiceDesk will **never** sell, rent, or monetize customer CRM records, work orders, or pricing books to third parties. Customer data is utilized solely to deliver the service, process transactions, generate requested export archives, and provide customer support upon explicit authorized request.

### 2.3 Compliance with Privacy Regulations (CCPA / GDPR)
- **Right to Access & Portability**: Workspace owners can export all tenant data in structured format (JSON/CSV) at any time.
- **Right to Deletion**: Workspace owners may request permanent deletion of their account and associated tenant records upon account closure.

---

## 3. Multi-Tenant Data Protection & Isolation Addendum

### 3.1 Logical Tenant Isolation
ServiceDesk guarantees strict multi-tenant logical database isolation:
- All database records carry a tenant identifier (`BusinessId`).
- Microsoft SQL Server Row-Level Security (RLS) security predicates (`app.fn_TenantFilter`) and connection-level `SESSION_CONTEXT(N'BusinessId')` strictly prevent any tenant from querying, modifying, or reading records of another tenant.
- API endpoints return uniform generic `404 resource_not_found` responses for any attempt to probe foreign tenant IDs, mitigating enumeration vulnerabilities.

### 3.2 Encryption Standards
- **Data in Transit**: All communications are encrypted using Transport Layer Security (TLS 1.3 / TLS 1.2 minimum).
- **Data at Rest**: Database files, transaction logs, and cloud storage assets are encrypted using AES-256 bit encryption.

---

## 4. End-User License Agreement (EULA)

### 4.1 License Grant
Subject to the terms of your active subscription plan, ServiceDesk grants the subscriber a limited, revocable, non-exclusive, non-transferable right to access and use the web and mobile applications for internal business operations.

### 4.2 Prohibited Conduct
Users agree not to:
- Reverse engineer, decompile, or disassemble any part of the ServiceDesk backend or Angular frontend.
- Circumvent or bypass plan entitlement quotas, seat limits, or tenant security boundaries.
- Transmit malicious software, viruses, or illegal materials through job notes or attachments.
- Attempt unauthorized stress testing, scraping, or penetration testing without prior written consent from ServiceDesk platform administration.
