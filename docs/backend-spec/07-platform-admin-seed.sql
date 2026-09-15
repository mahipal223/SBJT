-- Development seed script for platform administrators
-- Grants NO tenant memberships to platform operators.
-- RoleCode IN ('Support', 'BillingAdmin', 'OperationsAdmin')

SET XACT_ABORT ON;
BEGIN TRANSACTION;

DECLARE @OpsAdminId uniqueidentifier = '99999999-9999-9999-9999-999999999999';
DECLARE @BillingAdminId uniqueidentifier = '77777777-7777-7777-7777-777777777777';
DECLARE @SupportAdminId uniqueidentifier = '88888888-8888-8888-8888-888888888888';

-- 1. Seed auth.Users for platform operators
IF NOT EXISTS (SELECT 1 FROM auth.Users WHERE Id = @OpsAdminId)
BEGIN
    INSERT auth.Users (Id, Subject, Email, NormalizedEmail, FullName)
    VALUES (@OpsAdminId, N'dev-platform-superadmin', N'admin@servicedesk.local', N'ADMIN@SERVICEDESK.LOCAL', N'Platform SuperAdmin');
END;

IF NOT EXISTS (SELECT 1 FROM auth.Users WHERE Id = @BillingAdminId)
BEGIN
    INSERT auth.Users (Id, Subject, Email, NormalizedEmail, FullName)
    VALUES (@BillingAdminId, N'dev-platform-billing', N'billing@servicedesk.local', N'BILLING@SERVICEDESK.LOCAL', N'Platform Billing Admin');
END;

IF NOT EXISTS (SELECT 1 FROM auth.Users WHERE Id = @SupportAdminId)
BEGIN
    INSERT auth.Users (Id, Subject, Email, NormalizedEmail, FullName)
    VALUES (@SupportAdminId, N'dev-platform-support', N'support@servicedesk.local', N'SUPPORT@SERVICEDESK.LOCAL', N'Platform Support Agent');
END;

-- 2. Seed platform.Administrators
MERGE platform.Administrators AS target
USING (
    VALUES
        (@OpsAdminId, 'OperationsAdmin', 1),
        (@BillingAdminId, 'BillingAdmin', 1),
        (@SupportAdminId, 'Support', 1)
) AS source (UserId, RoleCode, IsActive)
ON target.UserId = source.UserId
WHEN MATCHED THEN UPDATE SET
    RoleCode = source.RoleCode,
    IsActive = source.IsActive
WHEN NOT MATCHED THEN INSERT
    (UserId, RoleCode, IsActive)
VALUES
    (source.UserId, source.RoleCode, source.IsActive);

COMMIT;
