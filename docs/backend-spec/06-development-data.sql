SET XACT_ABORT ON;
BEGIN TRANSACTION;

DECLARE @BusinessId uniqueidentifier = '11111111-1111-1111-1111-111111111111';
DECLARE @UserId uniqueidentifier = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
DECLARE @MemberId uniqueidentifier = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
DECLARE @PlanId uniqueidentifier = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

EXEC sys.sp_set_session_context @key = N'BusinessId', @value = @BusinessId, @read_only = 0;

IF NOT EXISTS (SELECT 1 FROM platform.Plans WHERE Id = @PlanId)
BEGIN
    INSERT platform.Plans
        (Id, Code, Revision, Name, BillingInterval, Price, Currency, IsPublished)
    VALUES
        (@PlanId, N'SOLO', 1, N'Solo', 'Month', 29.00, 'USD', 1);
END;

MERGE platform.PlanEntitlements AS target
USING
(
    VALUES
        (@PlanId, N'staff.seats', 1, CONVERT(bigint, 1), N'1 staff seat'),
        (@PlanId, N'storage.bytes', 1, CONVERT(bigint, 1073741824), N'1 GB storage'),
        (@PlanId, N'jobs.per_period', 1, CONVERT(bigint, 100), N'100 jobs per billing period'),
        (@PlanId, N'estimates.enabled', 1, CONVERT(bigint, NULL), N'Estimates enabled'),
        (@PlanId, N'reports.advanced.enabled', 0, CONVERT(bigint, NULL), N'Advanced reports disabled'),
        (@PlanId, N'exports.enabled', 1, CONVERT(bigint, NULL), N'Data export enabled')
) AS source (PlanId, FeatureCode, Enabled, LimitValue, DisplayText)
ON target.PlanId = source.PlanId AND target.FeatureCode = source.FeatureCode
WHEN MATCHED THEN UPDATE SET
    Enabled = source.Enabled,
    LimitValue = source.LimitValue,
    DisplayText = source.DisplayText
WHEN NOT MATCHED THEN INSERT
    (PlanId, FeatureCode, Enabled, LimitValue, DisplayText)
VALUES
    (source.PlanId, source.FeatureCode, source.Enabled, source.LimitValue, source.DisplayText);

IF NOT EXISTS (SELECT 1 FROM auth.Users WHERE Id = @UserId)
BEGIN
    INSERT auth.Users (Id, Subject, Email, NormalizedEmail, FullName)
    VALUES (@UserId, N'development-owner', N'owner@northstar.local', N'OWNER@NORTHSTAR.LOCAL', N'Alex Johnson');
END;

IF NOT EXISTS (SELECT 1 FROM platform.Businesses WHERE Id = @BusinessId)
BEGIN
    INSERT platform.Businesses (Id, Name, Industry, TimeZone, BillingEmail)
    VALUES (@BusinessId, N'Northstar Services', 'Plumbing', N'America/Chicago', N'owner@northstar.local');
END;

IF NOT EXISTS (SELECT 1 FROM app.Members WHERE BusinessId = @BusinessId AND Id = @MemberId)
BEGIN
    INSERT app.Members (BusinessId, Id, UserId, RoleCode)
    VALUES (@BusinessId, @MemberId, @UserId, N'Owner');
END;

IF NOT EXISTS (SELECT 1 FROM app.Subscriptions WHERE BusinessId = @BusinessId AND IsCurrent = 1)
BEGIN
    INSERT app.Subscriptions
        (BusinessId, PlanId, Status, PeriodStartsAt, PeriodEndsAt, IsCurrent)
    VALUES
        (@BusinessId, @PlanId, 'Active',
         DATEFROMPARTS(YEAR(SYSUTCDATETIME()), MONTH(SYSUTCDATETIME()), 1),
         DATEADD(MONTH, 1, DATEFROMPARTS(YEAR(SYSUTCDATETIME()), MONTH(SYSUTCDATETIME()), 1)), 1);
END;

IF NOT EXISTS (SELECT 1 FROM app.CatalogItems WHERE BusinessId = @BusinessId)
BEGIN
    INSERT app.CatalogItems (BusinessId, ItemType, Name, Unit, UnitCost, UnitPrice, TaxCategory)
    VALUES
        (@BusinessId, 'Service', N'Diagnostic visit', N'visit', 0, 125, NULL),
        (@BusinessId, 'Service', N'Drain cleaning', N'service', 0, 285, NULL),
        (@BusinessId, 'Part', N'Temperature relief valve', N'each', 31.50, 68, N'TX-TAXABLE'),
        (@BusinessId, 'Part', N'Brake pad set', N'set', 72, 139, N'TX-TAXABLE');
END;

COMMIT;
