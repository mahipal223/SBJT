# ADR-0001: Multi-Provider Authentication, Email OTP & Platform Admin Password Policy

**Date**: 2026-09-19  
**Status**: accepted  
**Deciders**: Engineering Team  

## Context

Initial authentication was scaffolded using Auth0 redirects, which caused disruptive external redirects when users registered or logged in. Additionally, business requirements demanded:
1. Direct in-app email and password authentication with email OTP (one-time password) verification on signup.
2. Direct Google OAuth ("Sign in with Google") in-app without third-party redirects.
3. Extensible multi-platform account linking so **Sign in with Apple** (and future providers like Microsoft or SAML) can be connected seamlessly with zero database alterations in the future.
4. Centralized password policy management controlled by Platform Administrators, including brute-force lockout protection and immutable security audit logs.

## Decision

We transitioned from Auth0 redirects to a native, enterprise-grade multi-provider authentication and security system:

1. **Multi-Provider Account Architecture**:
   - `auth.Users`: Retains master user profile, password hash/salt (PBKDF2 HMAC-SHA512), email verification state, and brute-force lockout counters (`AccessFailedCount`, `LockoutEnd`).
   - `auth.UserIdentities`: Maps external identity providers (`Provider`, `ProviderSubject`, `ProviderEmail`, `LinkedAt`, `LastSignInAt`) with a composite unique key `(Provider, ProviderSubject)`. Adding Apple or another provider requires zero schema migrations.

2. **Email OTP Verification on Signup**:
   - `auth.EmailVerifications`: Stores cryptographically random 6-digit verification codes hashed with SHA-256 (`TokenHash binary(32)`), valid for 10 minutes with rate limiting and a maximum of 5 attempts.

3. **Platform-Admin-Managed Password Policy**:
   - `platform.PasswordPolicies`: Managed by platform operators with `Permissions.PlatformOperationsAdmin` via `/api/v1/admin/security/password-policy`.
   - Enforces configurable rules (minimum length, uppercase, lowercase, numbers, special characters, max failed attempts, lockout duration).
   - Records immutable audit trails to `platform.AdminAuditEvents` on every update.

4. **Native JWT Token Issuance**:
   - The API issues standard symmetric JWT Bearer tokens containing `sub = userId` (GUID).
   - 100% compatible with existing `TenantResolutionMiddleware` and `PermissionAuthorizationHandler`.

5. **In-App Frontend Experience**:
   - Replaced Auth0 redirects in `login.page.ts` with responsive in-app signup, login, live password checklist, 6-digit OTP modal, and Google/Apple buttons.

## Consequences

### Positive
- **User Experience**: Signup and signin occur 100% in-app on `localhost:4200` with zero external page jumps.
- **Future-Proof**: Sign in with Apple and other social/enterprise identity providers plug in directly via `auth.UserIdentities`.
- **Enhanced Security**: Protection against automated bot signups via email OTP and brute-force attacks via account lockout.
- **Admin Control**: Platform operations can adjust password complexity and lockout thresholds without redeploying code.

### Trade-offs & Mitigations
- **Responsibility for Credential Security**: Storing passwords internally requires rigorous cryptographic practices. Mitigated by using 100,000-iteration PBKDF2 HMAC-SHA512 with per-user 128-bit salts and timing-safe comparison (`CryptographicOperations.FixedTimeEquals`).
