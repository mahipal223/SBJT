using System.Data;
using System.Net.Mail;
using System.Security.Cryptography;
using System.Text;
using Microsoft.Data.SqlClient;
using ServiceDesk.Application.Abstractions;
using ServiceDesk.Application.Financials;
using ServiceDesk.Infrastructure.Data;
using ServiceDesk.Infrastructure.Documents;
using ServiceDesk.Infrastructure.Notifications;

namespace ServiceDesk.Infrastructure.Services;

public sealed class FinancialService(
    BaseDAL baseDAL,
    ITenantContextAccessor tenantContext,
    IEmailSender emailSender) : IFinancialService
{
    public async Task<IReadOnlyList<EstimateRecord>> ListEstimatesAsync(
        Guid businessId,
        string? status,
        CancellationToken cancellationToken = default)
    {
        const string sql = """
            SELECT e.Id, e.BusinessId, e.JobId, e.EstimateNumber, e.Revision, e.Status,
                   e.ValidUntil, c.Name, e.Subtotal, e.DiscountTotal, e.TaxTotal, e.Total,
                   e.SentAt, e.CreatedAt
            FROM app.Estimates AS e
            INNER JOIN app.Jobs AS j ON j.BusinessId = e.BusinessId AND j.Id = e.JobId
            INNER JOIN app.Customers AS c ON c.BusinessId = j.BusinessId AND c.Id = j.CustomerId
            WHERE e.BusinessId = @BusinessId AND (@Status IS NULL OR e.Status = @Status)
            ORDER BY e.CreatedAt DESC;
            """;
        var headers = await baseDAL.ExecuteQueryAsync(
            businessId,
            "Estimates.List",
            sql,
            ReadEstimateHeader,
            [UniqueIdentifier("@BusinessId", businessId), VarChar("@Status", NullIfWhiteSpace(status), 32)],
            cancellationToken);

        var results = new List<EstimateRecord>(headers.Count);
        foreach (var header in headers)
        {
            results.Add(header with { Items = await ReadEstimateItemsAsync(businessId, header.Id, cancellationToken).ConfigureAwait(false) });
        }

        return results;
    }

    public async Task<EstimateRecord> CreateEstimateAsync(
        Guid businessId,
        Guid jobId,
        CreateEstimateCommand command,
        CancellationToken cancellationToken = default)
    {
        if (command.ValidUntil < DateOnly.FromDateTime(DateTime.UtcNow))
        {
            throw new FinancialRuleException("validation_failed", "The estimate expiration date cannot be in the past.");
        }

        var actor = RequireTenantContext();
        var estimateId = Guid.NewGuid();
        const string sql = """
            IF NOT EXISTS
            (
                SELECT 1
                FROM app.Subscriptions AS s
                INNER JOIN platform.PlanEntitlements AS pe ON pe.PlanId = s.PlanId
                WHERE s.BusinessId = @BusinessId AND s.IsCurrent = 1
                  AND s.Status IN ('Trialing', 'Active', 'PastDue')
                  AND pe.FeatureCode = N'estimates.enabled' AND pe.Enabled = 1
            )
                THROW 51030, 'feature_not_available', 1;

            IF NOT EXISTS (SELECT 1 FROM app.Jobs WHERE BusinessId = @BusinessId AND Id = @JobId)
                THROW 51031, 'job_not_found', 1;

            IF NOT EXISTS (SELECT 1 FROM app.JobItems WHERE BusinessId = @BusinessId AND JobId = @JobId)
                THROW 51032, 'job_items_required', 1;

            DECLARE @Next bigint;
            SELECT @Next = NextValue
            FROM app.NumberSequences WITH (UPDLOCK, HOLDLOCK)
            WHERE BusinessId = @BusinessId AND DocumentType = N'Estimate';
            IF @Next IS NULL
            BEGIN
                SET @Next = 1;
                INSERT app.NumberSequences (BusinessId, DocumentType, NextValue, Prefix)
                VALUES (@BusinessId, N'Estimate', 2, N'EST-');
            END
            ELSE
                UPDATE app.NumberSequences SET NextValue = NextValue + 1, UpdatedAt = SYSUTCDATETIME()
                WHERE BusinessId = @BusinessId AND DocumentType = N'Estimate';

            DECLARE @Subtotal decimal(19,2), @Discount decimal(19,2), @Tax decimal(19,2), @Total decimal(19,2);
            SELECT @Subtotal = SUM(CONVERT(decimal(19,2), ROUND(Quantity * UnitPrice, 2))),
                   @Discount = SUM(DiscountAmount), @Tax = SUM(TaxAmount), @Total = SUM(LineTotal)
            FROM app.JobItems WHERE BusinessId = @BusinessId AND JobId = @JobId;

            DECLARE @CustomerSnapshot nvarchar(max) =
            (
                SELECT 1 AS schemaVersion, c.Id AS customerId, c.Name, c.CompanyName, c.Email, c.Phone,
                       l.AddressLine1, l.City, l.StateCode, l.PostalCode, l.CountryCode
                FROM app.Jobs AS j
                INNER JOIN app.Customers AS c ON c.BusinessId = j.BusinessId AND c.Id = j.CustomerId
                OUTER APPLY
                (
                    SELECT TOP (1) AddressLine1, City, StateCode, PostalCode, CountryCode
                    FROM app.Locations AS l
                    WHERE l.BusinessId = c.BusinessId AND l.CustomerId = c.Id AND l.ArchivedAt IS NULL
                    ORDER BY l.CreatedAt
                ) AS l
                WHERE j.BusinessId = @BusinessId AND j.Id = @JobId
                FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
            );

            INSERT app.Estimates
                (BusinessId, Id, JobId, EstimateNumber, Revision, Status, ValidUntil,
                 Subtotal, DiscountTotal, TaxTotal, Total, CustomerSnapshot)
            VALUES
                (@BusinessId, @EstimateId, @JobId,
                 N'EST-' + RIGHT(N'0000' + CONVERT(nvarchar(20), @Next), 4), 1, 'Draft', @ValidUntil,
                 @Subtotal, @Discount, @Tax, @Total, @CustomerSnapshot);

            INSERT app.EstimateItems
                (BusinessId, EstimateId, ItemType, Description, Quantity, Unit, UnitPrice,
                 DiscountAmount, TaxAmount, SortOrder)
            SELECT BusinessId, @EstimateId, ItemType, Description, Quantity, Unit, UnitPrice,
                   DiscountAmount, TaxAmount, SortOrder
            FROM app.JobItems
            WHERE BusinessId = @BusinessId AND JobId = @JobId;

            INSERT app.AuditEvents
                (BusinessId, ActorUserId, Action, EntityType, EntityId, CorrelationId, Changes)
            VALUES
                (@BusinessId, @UserId, N'estimate.created', N'Estimate', @EstimateId,
                 CONVERT(nvarchar(100), NEWID()), N'{"status":"Draft"}');
            """;

        try
        {
            await baseDAL.ExecuteInTransactionAsync(
                businessId,
                "Estimates.Create",
                async (connection, transaction, token) =>
                {
                    await using var sqlCommand = BaseDAL.BuildCommand(connection, transaction, sql, parameters:
                    [
                        UniqueIdentifier("@BusinessId", businessId),
                        UniqueIdentifier("@JobId", jobId),
                        UniqueIdentifier("@EstimateId", estimateId),
                        UniqueIdentifier("@UserId", actor.UserId),
                        Date("@ValidUntil", command.ValidUntil)
                    ]);
                    await sqlCommand.ExecuteNonQueryAsync(token).ConfigureAwait(false);
                    return true;
                },
                IsolationLevel.Serializable,
                cancellationToken);
        }
        catch (DataAccessException exception) when (SqlNumber(exception) == 51030)
        {
            throw new FinancialRuleException("feature_not_available", "Your subscription does not include estimates.");
        }
        catch (DataAccessException exception) when (SqlNumber(exception) == 51031)
        {
            throw new FinancialRuleException("resource_not_found", "The requested job was not found.");
        }
        catch (DataAccessException exception) when (SqlNumber(exception) == 51032)
        {
            throw new FinancialRuleException("job_items_required", "Add services or parts to the job before creating an estimate.");
        }

        return await GetEstimateAsync(businessId, estimateId, cancellationToken).ConfigureAwait(false);
    }

    public async Task<EstimateRecord> SendEstimateAsync(
        Guid businessId,
        Guid estimateId,
        CancellationToken cancellationToken = default)
    {
        var actor = RequireTenantContext();
        await baseDAL.ExecuteInTransactionAsync(
            businessId,
            "Estimates.Send",
            async (connection, transaction, token) =>
            {
                const string selectSql = """
                    SELECT e.Status, e.ValidUntil,
                           (SELECT COUNT(*) FROM app.EstimateItems AS i WHERE i.BusinessId = e.BusinessId AND i.EstimateId = e.Id)
                    FROM app.Estimates AS e WITH (UPDLOCK, HOLDLOCK)
                    WHERE e.BusinessId = @BusinessId AND e.Id = @EstimateId;
                    """;
                string status;
                DateOnly validUntil;
                int itemCount;
                await using (var select = BaseDAL.BuildCommand(connection, transaction, selectSql, parameters:
                [UniqueIdentifier("@BusinessId", businessId), UniqueIdentifier("@EstimateId", estimateId)]))
                await using (var reader = await select.ExecuteReaderAsync(token).ConfigureAwait(false))
                {
                    if (!await reader.ReadAsync(token).ConfigureAwait(false))
                    {
                        throw new FinancialRuleException("resource_not_found", "The estimate was not found.");
                    }

                    status = reader.GetString(0);
                    validUntil = DateOnly.FromDateTime(reader.GetDateTime(1));
                    itemCount = reader.GetInt32(2);
                }

                if (status != "Draft") throw new FinancialRuleException("invalid_transition", "Only a draft estimate can be sent.");
                if (validUntil < DateOnly.FromDateTime(DateTime.UtcNow)) throw new FinancialRuleException("estimate_expired", "The estimate expiration date has passed.");
                if (itemCount == 0) throw new FinancialRuleException("estimate_items_required", "An estimate requires at least one item.");

                const string updateSql = """
                    UPDATE e
                    SET Status = 'Sent', SentAt = SYSUTCDATETIME(), UpdatedAt = SYSUTCDATETIME(),
                        Subtotal = totals.Subtotal, DiscountTotal = totals.DiscountTotal,
                        TaxTotal = totals.TaxTotal, Total = totals.Total
                    FROM app.Estimates AS e
                    CROSS APPLY
                    (
                        SELECT SUM(CONVERT(decimal(19,2), ROUND(i.Quantity * i.UnitPrice, 2))) AS Subtotal,
                               SUM(i.DiscountAmount) AS DiscountTotal, SUM(i.TaxAmount) AS TaxTotal,
                               SUM(i.LineTotal) AS Total
                        FROM app.EstimateItems AS i
                        WHERE i.BusinessId = e.BusinessId AND i.EstimateId = e.Id
                    ) AS totals
                    WHERE e.BusinessId = @BusinessId AND e.Id = @EstimateId;

                    INSERT app.OutboxMessages
                        (BusinessId, EventType, Payload, NextAttemptAt)
                    VALUES
                        (@BusinessId, N'estimate.sent',
                         (
                             SELECT @EstimateId AS estimateId,
                                    e.EstimateNumber AS estimateNumber,
                                    c.Name AS customerName,
                                    c.Email AS recipientEmail,
                                    N'Estimate #' + e.EstimateNumber + N' from ' + b.Name AS subject,
                                    N'<p>Hello ' + c.Name + N',</p><p>Please review estimate #' + e.EstimateNumber + N' for total $' + CONVERT(nvarchar(30), e.Total) + N'.</p>' AS body
                             FROM app.Estimates AS e
                             INNER JOIN app.Jobs AS j ON j.BusinessId = e.BusinessId AND j.Id = e.JobId
                             INNER JOIN app.Customers AS c ON c.BusinessId = j.BusinessId AND c.Id = j.CustomerId
                             INNER JOIN platform.Businesses AS b ON b.Id = e.BusinessId
                             WHERE e.BusinessId = @BusinessId AND e.Id = @EstimateId
                             FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
                         ),
                         SYSUTCDATETIME());

                    INSERT app.AuditEvents
                        (BusinessId, ActorUserId, Action, EntityType, EntityId, CorrelationId, Changes)
                    VALUES
                        (@BusinessId, @UserId, N'estimate.sent', N'Estimate', @EstimateId,
                         CONVERT(nvarchar(100), NEWID()), N'{"status":"Sent"}');
                    """;
                await using var update = BaseDAL.BuildCommand(connection, transaction, updateSql, parameters:
                [
                    UniqueIdentifier("@BusinessId", businessId),
                    UniqueIdentifier("@EstimateId", estimateId),
                    UniqueIdentifier("@UserId", actor.UserId)
                ]);
                await update.ExecuteNonQueryAsync(token).ConfigureAwait(false);
                return true;
            },
            IsolationLevel.Serializable,
            cancellationToken);

        return await GetEstimateAsync(businessId, estimateId, cancellationToken).ConfigureAwait(false);
    }

    public async Task<EstimateRecord> ReviseEstimateAsync(
        Guid businessId,
        Guid estimateId,
        ReviseEstimateCommand command,
        CancellationToken cancellationToken = default)
    {
        if (command.ValidUntil < DateOnly.FromDateTime(DateTime.UtcNow))
        {
            throw new FinancialRuleException("validation_failed", "The estimate expiration date cannot be in the past.");
        }

        var actor = RequireTenantContext();
        var revisionId = Guid.NewGuid();
        const string sql = """
            DECLARE @JobId uniqueidentifier, @EstimateNumber nvarchar(40), @Status varchar(32);
            SELECT @JobId = JobId, @EstimateNumber = EstimateNumber, @Status = Status
            FROM app.Estimates WITH (UPDLOCK, HOLDLOCK)
            WHERE BusinessId = @BusinessId AND Id = @EstimateId;

            IF @JobId IS NULL THROW 51050, 'estimate_not_found', 1;
            IF @Status = 'Superseded' THROW 51051, 'invalid_transition', 1;
            IF NOT EXISTS (SELECT 1 FROM app.JobItems WHERE BusinessId = @BusinessId AND JobId = @JobId)
                THROW 51052, 'job_items_required', 1;

            DECLARE @Revision int;
            SELECT @Revision = MAX(Revision) + 1
            FROM app.Estimates WITH (UPDLOCK, HOLDLOCK)
            WHERE BusinessId = @BusinessId AND EstimateNumber = @EstimateNumber;

            DECLARE @Subtotal decimal(19,2), @Discount decimal(19,2), @Tax decimal(19,2), @Total decimal(19,2);
            SELECT @Subtotal = SUM(CONVERT(decimal(19,2), ROUND(Quantity * UnitPrice, 2))),
                   @Discount = SUM(DiscountAmount), @Tax = SUM(TaxAmount), @Total = SUM(LineTotal)
            FROM app.JobItems WHERE BusinessId = @BusinessId AND JobId = @JobId;

            DECLARE @CustomerSnapshot nvarchar(max) =
            (
                SELECT 1 AS schemaVersion, c.Id AS customerId, c.Name, c.CompanyName, c.Email, c.Phone,
                       l.AddressLine1, l.City, l.StateCode, l.PostalCode, l.CountryCode
                FROM app.Jobs AS j
                INNER JOIN app.Customers AS c ON c.BusinessId = j.BusinessId AND c.Id = j.CustomerId
                OUTER APPLY
                (
                    SELECT TOP (1) AddressLine1, City, StateCode, PostalCode, CountryCode
                    FROM app.Locations AS l
                    WHERE l.BusinessId = c.BusinessId AND l.CustomerId = c.Id AND l.ArchivedAt IS NULL
                    ORDER BY l.CreatedAt
                ) AS l
                WHERE j.BusinessId = @BusinessId AND j.Id = @JobId
                FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
            );

            INSERT app.Estimates
                (BusinessId, Id, JobId, EstimateNumber, Revision, Status, ValidUntil,
                 Subtotal, DiscountTotal, TaxTotal, Total, CustomerSnapshot)
            VALUES
                (@BusinessId, @RevisionId, @JobId, @EstimateNumber, @Revision, 'Draft', @ValidUntil,
                 @Subtotal, @Discount, @Tax, @Total, @CustomerSnapshot);

            INSERT app.EstimateItems
                (BusinessId, EstimateId, ItemType, Description, Quantity, Unit, UnitPrice,
                 DiscountAmount, TaxAmount, SortOrder)
            SELECT BusinessId, @RevisionId, ItemType, Description, Quantity, Unit, UnitPrice,
                   DiscountAmount, TaxAmount, SortOrder
            FROM app.JobItems WHERE BusinessId = @BusinessId AND JobId = @JobId;

            UPDATE app.Estimates SET Status = 'Superseded', UpdatedAt = SYSUTCDATETIME()
            WHERE BusinessId = @BusinessId AND Id = @EstimateId;

            UPDATE app.PublicLinks SET RevokedAt = SYSUTCDATETIME(), UpdatedAt = SYSUTCDATETIME()
            WHERE BusinessId = @BusinessId AND EstimateId = @EstimateId AND RevokedAt IS NULL;

            INSERT app.AuditEvents
                (BusinessId, ActorUserId, Action, EntityType, EntityId, CorrelationId, Changes)
            VALUES
                (@BusinessId, @UserId, N'estimate.revised', N'Estimate', @RevisionId,
                 CONVERT(nvarchar(100), NEWID()),
                 N'{"status":"Draft","supersedes":"' + CONVERT(nvarchar(36), @EstimateId) + N'"}');
            """;

        try
        {
            await baseDAL.ExecuteInTransactionAsync(
                businessId,
                "Estimates.Revise",
                async (connection, transaction, token) =>
                {
                    await using var commandSql = BaseDAL.BuildCommand(connection, transaction, sql, parameters:
                    [
                        UniqueIdentifier("@BusinessId", businessId),
                        UniqueIdentifier("@EstimateId", estimateId),
                        UniqueIdentifier("@RevisionId", revisionId),
                        UniqueIdentifier("@UserId", actor.UserId),
                        Date("@ValidUntil", command.ValidUntil)
                    ]);
                    await commandSql.ExecuteNonQueryAsync(token).ConfigureAwait(false);
                    return true;
                },
                IsolationLevel.Serializable,
                cancellationToken);
        }
        catch (DataAccessException exception) when (SqlNumber(exception) == 51050)
        {
            throw new FinancialRuleException("resource_not_found", "The estimate was not found.");
        }
        catch (DataAccessException exception) when (SqlNumber(exception) == 51051)
        {
            throw new FinancialRuleException("invalid_transition", "A superseded estimate cannot be revised again.");
        }
        catch (DataAccessException exception) when (SqlNumber(exception) == 51052)
        {
            throw new FinancialRuleException("job_items_required", "Add services or parts to the job before revising the estimate.");
        }

        return await GetEstimateAsync(businessId, revisionId, cancellationToken).ConfigureAwait(false);
    }

    public async Task<PublicEstimateLinkRecord> CreatePublicEstimateLinkAsync(
        Guid businessId,
        Guid estimateId,
        CancellationToken cancellationToken = default)
    {
        var actor = RequireTenantContext();
        var secret = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32))
            .TrimEnd('=').Replace('+', '-').Replace('/', '_');
        var publicToken = $"{businessId:N}.{secret}";
        var tokenHash = SHA256.HashData(Encoding.UTF8.GetBytes(publicToken));
        DateTime expiresAt = default;

        await baseDAL.ExecuteInTransactionAsync(
            businessId,
            "Estimates.CreatePublicLink",
            async (connection, transaction, token) =>
            {
                const string selectSql = """
                    SELECT Status, ValidUntil
                    FROM app.Estimates WITH (UPDLOCK, HOLDLOCK)
                    WHERE BusinessId = @BusinessId AND Id = @EstimateId;
                    """;
                string status;
                DateOnly validUntil;
                await using (var select = BaseDAL.BuildCommand(connection, transaction, selectSql, parameters:
                [UniqueIdentifier("@BusinessId", businessId), UniqueIdentifier("@EstimateId", estimateId)]))
                await using (var reader = await select.ExecuteReaderAsync(token).ConfigureAwait(false))
                {
                    if (!await reader.ReadAsync(token).ConfigureAwait(false))
                    {
                        throw new FinancialRuleException("resource_not_found", "The estimate was not found.");
                    }

                    status = reader.GetString(0);
                    validUntil = DateOnly.FromDateTime(reader.GetDateTime(1));
                }

                if (status != "Sent") throw new FinancialRuleException("invalid_transition", "Send the estimate before creating a customer link.");
                if (validUntil < DateOnly.FromDateTime(DateTime.UtcNow)) throw new FinancialRuleException("estimate_expired", "The estimate expiration date has passed.");
                expiresAt = validUntil.ToDateTime(TimeOnly.MaxValue, DateTimeKind.Utc);

                const string insertSql = """
                    UPDATE app.PublicLinks
                    SET RevokedAt = SYSUTCDATETIME(), UpdatedAt = SYSUTCDATETIME()
                    WHERE BusinessId = @BusinessId AND EstimateId = @EstimateId AND RevokedAt IS NULL;

                    INSERT app.PublicLinks (BusinessId, EstimateId, TokenHash, ExpiresAt)
                    VALUES (@BusinessId, @EstimateId, @TokenHash, @ExpiresAt);

                    INSERT app.AuditEvents
                        (BusinessId, ActorUserId, Action, EntityType, EntityId, CorrelationId, Changes)
                    VALUES
                        (@BusinessId, @UserId, N'estimate.public_link_created', N'Estimate', @EstimateId,
                         CONVERT(nvarchar(100), NEWID()), N'{"delivery":"PublicLink"}');
                    """;
                await using var insert = BaseDAL.BuildCommand(connection, transaction, insertSql, parameters:
                [
                    UniqueIdentifier("@BusinessId", businessId),
                    UniqueIdentifier("@EstimateId", estimateId),
                    UniqueIdentifier("@UserId", actor.UserId),
                    Binary("@TokenHash", tokenHash, 32),
                    DateTime2("@ExpiresAt", expiresAt)
                ]);
                await insert.ExecuteNonQueryAsync(token).ConfigureAwait(false);
                return true;
            },
            IsolationLevel.Serializable,
            cancellationToken);

        return new PublicEstimateLinkRecord(publicToken, AsUtcOffset(expiresAt));
    }

    public async Task<PublicEstimateRecord> GetPublicEstimateAsync(
        string token,
        CancellationToken cancellationToken = default)
    {
        var (businessId, tokenHash) = ParsePublicToken(token);
        const string sql = """
            SELECT e.Id, b.Name,
                   COALESCE(JSON_VALUE(e.CustomerSnapshot, '$.Name'), N'Customer'),
                   e.EstimateNumber, e.Revision, e.Status, e.ValidUntil,
                   e.Subtotal, e.DiscountTotal, e.TaxTotal, e.Total,
                   d.Decision, d.DecidedAt
            FROM app.PublicLinks AS pl
            INNER JOIN app.Estimates AS e ON e.BusinessId = pl.BusinessId AND e.Id = pl.EstimateId
            INNER JOIN platform.Businesses AS b ON b.Id = e.BusinessId
            LEFT JOIN app.EstimateDecisions AS d ON d.BusinessId = e.BusinessId AND d.EstimateId = e.Id
            WHERE pl.BusinessId = @BusinessId AND pl.TokenHash = @TokenHash
              AND pl.RevokedAt IS NULL AND pl.ExpiresAt >= SYSUTCDATETIME();
            """;
        var estimate = await baseDAL.ExecuteSingleAsync(
            businessId,
            "PublicEstimates.Get",
            sql,
            ReadPublicEstimate,
            [UniqueIdentifier("@BusinessId", businessId), Binary("@TokenHash", tokenHash, 32)],
            cancellationToken).ConfigureAwait(false)
            ?? throw new FinancialRuleException("resource_not_found", "This estimate link is invalid or has expired.");

        return estimate with
        {
            Items = await ReadEstimateItemsAsync(businessId, estimate.EstimateId, cancellationToken).ConfigureAwait(false)
        };
    }

    public async Task<EstimateDecisionRecord> DecidePublicEstimateAsync(
        string token,
        EstimateDecisionCommand command,
        CancellationToken cancellationToken = default)
    {
        var decision = command.Decision?.Trim();
        var approverName = command.ApproverName?.Trim();
        var approverEmail = command.ApproverEmail?.Trim();
        if (decision is not ("Approved" or "Declined") || string.IsNullOrWhiteSpace(approverName) ||
            approverName.Length > 200 || string.IsNullOrWhiteSpace(approverEmail) || approverEmail.Length > 254 ||
            !MailAddress.TryCreate(approverEmail, out var parsedEmail) ||
            !string.Equals(parsedEmail.Address, approverEmail, StringComparison.OrdinalIgnoreCase))
        {
            throw new FinancialRuleException("validation_failed", "Enter Approve or Decline, your name, and a valid email address.");
        }

        var (businessId, tokenHash) = ParsePublicToken(token);
        return await baseDAL.ExecuteInTransactionAsync(
            businessId,
            "PublicEstimates.Decide",
            async (connection, transaction, cancellation) =>
            {
                const string selectSql = """
                    SELECT e.Id, e.Status, e.ValidUntil,
                           d.Id, d.Decision, d.ApproverName, d.ApproverEmail, d.DecidedAt
                    FROM app.PublicLinks AS pl WITH (UPDLOCK, HOLDLOCK)
                    INNER JOIN app.Estimates AS e WITH (UPDLOCK, HOLDLOCK)
                        ON e.BusinessId = pl.BusinessId AND e.Id = pl.EstimateId
                    LEFT JOIN app.EstimateDecisions AS d
                        ON d.BusinessId = e.BusinessId AND d.EstimateId = e.Id
                    WHERE pl.BusinessId = @BusinessId AND pl.TokenHash = @TokenHash
                      AND pl.RevokedAt IS NULL AND pl.ExpiresAt >= SYSUTCDATETIME();
                    """;
                Guid estimateId;
                string status;
                DateOnly validUntil;
                EstimateDecisionRecord? existing = null;
                await using (var select = BaseDAL.BuildCommand(connection, transaction, selectSql, parameters:
                [UniqueIdentifier("@BusinessId", businessId), Binary("@TokenHash", tokenHash, 32)]))
                await using (var reader = await select.ExecuteReaderAsync(cancellation).ConfigureAwait(false))
                {
                    if (!await reader.ReadAsync(cancellation).ConfigureAwait(false))
                    {
                        throw new FinancialRuleException("resource_not_found", "This estimate link is invalid or has expired.");
                    }

                    estimateId = reader.GetGuid(0);
                    status = reader.GetString(1);
                    validUntil = DateOnly.FromDateTime(reader.GetDateTime(2));
                    if (!reader.IsDBNull(3))
                    {
                        existing = new EstimateDecisionRecord(
                            reader.GetGuid(3), estimateId, reader.GetString(4), reader.GetString(5),
                            reader.GetString(6), AsUtcOffset(reader.GetDateTime(7)));
                    }
                }

                if (existing is not null)
                {
                    if (existing.Decision == decision && existing.ApproverName == approverName &&
                        string.Equals(existing.ApproverEmail, approverEmail, StringComparison.OrdinalIgnoreCase))
                    {
                        return existing;
                    }

                    throw new FinancialRuleException("decision_already_recorded", "A decision has already been recorded for this estimate.");
                }

                if (status != "Sent") throw new FinancialRuleException("invalid_transition", "This estimate is no longer awaiting a decision.");
                if (validUntil < DateOnly.FromDateTime(DateTime.UtcNow)) throw new FinancialRuleException("estimate_expired", "This estimate has expired.");

                var decisionId = Guid.NewGuid();
                const string insertSql = """
                    INSERT app.EstimateDecisions
                        (BusinessId, Id, EstimateId, Decision, ApproverName, ApproverEmail, EvidenceReference)
                    VALUES
                        (@BusinessId, @DecisionId, @EstimateId, @Decision, @ApproverName, @ApproverEmail,
                         N'public-link:' + CONVERT(nvarchar(36), @DecisionId));

                    UPDATE app.Estimates
                    SET Status = @Decision, UpdatedAt = SYSUTCDATETIME()
                    WHERE BusinessId = @BusinessId AND Id = @EstimateId;

                    UPDATE app.PublicLinks
                    SET ConsumedAt = SYSUTCDATETIME(), UpdatedAt = SYSUTCDATETIME()
                    WHERE BusinessId = @BusinessId AND TokenHash = @TokenHash;

                    INSERT app.AuditEvents
                        (BusinessId, ActorUserId, Action, EntityType, EntityId, CorrelationId, Changes)
                    VALUES
                        (@BusinessId, NULL, N'estimate.decision_recorded', N'Estimate', @EstimateId,
                         CONVERT(nvarchar(100), NEWID()),
                         N'{"decision":"' + @Decision + N'","channel":"PublicLink"}');
                    """;
                await using var insert = BaseDAL.BuildCommand(connection, transaction, insertSql, parameters:
                [
                    UniqueIdentifier("@BusinessId", businessId),
                    UniqueIdentifier("@DecisionId", decisionId),
                    UniqueIdentifier("@EstimateId", estimateId),
                    VarChar("@Decision", decision, 32),
                    NVarChar("@ApproverName", approverName, 200),
                    NVarChar("@ApproverEmail", approverEmail, 254),
                    Binary("@TokenHash", tokenHash, 32)
                ]);
                await insert.ExecuteNonQueryAsync(cancellation).ConfigureAwait(false);
                return new EstimateDecisionRecord(
                    decisionId, estimateId, decision, approverName, approverEmail, DateTimeOffset.UtcNow);
            },
            IsolationLevel.Serializable,
            cancellationToken).ConfigureAwait(false);
    }

    public async Task<EstimateDecisionRecord> RecordEstimateDecisionAsync(
        Guid businessId,
        Guid estimateId,
        EstimateDecisionCommand command,
        CancellationToken cancellationToken = default)
    {
        var decision = command.Decision?.Trim();
        var approverName = string.IsNullOrWhiteSpace(command.ApproverName) ? "Customer (Staff Recorded)" : command.ApproverName.Trim();
        var approverEmail = string.IsNullOrWhiteSpace(command.ApproverEmail) ? "direct@servicedesk.local" : command.ApproverEmail.Trim();
        if (decision is not ("Approved" or "Declined"))
        {
            throw new FinancialRuleException("validation_failed", "Decision must be Approved or Declined.");
        }

        var actor = RequireTenantContext();
        var decisionId = Guid.NewGuid();

        return await baseDAL.ExecuteInTransactionAsync(
            businessId,
            "Estimates.RecordDecision",
            async (connection, transaction, cancellation) =>
            {
                const string selectSql = """
                    SELECT Id, Status, ValidUntil
                    FROM app.Estimates WITH (UPDLOCK, HOLDLOCK)
                    WHERE BusinessId = @BusinessId AND Id = @EstimateId;
                    """;
                string status;
                DateOnly validUntil;
                await using (var select = BaseDAL.BuildCommand(connection, transaction, selectSql, parameters:
                [UniqueIdentifier("@BusinessId", businessId), UniqueIdentifier("@EstimateId", estimateId)]))
                await using (var reader = await select.ExecuteReaderAsync(cancellation).ConfigureAwait(false))
                {
                    if (!await reader.ReadAsync(cancellation).ConfigureAwait(false))
                    {
                        throw new FinancialRuleException("resource_not_found", "The estimate was not found.");
                    }
                    status = reader.GetString(1);
                    validUntil = DateOnly.FromDateTime(reader.GetDateTime(2));
                }

                if (status is not ("Draft" or "Sent"))
                {
                    throw new FinancialRuleException("invalid_transition", $"An estimate in '{status}' status cannot be decided.");
                }
                if (validUntil < DateOnly.FromDateTime(DateTime.UtcNow))
                {
                    throw new FinancialRuleException("estimate_expired", "This estimate has expired.");
                }

                const string insertSql = """
                    DELETE FROM app.EstimateDecisions WHERE BusinessId = @BusinessId AND EstimateId = @EstimateId;

                    INSERT app.EstimateDecisions
                        (BusinessId, Id, EstimateId, Decision, ApproverName, ApproverEmail, EvidenceReference)
                    VALUES
                        (@BusinessId, @DecisionId, @EstimateId, @Decision, @ApproverName, @ApproverEmail,
                         N'in-app:' + CONVERT(nvarchar(36), @DecisionId));

                    UPDATE app.Estimates
                    SET Status = @Decision, UpdatedAt = SYSUTCDATETIME()
                    WHERE BusinessId = @BusinessId AND Id = @EstimateId;

                    UPDATE app.PublicLinks
                    SET ConsumedAt = SYSUTCDATETIME(), UpdatedAt = SYSUTCDATETIME()
                    WHERE BusinessId = @BusinessId AND EstimateId = @EstimateId AND ConsumedAt IS NULL;

                    INSERT app.AuditEvents
                        (BusinessId, ActorUserId, Action, EntityType, EntityId, CorrelationId, Changes)
                    VALUES
                        (@BusinessId, @UserId, N'estimate.decision_recorded', N'Estimate', @EstimateId,
                         CONVERT(nvarchar(100), NEWID()),
                         (SELECT @Decision AS decision, @ApproverName AS approverName, N'InApp' AS channel FOR JSON PATH, WITHOUT_ARRAY_WRAPPER));
                    """;

                await using var insert = BaseDAL.BuildCommand(connection, transaction, insertSql, parameters:
                [
                    UniqueIdentifier("@BusinessId", businessId),
                    UniqueIdentifier("@DecisionId", decisionId),
                    UniqueIdentifier("@EstimateId", estimateId),
                    UniqueIdentifier("@UserId", actor.UserId),
                    VarChar("@Decision", decision, 32),
                    NVarChar("@ApproverName", approverName, 200),
                    NVarChar("@ApproverEmail", approverEmail, 254)
                ]);
                await insert.ExecuteNonQueryAsync(cancellation).ConfigureAwait(false);

                return new EstimateDecisionRecord(
                    decisionId,
                    estimateId,
                    decision,
                    approverName,
                    approverEmail,
                    DateTimeOffset.UtcNow);
            },
            IsolationLevel.Serializable,
            cancellationToken).ConfigureAwait(false);
    }

    public async Task<IReadOnlyList<InvoiceRecord>> ListInvoicesAsync(
        Guid businessId,
        string? status,
        CancellationToken cancellationToken = default)
    {
        const string sql = """
            SELECT i.Id, i.BusinessId, i.JobId, i.CustomerId, i.InvoiceNumber, c.Name,
                   i.Status, i.DeliveryStatus, i.IssuedOn, i.DueOn,
                   i.Subtotal, i.DiscountTotal, i.TaxTotal, i.Total,
                   COALESCE(p.Paid, 0), COALESCE(r.Refunded, 0), COALESCE(cr.Credited, 0), i.CreatedAt
            FROM app.Invoices AS i
            INNER JOIN app.Customers AS c ON c.BusinessId = i.BusinessId AND c.Id = i.CustomerId
            OUTER APPLY
            (
                SELECT SUM(Amount) AS Paid FROM app.Payments
                WHERE BusinessId = i.BusinessId AND InvoiceId = i.Id AND Status = 'Succeeded'
            ) AS p
            OUTER APPLY
            (
                SELECT SUM(pr.Amount) AS Refunded
                FROM app.PaymentRefunds AS pr
                INNER JOIN app.Payments AS p2 ON p2.BusinessId = pr.BusinessId AND p2.Id = pr.PaymentId
                WHERE pr.BusinessId = i.BusinessId AND p2.InvoiceId = i.Id AND pr.Status = 'Succeeded'
            ) AS r
            OUTER APPLY
            (
                SELECT SUM(Amount) AS Credited FROM app.CreditNotes
                WHERE BusinessId = i.BusinessId AND InvoiceId = i.Id
            ) AS cr
            WHERE i.BusinessId = @BusinessId AND (@Status IS NULL OR i.Status = @Status)
            ORDER BY i.CreatedAt DESC;
            """;
        var headers = await baseDAL.ExecuteQueryAsync(
            businessId,
            "Invoices.List",
            sql,
            ReadInvoiceHeader,
            [UniqueIdentifier("@BusinessId", businessId), VarChar("@Status", NullIfWhiteSpace(status), 32)],
            cancellationToken);

        var results = new List<InvoiceRecord>(headers.Count);
        foreach (var header in headers)
        {
            results.Add(header with { Items = await ReadInvoiceItemsAsync(businessId, header.Id, cancellationToken).ConfigureAwait(false) });
        }

        return results;
    }

    public async Task<InvoiceRecord> CreateInvoiceAsync(
        Guid businessId,
        Guid jobId,
        CancellationToken cancellationToken = default)
    {
        var actor = RequireTenantContext();
        var invoiceId = Guid.NewGuid();
        const string sql = """
            DECLARE @CustomerId uniqueidentifier, @JobStatus varchar(32);
            SELECT @CustomerId = CustomerId, @JobStatus = Status
            FROM app.Jobs WITH (UPDLOCK, HOLDLOCK)
            WHERE BusinessId = @BusinessId AND Id = @JobId;
            IF @CustomerId IS NULL THROW 51040, 'job_not_found', 1;
            IF @JobStatus <> 'Completed' THROW 51041, 'job_not_completed', 1;
            IF NOT EXISTS (SELECT 1 FROM app.JobItems WHERE BusinessId = @BusinessId AND JobId = @JobId)
                THROW 51042, 'job_items_required', 1;
            IF EXISTS (SELECT 1 FROM app.Invoices WHERE BusinessId = @BusinessId AND JobId = @JobId AND Status <> 'Voided')
                THROW 51043, 'invoice_already_exists', 1;

            DECLARE @Next bigint;
            SELECT @Next = NextValue FROM app.NumberSequences WITH (UPDLOCK, HOLDLOCK)
            WHERE BusinessId = @BusinessId AND DocumentType = N'Invoice';
            IF @Next IS NULL
            BEGIN
                SET @Next = 1;
                INSERT app.NumberSequences (BusinessId, DocumentType, NextValue, Prefix)
                VALUES (@BusinessId, N'Invoice', 2, N'INV-');
            END
            ELSE
                UPDATE app.NumberSequences SET NextValue = NextValue + 1, UpdatedAt = SYSUTCDATETIME()
                WHERE BusinessId = @BusinessId AND DocumentType = N'Invoice';

            DECLARE @Subtotal decimal(19,2), @Discount decimal(19,2), @Tax decimal(19,2), @Total decimal(19,2);
            SELECT @Subtotal = SUM(CONVERT(decimal(19,2), ROUND(Quantity * UnitPrice, 2))),
                   @Discount = SUM(DiscountAmount), @Tax = SUM(TaxAmount), @Total = SUM(LineTotal)
            FROM app.JobItems WHERE BusinessId = @BusinessId AND JobId = @JobId;

            DECLARE @BillingSnapshot nvarchar(max) =
            (
                SELECT 1 AS schemaVersion, b.Name AS businessName, b.BillingEmail,
                       c.Id AS customerId, c.Name AS customerName, c.CompanyName, c.Email, c.Phone,
                       l.AddressLine1, l.City, l.StateCode, l.PostalCode, l.CountryCode,
                       14 AS paymentTermsDays
                FROM platform.Businesses AS b
                INNER JOIN app.Customers AS c ON c.BusinessId = b.Id AND c.Id = @CustomerId
                OUTER APPLY
                (
                    SELECT TOP (1) AddressLine1, City, StateCode, PostalCode, CountryCode
                    FROM app.Locations AS l
                    WHERE l.BusinessId = c.BusinessId AND l.CustomerId = c.Id AND l.ArchivedAt IS NULL
                    ORDER BY l.CreatedAt
                ) AS l
                WHERE b.Id = @BusinessId
                FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
            );

            INSERT app.Invoices
                (BusinessId, Id, JobId, CustomerId, InvoiceNumber, Status, DeliveryStatus,
                 Subtotal, DiscountTotal, TaxTotal, Total, BillingSnapshot)
            VALUES
                (@BusinessId, @InvoiceId, @JobId, @CustomerId,
                 N'INV-' + RIGHT(N'0000' + CONVERT(nvarchar(20), @Next), 4),
                 'Draft', 'NotSent', @Subtotal, @Discount, @Tax, @Total, @BillingSnapshot);

            INSERT app.InvoiceItems
                (BusinessId, InvoiceId, ItemType, Description, Quantity, Unit, UnitPrice,
                 DiscountAmount, TaxAmount, SortOrder)
            SELECT BusinessId, @InvoiceId, ItemType, Description, Quantity, Unit, UnitPrice,
                   DiscountAmount, TaxAmount, SortOrder
            FROM app.JobItems WHERE BusinessId = @BusinessId AND JobId = @JobId;

            INSERT app.AuditEvents
                (BusinessId, ActorUserId, Action, EntityType, EntityId, CorrelationId, Changes)
            VALUES
                (@BusinessId, @UserId, N'invoice.created', N'Invoice', @InvoiceId,
                 CONVERT(nvarchar(100), NEWID()), N'{"status":"Draft"}');
            """;

        try
        {
            await baseDAL.ExecuteInTransactionAsync(
                businessId,
                "Invoices.Create",
                async (connection, transaction, token) =>
                {
                    await using var sqlCommand = BaseDAL.BuildCommand(connection, transaction, sql, parameters:
                    [
                        UniqueIdentifier("@BusinessId", businessId),
                        UniqueIdentifier("@JobId", jobId),
                        UniqueIdentifier("@InvoiceId", invoiceId),
                        UniqueIdentifier("@UserId", actor.UserId)
                    ]);
                    await sqlCommand.ExecuteNonQueryAsync(token).ConfigureAwait(false);
                    return true;
                },
                IsolationLevel.Serializable,
                cancellationToken);
        }
        catch (DataAccessException exception) when (SqlNumber(exception) == 51040)
        {
            throw new FinancialRuleException("resource_not_found", "The requested job was not found.");
        }
        catch (DataAccessException exception) when (SqlNumber(exception) == 51041)
        {
            throw new FinancialRuleException("job_not_completed", "Complete the job before creating its invoice.");
        }
        catch (DataAccessException exception) when (SqlNumber(exception) == 51042)
        {
            throw new FinancialRuleException("job_items_required", "The completed job has no billable items.");
        }
        catch (DataAccessException exception) when (SqlNumber(exception) is 51043 or 2601 or 2627)
        {
            throw new FinancialRuleException("invoice_already_exists", "This job already has a live invoice.");
        }

        return await GetInvoiceAsync(businessId, invoiceId, cancellationToken).ConfigureAwait(false);
    }

    public async Task<InvoiceRecord> IssueInvoiceAsync(
        Guid businessId,
        Guid invoiceId,
        IssueInvoiceCommand command,
        CancellationToken cancellationToken = default)
    {
        if (command.DueOn < command.IssuedOn)
        {
            throw new FinancialRuleException("validation_failed", "The due date cannot be before the issue date.");
        }

        var actor = RequireTenantContext();
        const string sql = """
            IF NOT EXISTS (SELECT 1 FROM app.Invoices WHERE BusinessId = @BusinessId AND Id = @InvoiceId)
                THROW 51044, 'invoice_not_found', 1;
            IF NOT EXISTS (SELECT 1 FROM app.Invoices WHERE BusinessId = @BusinessId AND Id = @InvoiceId AND Status = 'Draft')
                THROW 51045, 'invalid_transition', 1;

            UPDATE app.Invoices
            SET Status = 'Issued', DeliveryStatus = 'Queued', IssuedOn = @IssuedOn, DueOn = @DueOn, UpdatedAt = SYSUTCDATETIME()
            WHERE BusinessId = @BusinessId AND Id = @InvoiceId;

            INSERT app.OutboxMessages
                (BusinessId, EventType, Payload, NextAttemptAt)
            VALUES
                (@BusinessId, N'invoice.issued',
                 (
                     SELECT @InvoiceId AS invoiceId,
                            i.InvoiceNumber AS invoiceNumber,
                            c.Name AS customerName,
                            c.Email AS recipientEmail,
                            N'Invoice #' + i.InvoiceNumber + N' from ' + b.Name AS subject,
                            N'<p>Hello ' + c.Name + N',</p><p>Invoice #' + i.InvoiceNumber + N' has been issued. Total: $' + CONVERT(nvarchar(30), i.Total) + N', Due: ' + CONVERT(nvarchar(30), i.DueOn) + N'.</p>' AS body
                     FROM app.Invoices AS i
                     INNER JOIN app.Customers AS c ON c.BusinessId = i.BusinessId AND c.Id = i.CustomerId
                     INNER JOIN platform.Businesses AS b ON b.Id = i.BusinessId
                     WHERE i.BusinessId = @BusinessId AND i.Id = @InvoiceId
                     FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
                 ),
                 SYSUTCDATETIME());

            INSERT app.AuditEvents
                (BusinessId, ActorUserId, Action, EntityType, EntityId, CorrelationId, Changes)
            VALUES
                (@BusinessId, @UserId, N'invoice.issued', N'Invoice', @InvoiceId,
                 CONVERT(nvarchar(100), NEWID()), N'{"status":"Issued"}');
            """;
        try
        {
            await baseDAL.ExecuteInTransactionAsync(
                businessId,
                "Invoices.Issue",
                async (connection, transaction, token) =>
                {
                    await using var sqlCommand = BaseDAL.BuildCommand(connection, transaction, sql, parameters:
                    [
                        UniqueIdentifier("@BusinessId", businessId),
                        UniqueIdentifier("@InvoiceId", invoiceId),
                        UniqueIdentifier("@UserId", actor.UserId),
                        Date("@IssuedOn", command.IssuedOn),
                        Date("@DueOn", command.DueOn)
                    ]);
                    await sqlCommand.ExecuteNonQueryAsync(token).ConfigureAwait(false);
                    return true;
                },
                IsolationLevel.Serializable,
                cancellationToken);
        }
        catch (DataAccessException exception) when (SqlNumber(exception) == 51044)
        {
            throw new FinancialRuleException("resource_not_found", "The invoice was not found.");
        }
        catch (DataAccessException exception) when (SqlNumber(exception) == 51045)
        {
            throw new FinancialRuleException("invalid_transition", "Only a draft invoice can be issued.");
        }

        return await GetInvoiceAsync(businessId, invoiceId, cancellationToken).ConfigureAwait(false);
    }

    public async Task<PaymentRecord> RecordPaymentAsync(
        Guid businessId,
        Guid invoiceId,
        RecordPaymentCommand command,
        CancellationToken cancellationToken = default)
    {
        if (command.Amount <= 0 || command.Method is not ("Cash" or "Check" or "BankTransfer" or "Card"))
        {
            throw new FinancialRuleException("validation_failed", "Enter a positive amount and a valid payment method.");
        }

        var actor = RequireTenantContext();
        var paymentId = Guid.NewGuid();
        var paidAt = command.PaidAt ?? DateTimeOffset.UtcNow;
        await baseDAL.ExecuteInTransactionAsync(
            businessId,
            "Payments.Record",
            async (connection, transaction, token) =>
            {
                const string balanceSql = """
                    SELECT i.Status,
                           i.Total - COALESCE(p.Paid, 0) + COALESCE(r.Refunded, 0) - COALESCE(c.Credited, 0) AS Balance
                    FROM app.Invoices AS i WITH (UPDLOCK, HOLDLOCK)
                    OUTER APPLY
                    (
                        SELECT SUM(Amount) AS Paid FROM app.Payments
                        WHERE BusinessId = i.BusinessId AND InvoiceId = i.Id AND Status = 'Succeeded'
                    ) AS p
                    OUTER APPLY
                    (
                        SELECT SUM(pr.Amount) AS Refunded
                        FROM app.PaymentRefunds AS pr
                        INNER JOIN app.Payments AS p2 ON p2.BusinessId = pr.BusinessId AND p2.Id = pr.PaymentId
                        WHERE pr.BusinessId = i.BusinessId AND p2.InvoiceId = i.Id AND pr.Status = 'Succeeded'
                    ) AS r
                    OUTER APPLY
                    (
                        SELECT SUM(Amount) AS Credited FROM app.CreditNotes
                        WHERE BusinessId = i.BusinessId AND InvoiceId = i.Id
                    ) AS c
                    WHERE i.BusinessId = @BusinessId AND i.Id = @InvoiceId;
                    """;
                string status;
                decimal balance;
                await using (var select = BaseDAL.BuildCommand(connection, transaction, balanceSql, parameters:
                [UniqueIdentifier("@BusinessId", businessId), UniqueIdentifier("@InvoiceId", invoiceId)]))
                await using (var reader = await select.ExecuteReaderAsync(token).ConfigureAwait(false))
                {
                    if (!await reader.ReadAsync(token).ConfigureAwait(false))
                    {
                        throw new FinancialRuleException("resource_not_found", "The invoice was not found.");
                    }

                    status = reader.GetString(0);
                    balance = reader.GetDecimal(1);
                }

                if (status != "Issued") throw new FinancialRuleException("invoice_not_issued", "Issue the invoice before recording payment.");
                if (command.Amount > balance) throw new FinancialRuleException("overpayment", $"Payment cannot exceed the current balance of {balance:C}.");

                const string insertSql = """
                    INSERT app.Payments
                        (BusinessId, Id, InvoiceId, Amount, Method, Status, ExternalReference, PaidAt, RecordedByMemberId)
                    VALUES
                        (@BusinessId, @PaymentId, @InvoiceId, @Amount, @Method, 'Succeeded',
                         @ExternalReference, @PaidAt, @MemberId);

                    UPDATE app.Invoices SET UpdatedAt = SYSUTCDATETIME()
                    WHERE BusinessId = @BusinessId AND Id = @InvoiceId;

                    INSERT app.AuditEvents
                        (BusinessId, ActorUserId, Action, EntityType, EntityId, CorrelationId, Changes)
                    VALUES
                        (@BusinessId, @UserId, N'payment.recorded', N'Payment', @PaymentId,
                         CONVERT(nvarchar(100), NEWID()), N'{"status":"Succeeded"}');
                    """;
                await using var insert = BaseDAL.BuildCommand(connection, transaction, insertSql, parameters:
                [
                    UniqueIdentifier("@BusinessId", businessId),
                    UniqueIdentifier("@PaymentId", paymentId),
                    UniqueIdentifier("@InvoiceId", invoiceId),
                    UniqueIdentifier("@MemberId", actor.MemberId),
                    UniqueIdentifier("@UserId", actor.UserId),
                    Decimal("@Amount", command.Amount, 19, 2),
                    VarChar("@Method", command.Method, 32),
                    NVarChar("@ExternalReference", NullIfWhiteSpace(command.ExternalReference), 200),
                    DateTime2("@PaidAt", paidAt.UtcDateTime)
                ]);
                await insert.ExecuteNonQueryAsync(token).ConfigureAwait(false);
                return true;
            },
            IsolationLevel.Serializable,
            cancellationToken);

        return new PaymentRecord(paymentId, invoiceId, command.Amount, command.Method, "Succeeded", NullIfWhiteSpace(command.ExternalReference), paidAt);
    }

    public async Task<EstimateRecord> GetEstimateAsync(Guid businessId, Guid estimateId, CancellationToken cancellationToken = default)
    {
        const string sql = """
            SELECT e.Id, e.BusinessId, e.JobId, e.EstimateNumber, e.Revision, e.Status,
                   e.ValidUntil, c.Name, e.Subtotal, e.DiscountTotal, e.TaxTotal, e.Total,
                   e.SentAt, e.CreatedAt
            FROM app.Estimates AS e
            INNER JOIN app.Jobs AS j ON j.BusinessId = e.BusinessId AND j.Id = e.JobId
            INNER JOIN app.Customers AS c ON c.BusinessId = j.BusinessId AND c.Id = j.CustomerId
            WHERE e.BusinessId = @BusinessId AND e.Id = @EstimateId;
            """;
        var header = await baseDAL.ExecuteSingleAsync(
            businessId,
            "Estimates.Get",
            sql,
            ReadEstimateHeader,
            [UniqueIdentifier("@BusinessId", businessId), UniqueIdentifier("@EstimateId", estimateId)],
            cancellationToken).ConfigureAwait(false)
            ?? throw new FinancialRuleException("resource_not_found", "The estimate was not found.");
        return header with { Items = await ReadEstimateItemsAsync(businessId, estimateId, cancellationToken).ConfigureAwait(false) };
    }

    public async Task<InvoiceRecord> GetInvoiceAsync(Guid businessId, Guid invoiceId, CancellationToken cancellationToken = default)
    {
        var invoices = await ListInvoicesAsync(businessId, null, cancellationToken).ConfigureAwait(false);
        return invoices.FirstOrDefault(invoice => invoice.Id == invoiceId)
            ?? throw new FinancialRuleException("resource_not_found", "The invoice was not found.");
    }

    private Task<IReadOnlyList<FinancialLineRecord>> ReadEstimateItemsAsync(Guid businessId, Guid estimateId, CancellationToken cancellationToken)
    {
        const string sql = """
            SELECT Id, ItemType, Description, Quantity, Unit, UnitPrice, DiscountAmount, TaxAmount, SortOrder, LineTotal
            FROM app.EstimateItems
            WHERE BusinessId = @BusinessId AND EstimateId = @EstimateId
            ORDER BY SortOrder;
            """;
        return baseDAL.ExecuteQueryAsync(
            businessId,
            "EstimateItems.List",
            sql,
            ReadFinancialLine,
            [UniqueIdentifier("@BusinessId", businessId), UniqueIdentifier("@EstimateId", estimateId)],
            cancellationToken);
    }

    private Task<IReadOnlyList<FinancialLineRecord>> ReadInvoiceItemsAsync(Guid businessId, Guid invoiceId, CancellationToken cancellationToken)
    {
        const string sql = """
            SELECT Id, ItemType, Description, Quantity, Unit, UnitPrice, DiscountAmount, TaxAmount, SortOrder, LineTotal
            FROM app.InvoiceItems
            WHERE BusinessId = @BusinessId AND InvoiceId = @InvoiceId
            ORDER BY SortOrder;
            """;
        return baseDAL.ExecuteQueryAsync(
            businessId,
            "InvoiceItems.List",
            sql,
            ReadFinancialLine,
            [UniqueIdentifier("@BusinessId", businessId), UniqueIdentifier("@InvoiceId", invoiceId)],
            cancellationToken);
    }

    private static EstimateRecord ReadEstimateHeader(SqlDataReader reader) => new(
        reader.GetGuid(0), reader.GetGuid(1), reader.GetGuid(2), reader.GetString(3), reader.GetInt32(4),
        reader.GetString(5), DateOnly.FromDateTime(reader.GetDateTime(6)), reader.GetString(7),
        reader.GetDecimal(8), reader.GetDecimal(9), reader.GetDecimal(10), reader.GetDecimal(11),
        reader.IsDBNull(12) ? null : AsUtcOffset(reader.GetDateTime(12)), AsUtcOffset(reader.GetDateTime(13)), []);

    private static InvoiceRecord ReadInvoiceHeader(SqlDataReader reader)
    {
        var status = reader.GetString(6);
        var total = reader.GetDecimal(13);
        var netPaid = reader.GetDecimal(14) - reader.GetDecimal(15);
        var credited = reader.GetDecimal(16);
        var rawBalance = total - credited - netPaid;
        var balance = Math.Max(0, rawBalance);
        var paymentStatus = status is "Draft" or "Voided" ? "NotApplicable"
            : rawBalance < 0 ? "CreditBalance"
            : credited == total && netPaid == 0 ? "SettledByCredit"
            : rawBalance == 0 ? "Paid"
            : netPaid > 0 ? "PartiallyPaid"
            : "Unpaid";
        var dueOn = reader.IsDBNull(9) ? (DateOnly?)null : DateOnly.FromDateTime(reader.GetDateTime(9));
        return new InvoiceRecord(
            reader.GetGuid(0), reader.GetGuid(1), reader.GetGuid(2), reader.GetGuid(3), reader.GetString(4), reader.GetString(5),
            status, reader.GetString(7), reader.IsDBNull(8) ? null : DateOnly.FromDateTime(reader.GetDateTime(8)), dueOn,
            reader.GetDecimal(10), reader.GetDecimal(11), reader.GetDecimal(12), total, balance, paymentStatus,
            status == "Issued" && balance > 0 && dueOn.HasValue && dueOn.Value < DateOnly.FromDateTime(DateTime.UtcNow),
            AsUtcOffset(reader.GetDateTime(17)), []);
    }

    private static FinancialLineRecord ReadFinancialLine(SqlDataReader reader) => new(
        reader.GetGuid(0), reader.GetString(1), reader.GetString(2), reader.GetDecimal(3), reader.GetString(4),
        reader.GetDecimal(5), reader.GetDecimal(6), reader.GetDecimal(7), reader.GetInt32(8), reader.GetDecimal(9));

    private static PublicEstimateRecord ReadPublicEstimate(SqlDataReader reader) => new(
        reader.GetGuid(0), reader.GetString(1), reader.GetString(2), reader.GetString(3), reader.GetInt32(4),
        reader.GetString(5), DateOnly.FromDateTime(reader.GetDateTime(6)), reader.GetDecimal(7), reader.GetDecimal(8),
        reader.GetDecimal(9), reader.GetDecimal(10), reader.IsDBNull(11) ? null : reader.GetString(11),
        reader.IsDBNull(12) ? null : AsUtcOffset(reader.GetDateTime(12)), []);

    private ServiceDesk.Application.Security.TenantContext RequireTenantContext() =>
        tenantContext.Current ?? throw new FinancialRuleException("membership_required", "An active membership is required.");

    private static int? SqlNumber(DataAccessException exception) => (exception.InnerException as SqlException)?.Number;
    private static DateTimeOffset AsUtcOffset(DateTime value) => new(DateTime.SpecifyKind(value, DateTimeKind.Utc));
    private static string? NullIfWhiteSpace(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
    private static (Guid BusinessId, byte[] Hash) ParsePublicToken(string token)
    {
        if (string.IsNullOrWhiteSpace(token) || token.Length > 160)
        {
            throw new FinancialRuleException("resource_not_found", "This estimate link is invalid or has expired.");
        }

        var separator = token.IndexOf('.');
        if (separator != 32 || !Guid.TryParseExact(token[..separator], "N", out var businessId) || separator == token.Length - 1)
        {
            throw new FinancialRuleException("resource_not_found", "This estimate link is invalid or has expired.");
        }

        return (businessId, SHA256.HashData(Encoding.UTF8.GetBytes(token)));
    }

    public async Task<PdfDocumentResult> GetEstimatePdfAsync(Guid businessId, Guid estimateId, CancellationToken cancellationToken = default)
    {
        var estimate = await GetEstimateAsync(businessId, estimateId, cancellationToken).ConfigureAwait(false);
        const string sql = "SELECT Name, BillingEmail FROM platform.Businesses WHERE Id = @BusinessId;";
        var businessInfo = await baseDAL.ExecuteSingleAsync(
            businessId,
            "Businesses.GetForEstimatePdf",
            sql,
            reader => new BusinessContact(reader.GetString(0), reader.GetString(1)),
            [UniqueIdentifier("@BusinessId", businessId)],
            cancellationToken).ConfigureAwait(false);

        var bytes = PdfDocumentBuilder.BuildEstimatePdf(estimate, businessInfo?.Name ?? "ServiceDesk Business", businessInfo?.Email);
        return new PdfDocumentResult(bytes, $"Estimate-{estimate.EstimateNumber}.pdf");
    }

    public async Task<PdfDocumentResult> GetInvoicePdfAsync(Guid businessId, Guid invoiceId, CancellationToken cancellationToken = default)
    {
        var invoice = await GetInvoiceAsync(businessId, invoiceId, cancellationToken).ConfigureAwait(false);
        const string sql = "SELECT Name, BillingEmail FROM platform.Businesses WHERE Id = @BusinessId;";
        var businessInfo = await baseDAL.ExecuteSingleAsync(
            businessId,
            "Businesses.GetForInvoicePdf",
            sql,
            reader => new BusinessContact(reader.GetString(0), reader.GetString(1)),
            [UniqueIdentifier("@BusinessId", businessId)],
            cancellationToken).ConfigureAwait(false);

        var bytes = PdfDocumentBuilder.BuildInvoicePdf(invoice, businessInfo?.Name ?? "ServiceDesk Business", businessInfo?.Email);
        return new PdfDocumentResult(bytes, $"Invoice-{invoice.InvoiceNumber}.pdf");
    }

    public async Task<SmtpSettingsRecord> GetSmtpSettingsAsync(Guid businessId, CancellationToken cancellationToken = default)
    {
        const string sql = """
            SELECT Host, Port, Username, Password, FromEmail, FromName, EnableSsl, IsEnabled
            FROM app.EmailConfigurations
            WHERE BusinessId = @BusinessId;
            """;

        var result = await baseDAL.ExecuteSingleAsync(
            businessId,
            "EmailConfigurations.Get",
            sql,
            reader => new SmtpSettingsRecord(
                reader.GetString(0),
                reader.GetInt32(1),
                reader.GetString(2),
                string.IsNullOrEmpty(reader.GetString(3)) ? null : "••••••••",
                reader.GetString(4),
                reader.GetString(5),
                reader.GetBoolean(6),
                reader.GetBoolean(7)),
            [UniqueIdentifier("@BusinessId", businessId)],
            cancellationToken).ConfigureAwait(false);

        return result ?? new SmtpSettingsRecord("", 587, "", null, "", "", true, false);
    }

    public async Task<SmtpSettingsRecord> SaveSmtpSettingsAsync(
        Guid businessId,
        SaveSmtpSettingsCommand command,
        CancellationToken cancellationToken = default)
    {
        if (command.IsEnabled)
        {
            if (string.IsNullOrWhiteSpace(command.Host) || string.IsNullOrWhiteSpace(command.FromEmail) || string.IsNullOrWhiteSpace(command.Username))
            {
                throw new FinancialRuleException("validation_failed", "Host, Username, and From Email are required when custom SMTP is enabled.");
            }
        }

        var existingPassword = "";
        if (command.Password is null or "" or "••••••••")
        {
            const string pwdSql = "SELECT Password FROM app.EmailConfigurations WHERE BusinessId = @BusinessId;";
            existingPassword = await baseDAL.ExecuteScalarAsync<string>(
                businessId,
                "EmailConfigurations.GetPassword",
                pwdSql,
                [UniqueIdentifier("@BusinessId", businessId)],
                cancellationToken).ConfigureAwait(false) ?? "";
        }

        var passwordToStore = (!string.IsNullOrEmpty(command.Password) && command.Password != "••••••••")
            ? command.Password
            : existingPassword;

        const string upsertSql = """
            MERGE app.EmailConfigurations AS target
            USING (SELECT @BusinessId AS BusinessId) AS source
            ON (target.BusinessId = source.BusinessId)
            WHEN MATCHED THEN
                UPDATE SET Host = @Host, Port = @Port, Username = @Username, Password = @Password,
                           FromEmail = @FromEmail, FromName = @FromName, EnableSsl = @EnableSsl,
                           IsEnabled = @IsEnabled, UpdatedAt = SYSUTCDATETIME()
            WHEN NOT MATCHED THEN
                INSERT (BusinessId, Host, Port, Username, Password, FromEmail, FromName, EnableSsl, IsEnabled, UpdatedAt)
                VALUES (@BusinessId, @Host, @Port, @Username, @Password, @FromEmail, @FromName, @EnableSsl, @IsEnabled, SYSUTCDATETIME());
            """;

        await baseDAL.ExecuteNonQueryAsync(
            businessId,
            "EmailConfigurations.Save",
            upsertSql,
            [
                UniqueIdentifier("@BusinessId", businessId),
                NVarChar("@Host", command.Host ?? "", 200),
                Int("@Port", command.Port <= 0 ? 587 : command.Port),
                NVarChar("@Username", command.Username ?? "", 200),
                NVarChar("@Password", passwordToStore ?? "", 500),
                NVarChar("@FromEmail", command.FromEmail ?? "", 254),
                NVarChar("@FromName", command.FromName ?? "", 200),
                Bit("@EnableSsl", command.EnableSsl),
                Bit("@IsEnabled", command.IsEnabled)
            ],
            cancellationToken).ConfigureAwait(false);

        return await GetSmtpSettingsAsync(businessId, cancellationToken).ConfigureAwait(false);
    }

    public async Task<TestSmtpConnectionResult> TestSmtpSettingsAsync(
        Guid businessId,
        TestSmtpConnectionCommand command,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(command.TargetEmail) || !command.TargetEmail.Contains('@'))
        {
            throw new FinancialRuleException("validation_failed", "Please enter a valid recipient email address for testing.");
        }

        const string sql = """
            SELECT Host, Port, Username, Password, FromEmail, FromName, EnableSsl
            FROM app.EmailConfigurations
            WHERE BusinessId = @BusinessId;
            """;

        var config = await baseDAL.ExecuteSingleAsync(
            businessId,
            "EmailConfigurations.GetForTest",
            sql,
            reader => new SmtpTestDetails(
                reader.GetString(0),
                reader.GetInt32(1),
                reader.GetString(2),
                reader.GetString(3),
                reader.GetString(4),
                reader.GetString(5),
                reader.GetBoolean(6)),
            [UniqueIdentifier("@BusinessId", businessId)],
            cancellationToken).ConfigureAwait(false);

        if (config is null || string.IsNullOrWhiteSpace(config.Host))
        {
            throw new FinancialRuleException("smtp_not_configured", "Configure and save your SMTP server details before sending a test email.");
        }

        try
        {
            await emailSender.SendTestEmailAsync(
                config.Host,
                config.Port,
                config.Username,
                config.Password,
                config.FromEmail,
                config.FromName,
                config.EnableSsl,
                command.TargetEmail,
                cancellationToken).ConfigureAwait(false);

            return new TestSmtpConnectionResult(true, $"Test email sent successfully to {command.TargetEmail}. Check your inbox!");
        }
        catch (Exception ex)
        {
            return new TestSmtpConnectionResult(false, $"SMTP Connection failed: {ex.Message}");
        }
    }

    private sealed record BusinessContact(string Name, string? Email);
    private sealed record SmtpTestDetails(string Host, int Port, string Username, string Password, string FromEmail, string FromName, bool EnableSsl);

    private static SqlParameter Int(string name, int value) => new(name, SqlDbType.Int) { Value = value };
    private static SqlParameter Bit(string name, bool value) => new(name, SqlDbType.Bit) { Value = value };
    private static SqlParameter UniqueIdentifier(string name, Guid value) => new(name, SqlDbType.UniqueIdentifier) { Value = value };
    private static SqlParameter Binary(string name, byte[] value, int size) => new(name, SqlDbType.Binary, size) { Value = value };
    private static SqlParameter VarChar(string name, string? value, int size) => new(name, SqlDbType.VarChar, size) { Value = value ?? (object)DBNull.Value };
    private static SqlParameter NVarChar(string name, string? value, int size) => new(name, SqlDbType.NVarChar, size) { Value = value ?? (object)DBNull.Value };
    private static SqlParameter Date(string name, DateOnly value) => new(name, SqlDbType.Date) { Value = value.ToDateTime(TimeOnly.MinValue) };
    private static SqlParameter DateTime2(string name, DateTime value) => new(name, SqlDbType.DateTime2) { Value = value, Scale = 3 };
    private static SqlParameter Decimal(string name, decimal value, byte precision, byte scale) => new(name, SqlDbType.Decimal) { Value = value, Precision = precision, Scale = scale };
}
