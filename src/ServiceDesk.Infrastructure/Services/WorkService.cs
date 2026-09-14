using System.Data;
using System.Net.Mail;
using Microsoft.Data.SqlClient;
using ServiceDesk.Application.Abstractions;
using ServiceDesk.Application.Work;
using ServiceDesk.Infrastructure.Data;

namespace ServiceDesk.Infrastructure.Services;

public sealed class WorkService(BaseDAL baseDAL, ITenantContextAccessor tenantContext) : IWorkStore
{
    public async Task<PageResult<CustomerRecord>> ListCustomersAsync(
        Guid businessId,
        string? search,
        bool includeArchived,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);
        const string sql = """
            SELECT
                c.Id, c.BusinessId, c.Name, c.CompanyName, c.Email, c.Phone,
                c.CustomerType, c.ArchivedAt, c.CreatedAt,
                l.AddressLine1, l.City, l.StateCode, l.PostalCode,
                COUNT(*) OVER() AS TotalCount
            FROM app.Customers AS c
            OUTER APPLY
            (
                SELECT TOP (1) AddressLine1, City, StateCode, PostalCode
                FROM app.Locations AS l
                WHERE l.BusinessId = c.BusinessId
                  AND l.CustomerId = c.Id
                  AND l.ArchivedAt IS NULL
                ORDER BY l.CreatedAt
            ) AS l
            WHERE c.BusinessId = @BusinessId
              AND (@IncludeArchived = 1 OR c.ArchivedAt IS NULL)
              AND (@Search IS NULL OR c.Name LIKE @Pattern OR c.Email LIKE @Pattern
                   OR c.Phone LIKE @Pattern OR l.AddressLine1 LIKE @Pattern)
            ORDER BY c.Name, c.Id
            OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY;
            """;

        var normalizedSearch = NullIfWhiteSpace(search);
        var rows = await baseDAL.ExecuteQueryAsync(
            businessId,
            "Customers.List",
            sql,
            reader => new CustomerRow(ReadCustomer(reader), reader.GetInt32(13)),
            [
                UniqueIdentifier("@BusinessId", businessId),
                Bit("@IncludeArchived", includeArchived),
                NVarChar("@Search", normalizedSearch, 200),
                NVarChar("@Pattern", normalizedSearch is null ? null : $"%{normalizedSearch}%", 204),
                Int("@Offset", (page - 1) * pageSize),
                Int("@PageSize", pageSize)
            ],
            cancellationToken);

        return new PageResult<CustomerRecord>(rows.Select(row => row.Value).ToArray(), rows.Count == 0 ? 0 : rows[0].Total, page, pageSize);
    }

    public Task<CustomerRecord?> GetCustomerAsync(
        Guid businessId,
        Guid customerId,
        CancellationToken cancellationToken = default)
    {
        const string sql = """
            SELECT TOP (1)
                c.Id, c.BusinessId, c.Name, c.CompanyName, c.Email, c.Phone,
                c.CustomerType, c.ArchivedAt, c.CreatedAt,
                l.AddressLine1, l.City, l.StateCode, l.PostalCode
            FROM app.Customers AS c
            OUTER APPLY
            (
                SELECT TOP (1) AddressLine1, City, StateCode, PostalCode
                FROM app.Locations AS l
                WHERE l.BusinessId = c.BusinessId
                  AND l.CustomerId = c.Id
                  AND l.ArchivedAt IS NULL
                ORDER BY l.CreatedAt
            ) AS l
            WHERE c.BusinessId = @BusinessId AND c.Id = @CustomerId;
            """;

        return baseDAL.ExecuteSingleAsync(
            businessId,
            "Customers.Get",
            sql,
            ReadCustomer,
            [UniqueIdentifier("@BusinessId", businessId), UniqueIdentifier("@CustomerId", customerId)],
            cancellationToken);
    }

    public async Task<CustomerRecord> CreateCustomerAsync(
        Guid businessId,
        CreateCustomerCommand command,
        CancellationToken cancellationToken = default)
    {
        ValidateCustomer(command);
        var customerId = Guid.NewGuid();
        var locationId = Guid.NewGuid();
        const string sql = """
            INSERT app.Customers
                (BusinessId, Id, Name, CompanyName, Email, Phone, CustomerType)
            VALUES
                (@BusinessId, @CustomerId, @Name, @CompanyName, @Email, @Phone, @CustomerType);

            INSERT app.Locations
                (BusinessId, Id, CustomerId, Label, AddressLine1, City, StateCode, PostalCode)
            VALUES
                (@BusinessId, @LocationId, @CustomerId, N'Primary', @AddressLine1, @City, @StateCode, @PostalCode);
            """;

        await baseDAL.ExecuteInTransactionAsync(
            businessId,
            "Customers.Create",
            async (connection, transaction, token) =>
            {
                await using var sqlCommand = BaseDAL.BuildCommand(connection, transaction, sql, parameters:
                [
                    UniqueIdentifier("@BusinessId", businessId),
                    UniqueIdentifier("@CustomerId", customerId),
                    UniqueIdentifier("@LocationId", locationId),
                    NVarChar("@Name", command.Name.Trim(), 200),
                    NVarChar("@CompanyName", NullIfWhiteSpace(command.CompanyName), 200),
                    NVarChar("@Email", NullIfWhiteSpace(command.Email), 254),
                    NVarChar("@Phone", command.Phone.Trim(), 32),
                    VarChar("@CustomerType", command.CustomerType, 32),
                    NVarChar("@AddressLine1", command.AddressLine1.Trim(), 200),
                    NVarChar("@City", command.City.Trim(), 100),
                    Char("@StateCode", command.StateCode.Trim().ToUpperInvariant(), 2),
                    NVarChar("@PostalCode", command.PostalCode.Trim(), 10)
                ]);
                await sqlCommand.ExecuteNonQueryAsync(token).ConfigureAwait(false);
                return true;
            },
            cancellationToken: cancellationToken);

        return await GetCustomerAsync(businessId, customerId, cancellationToken).ConfigureAwait(false)
            ?? throw new WorkRuleException("resource_not_found", "The created customer could not be read.");
    }

    public async Task<PageResult<JobRecord>> ListJobsAsync(
        Guid businessId,
        string? search,
        string? status,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);
        const string sql = """
            SELECT
                j.Id, j.BusinessId, j.CustomerId, j.JobNumber, j.Title, j.Description,
                j.Status, j.Priority, a.StartsAt, a.EndsAt, ja.MemberId,
                COALESCE(t.Total, 0), j.CreatedAt, COUNT(*) OVER() AS TotalCount
            FROM app.Jobs AS j
            OUTER APPLY
            (
                SELECT TOP (1) StartsAt, EndsAt
                FROM app.Appointments AS a
                WHERE a.BusinessId = j.BusinessId AND a.JobId = j.Id AND a.Status = 'Scheduled'
                ORDER BY StartsAt
            ) AS a
            OUTER APPLY
            (
                SELECT TOP (1) MemberId
                FROM app.JobAssignments AS ja
                WHERE ja.BusinessId = j.BusinessId AND ja.JobId = j.Id AND ja.IsActive = 1
                ORDER BY CreatedAt
            ) AS ja
            OUTER APPLY
            (
                SELECT SUM(LineTotal) AS Total
                FROM app.JobItems AS i
                WHERE i.BusinessId = j.BusinessId AND i.JobId = j.Id
            ) AS t
            WHERE j.BusinessId = @BusinessId
              AND (@Status IS NULL OR j.Status = @Status)
              AND (@Search IS NULL OR j.JobNumber LIKE @Pattern OR j.Title LIKE @Pattern)
            ORDER BY j.CreatedAt DESC
            OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY;
            """;

        var normalizedSearch = NullIfWhiteSpace(search);
        var rows = await baseDAL.ExecuteQueryAsync(
            businessId,
            "Jobs.List",
            sql,
            reader => new JobRow(ReadJob(reader), reader.GetInt32(13)),
            [
                UniqueIdentifier("@BusinessId", businessId),
                VarChar("@Status", NullIfWhiteSpace(status), 32),
                NVarChar("@Search", normalizedSearch, 200),
                NVarChar("@Pattern", normalizedSearch is null ? null : $"%{normalizedSearch}%", 204),
                Int("@Offset", (page - 1) * pageSize),
                Int("@PageSize", pageSize)
            ],
            cancellationToken);

        return new PageResult<JobRecord>(rows.Select(row => row.Value).ToArray(), rows.Count == 0 ? 0 : rows[0].Total, page, pageSize);
    }

    public Task<JobRecord?> GetJobAsync(Guid businessId, Guid jobId, CancellationToken cancellationToken = default)
    {
        const string sql = """
            SELECT TOP (1)
                j.Id, j.BusinessId, j.CustomerId, j.JobNumber, j.Title, j.Description,
                j.Status, j.Priority, a.StartsAt, a.EndsAt, ja.MemberId,
                COALESCE(t.Total, 0), j.CreatedAt
            FROM app.Jobs AS j
            OUTER APPLY
            (
                SELECT TOP (1) StartsAt, EndsAt
                FROM app.Appointments AS a
                WHERE a.BusinessId = j.BusinessId AND a.JobId = j.Id AND a.Status = 'Scheduled'
                ORDER BY StartsAt
            ) AS a
            OUTER APPLY
            (
                SELECT TOP (1) MemberId
                FROM app.JobAssignments AS ja
                WHERE ja.BusinessId = j.BusinessId AND ja.JobId = j.Id AND ja.IsActive = 1
                ORDER BY CreatedAt
            ) AS ja
            OUTER APPLY
            (
                SELECT SUM(LineTotal) AS Total
                FROM app.JobItems AS i
                WHERE i.BusinessId = j.BusinessId AND i.JobId = j.Id
            ) AS t
            WHERE j.BusinessId = @BusinessId AND j.Id = @JobId;
            """;

        return baseDAL.ExecuteSingleAsync(
            businessId,
            "Jobs.Get",
            sql,
            ReadJob,
            [UniqueIdentifier("@BusinessId", businessId), UniqueIdentifier("@JobId", jobId)],
            cancellationToken);
    }

    public async Task<JobRecord> CreateJobAsync(
        Guid businessId,
        CreateJobCommand command,
        int jobsPerPeriodLimit,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(command.Title) || command.Priority is not ("Normal" or "High" or "Emergency"))
        {
            throw new WorkRuleException("validation_failed", "A title and valid priority are required.");
        }

        var memberId = tenantContext.Current?.MemberId
            ?? throw new WorkRuleException("membership_required", "An active membership is required.");
        var jobId = Guid.NewGuid();
        var appointment = AppointmentWindow.Parse(command.ScheduledDate, command.ArrivalWindow);
        var startsAt = appointment?.StartsAt;
        var assignedMemberId = command.AssignedMemberId ?? (startsAt.HasValue ? memberId : null);

        const string sql = """
            IF NOT EXISTS
            (
                SELECT 1 FROM app.Customers WITH (UPDLOCK, HOLDLOCK)
                WHERE BusinessId = @BusinessId AND Id = @CustomerId AND ArchivedAt IS NULL
            )
                THROW 51020, 'customer_not_found', 1;

            DECLARE @Limit bigint =
            (
                SELECT TOP (1) pe.LimitValue
                FROM app.Subscriptions AS s
                INNER JOIN platform.PlanEntitlements AS pe ON pe.PlanId = s.PlanId
                WHERE s.BusinessId = @BusinessId AND s.IsCurrent = 1
                  AND s.Status IN ('Trialing', 'Active', 'PastDue')
                  AND pe.FeatureCode = N'jobs.per_period' AND pe.Enabled = 1
            );
            SET @Limit = COALESCE(@Limit, @FallbackLimit);

            IF
            (
                SELECT COUNT(*) FROM app.Jobs WITH (UPDLOCK, HOLDLOCK)
                WHERE BusinessId = @BusinessId
                  AND CreatedAt >= DATEFROMPARTS(YEAR(SYSUTCDATETIME()), MONTH(SYSUTCDATETIME()), 1)
            ) >= @Limit
                THROW 51021, 'plan_limit_reached', 1;

            DECLARE @Next bigint;
            SELECT @Next = NextValue
            FROM app.NumberSequences WITH (UPDLOCK, HOLDLOCK)
            WHERE BusinessId = @BusinessId AND DocumentType = N'Job';

            IF @Next IS NULL
            BEGIN
                SET @Next = 1;
                INSERT app.NumberSequences (BusinessId, DocumentType, NextValue, Prefix)
                VALUES (@BusinessId, N'Job', 2, N'J-');
            END
            ELSE
            BEGIN
                UPDATE app.NumberSequences
                SET NextValue = NextValue + 1, UpdatedAt = SYSUTCDATETIME()
                WHERE BusinessId = @BusinessId AND DocumentType = N'Job';
            END;

            INSERT app.Jobs
                (BusinessId, Id, CustomerId, JobNumber, Title, Description, Status, Priority, CreatedByMemberId)
            VALUES
                (@BusinessId, @JobId, @CustomerId,
                 N'J-' + RIGHT(N'0000' + CONVERT(nvarchar(20), @Next), 4),
                 @Title, @Description, @Status, @Priority, @MemberId);

            IF @AssignedMemberId IS NOT NULL
                INSERT app.JobAssignments (BusinessId, JobId, MemberId)
                VALUES (@BusinessId, @JobId, @AssignedMemberId);

            IF @StartsAt IS NOT NULL
                INSERT app.Appointments (BusinessId, JobId, StartsAt, EndsAt)
                VALUES (@BusinessId, @JobId, @StartsAt, @EndsAt);
            """;

        try
        {
            await baseDAL.ExecuteInTransactionAsync(
                businessId,
                "Jobs.Create",
                async (connection, transaction, token) =>
                {
                    await using var sqlCommand = BaseDAL.BuildCommand(connection, transaction, sql, parameters:
                    [
                        UniqueIdentifier("@BusinessId", businessId),
                        UniqueIdentifier("@JobId", jobId),
                        UniqueIdentifier("@CustomerId", command.CustomerId),
                        BigInt("@FallbackLimit", jobsPerPeriodLimit),
                        NVarChar("@Title", command.Title.Trim(), 200),
                        NVarChar("@Description", NullIfWhiteSpace(command.Description), -1),
                        VarChar("@Status", startsAt.HasValue ? "Scheduled" : "Draft", 32),
                        VarChar("@Priority", command.Priority, 32),
                        UniqueIdentifier("@MemberId", memberId),
                        UniqueIdentifier("@AssignedMemberId", assignedMemberId),
                        DateTime2("@StartsAt", startsAt),
                        DateTime2("@EndsAt", appointment?.EndsAt)
                    ]);
                    await sqlCommand.ExecuteNonQueryAsync(token).ConfigureAwait(false);
                    return true;
                },
                IsolationLevel.Serializable,
                cancellationToken);
        }
        catch (DataAccessException exception) when (exception.InnerException is SqlException { Number: 51020 })
        {
            throw new WorkRuleException("customer_not_found", "The customer was not found.");
        }
        catch (DataAccessException exception) when (exception.InnerException is SqlException { Number: 51021 })
        {
            throw new WorkRuleException("plan_limit_reached", "The jobs-per-period plan limit has been reached.");
        }

        return await GetJobAsync(businessId, jobId, cancellationToken).ConfigureAwait(false)
            ?? throw new WorkRuleException("resource_not_found", "The created job could not be read.");
    }

    public async Task<JobRecord> ChangeJobStatusAsync(
        Guid businessId,
        Guid jobId,
        ChangeJobStatusCommand command,
        CancellationToken cancellationToken = default)
    {
        var member = tenantContext.Current
            ?? throw new WorkRuleException("membership_required", "An active membership is required.");
        var targetStatus = command.Status?.Trim();
        if (targetStatus is not ("Scheduled" or "InProgress" or "OnHold" or "Completed" or "Cancelled"))
        {
            throw new WorkRuleException("validation_failed", "The requested job status is invalid.");
        }

        await baseDAL.ExecuteInTransactionAsync(
            businessId,
            "Jobs.ChangeStatus",
            async (connection, transaction, token) =>
            {
                const string selectSql = """
                    SELECT Status,
                           (SELECT COUNT(*) FROM app.Appointments AS a WHERE a.BusinessId = j.BusinessId AND a.JobId = j.Id AND a.Status = 'Scheduled') AS AppointmentCount,
                           (SELECT COUNT(*) FROM app.JobItems AS i WHERE i.BusinessId = j.BusinessId AND i.JobId = j.Id) AS ItemCount
                    FROM app.Jobs AS j WITH (UPDLOCK, HOLDLOCK)
                    WHERE j.BusinessId = @BusinessId AND j.Id = @JobId;
                    """;
                string currentStatus;
                int appointmentCount;
                int itemCount;
                await using (var select = BaseDAL.BuildCommand(connection, transaction, selectSql, parameters:
                [UniqueIdentifier("@BusinessId", businessId), UniqueIdentifier("@JobId", jobId)]))
                await using (var reader = await select.ExecuteReaderAsync(token).ConfigureAwait(false))
                {
                    if (!await reader.ReadAsync(token).ConfigureAwait(false))
                    {
                        throw new WorkRuleException("resource_not_found", "The requested resource was not found.");
                    }

                    currentStatus = reader.GetString(0);
                    appointmentCount = reader.GetInt32(1);
                    itemCount = reader.GetInt32(2);
                }

                if (!IsAllowedTransition(currentStatus, targetStatus))
                {
                    throw new WorkRuleException("invalid_transition", $"A {currentStatus} job cannot change to {targetStatus}.");
                }

                if (targetStatus == "Scheduled" && appointmentCount == 0)
                {
                    throw new WorkRuleException("schedule_required", "Add an appointment before scheduling the job.");
                }

                if (targetStatus == "Completed" && itemCount == 0)
                {
                    throw new WorkRuleException("job_items_required", "Add the completed services or parts before completing the job.");
                }

                if ((targetStatus == "Cancelled" || currentStatus == "Completed") && string.IsNullOrWhiteSpace(command.Reason))
                {
                    throw new WorkRuleException("reason_required", "A reason is required for this status change.");
                }

                const string updateSql = """
                    IF @Status = 'InProgress' AND NOT EXISTS
                    (
                        SELECT 1 FROM app.JobAssignments
                        WHERE BusinessId = @BusinessId AND JobId = @JobId AND IsActive = 1
                    )
                    BEGIN
                        INSERT app.JobAssignments (BusinessId, JobId, MemberId)
                        VALUES (@BusinessId, @JobId, @MemberId);
                    END;

                    UPDATE app.Jobs
                    SET Status = @Status,
                        CompletedAt = CASE WHEN @Status = 'Completed' THEN SYSUTCDATETIME() ELSE NULL END,
                        CancelledAt = CASE WHEN @Status = 'Cancelled' THEN SYSUTCDATETIME() ELSE NULL END,
                        UpdatedAt = SYSUTCDATETIME()
                    WHERE BusinessId = @BusinessId AND Id = @JobId;

                    INSERT app.AuditEvents
                        (BusinessId, ActorUserId, Action, EntityType, EntityId, CorrelationId, Changes)
                    VALUES
                        (@BusinessId, @UserId, N'job.status_changed', N'Job', @JobId,
                         CONVERT(nvarchar(100), NEWID()),
                         CONCAT(N'{"from":"', @CurrentStatus, N'","to":"', @Status, N'"}'));
                    """;
                await using var update = BaseDAL.BuildCommand(connection, transaction, updateSql, parameters:
                [
                    UniqueIdentifier("@BusinessId", businessId),
                    UniqueIdentifier("@JobId", jobId),
                    UniqueIdentifier("@MemberId", member.MemberId),
                    UniqueIdentifier("@UserId", member.UserId),
                    VarChar("@CurrentStatus", currentStatus, 32),
                    VarChar("@Status", targetStatus, 32)
                ]);
                await update.ExecuteNonQueryAsync(token).ConfigureAwait(false);
                return true;
            },
            IsolationLevel.Serializable,
            cancellationToken);

        return await GetJobAsync(businessId, jobId, cancellationToken).ConfigureAwait(false)
            ?? throw new WorkRuleException("resource_not_found", "The updated job could not be read.");
    }

    public async Task<PageResult<CatalogItemRecord>> ListCatalogItemsAsync(
        Guid businessId,
        string? search,
        string? itemType,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);
        const string sql = """
            SELECT Id, BusinessId, ItemType, Name, Unit, UnitCost, UnitPrice,
                   TaxCategory, ArchivedAt, COUNT(*) OVER() AS TotalCount
            FROM app.CatalogItems
            WHERE BusinessId = @BusinessId AND ArchivedAt IS NULL
              AND (@ItemType IS NULL OR ItemType = @ItemType)
              AND (@Search IS NULL OR Name LIKE @Pattern)
            ORDER BY Name
            OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY;
            """;

        var normalizedSearch = NullIfWhiteSpace(search);
        var rows = await baseDAL.ExecuteQueryAsync(
            businessId,
            "Catalog.List",
            sql,
            reader => new CatalogRow(ReadCatalogItem(reader), reader.GetInt32(9)),
            [
                UniqueIdentifier("@BusinessId", businessId),
                VarChar("@ItemType", NullIfWhiteSpace(itemType), 32),
                NVarChar("@Search", normalizedSearch, 200),
                NVarChar("@Pattern", normalizedSearch is null ? null : $"%{normalizedSearch}%", 204),
                Int("@Offset", (page - 1) * pageSize),
                Int("@PageSize", pageSize)
            ],
            cancellationToken);

        return new PageResult<CatalogItemRecord>(rows.Select(row => row.Value).ToArray(), rows.Count == 0 ? 0 : rows[0].Total, page, pageSize);
    }

    public async Task<CatalogItemRecord> CreateCatalogItemAsync(
        Guid businessId,
        CreateCatalogItemCommand command,
        CancellationToken cancellationToken = default)
    {
        ValidateCatalogItem(command);
        var itemId = Guid.NewGuid();
        const string insertSql = """
            INSERT app.CatalogItems
                (BusinessId, Id, ItemType, Name, Unit, UnitCost, UnitPrice, TaxCategory)
            VALUES
                (@BusinessId, @ItemId, @ItemType, @Name, @Unit, @UnitCost, @UnitPrice, @TaxCategory);
            """;

        await baseDAL.ExecuteNonQueryAsync(
            businessId,
            "Catalog.Create",
            insertSql,
            [
                UniqueIdentifier("@BusinessId", businessId),
                UniqueIdentifier("@ItemId", itemId),
                VarChar("@ItemType", command.ItemType, 32),
                NVarChar("@Name", command.Name.Trim(), 200),
                NVarChar("@Unit", command.Unit.Trim(), 32),
                Decimal("@UnitCost", command.UnitCost, 19, 2),
                Decimal("@UnitPrice", command.UnitPrice, 19, 4),
                NVarChar("@TaxCategory", NullIfWhiteSpace(command.TaxCategory), 80)
            ],
            cancellationToken);

        const string selectSql = """
            SELECT TOP (1) Id, BusinessId, ItemType, Name, Unit, UnitCost, UnitPrice, TaxCategory, ArchivedAt
            FROM app.CatalogItems
            WHERE BusinessId = @BusinessId AND Id = @ItemId;
            """;
        return await baseDAL.ExecuteSingleAsync(
            businessId,
            "Catalog.Get",
            selectSql,
            ReadCatalogItem,
            [UniqueIdentifier("@BusinessId", businessId), UniqueIdentifier("@ItemId", itemId)],
            cancellationToken).ConfigureAwait(false)
            ?? throw new WorkRuleException("resource_not_found", "The created catalog item could not be read.");
    }

    public async Task<JobItemSet> GetJobItemsAsync(Guid businessId, Guid jobId, CancellationToken cancellationToken = default)
    {
        await EnsureJobExistsAsync(businessId, jobId, cancellationToken).ConfigureAwait(false);
        return await ReadJobItemsAsync(businessId, jobId, cancellationToken).ConfigureAwait(false);
    }

    public async Task<JobItemSet> ReplaceJobItemsAsync(
        Guid businessId,
        Guid jobId,
        IReadOnlyList<ReplaceJobItemCommand> commands,
        CancellationToken cancellationToken = default)
    {
        foreach (var command in commands)
        {
            ValidateJobItem(command);
        }

        try
        {
            await baseDAL.ExecuteInTransactionAsync(
                businessId,
                "JobItems.Replace",
                async (connection, transaction, token) =>
                {
                    const string lockSql = """
                        SELECT Status
                        FROM app.Jobs WITH (UPDLOCK, HOLDLOCK)
                        WHERE BusinessId = @BusinessId AND Id = @JobId;
                        """;
                    await using (var lockCommand = BaseDAL.BuildCommand(connection, transaction, lockSql, parameters:
                    [UniqueIdentifier("@BusinessId", businessId), UniqueIdentifier("@JobId", jobId)]))
                    {
                        var status = await lockCommand.ExecuteScalarAsync(token).ConfigureAwait(false) as string;
                        if (status is null)
                        {
                            throw new WorkRuleException("resource_not_found", "The requested resource was not found.");
                        }

                        if (status is "Completed" or "Cancelled")
                        {
                            throw new WorkRuleException("job_locked", "Completed or cancelled job items cannot be changed.");
                        }
                    }

                    const string deleteSql = "DELETE app.JobItems WHERE BusinessId = @BusinessId AND JobId = @JobId;";
                    await using (var deleteCommand = BaseDAL.BuildCommand(connection, transaction, deleteSql, parameters:
                    [UniqueIdentifier("@BusinessId", businessId), UniqueIdentifier("@JobId", jobId)]))
                    {
                        await deleteCommand.ExecuteNonQueryAsync(token).ConfigureAwait(false);
                    }

                    const string insertSql = """
                        IF @CatalogItemId IS NOT NULL AND NOT EXISTS
                        (
                            SELECT 1 FROM app.CatalogItems
                            WHERE BusinessId = @BusinessId AND Id = @CatalogItemId AND ArchivedAt IS NULL
                        )
                            THROW 51022, 'catalog_item_not_found', 1;

                        INSERT app.JobItems
                            (BusinessId, JobId, CatalogItemId, ItemType, Description, Quantity,
                             Unit, UnitPrice, DiscountAmount, TaxAmount, SortOrder)
                        VALUES
                            (@BusinessId, @JobId, @CatalogItemId, @ItemType, @Description, @Quantity,
                             @Unit, @UnitPrice, @DiscountAmount, @TaxAmount, @SortOrder);
                        """;

                    for (var index = 0; index < commands.Count; index++)
                    {
                        var item = commands[index];
                        await using var insertCommand = BaseDAL.BuildCommand(connection, transaction, insertSql, parameters:
                        [
                            UniqueIdentifier("@BusinessId", businessId),
                            UniqueIdentifier("@JobId", jobId),
                            UniqueIdentifier("@CatalogItemId", item.CatalogItemId),
                            VarChar("@ItemType", item.ItemType, 32),
                            NVarChar("@Description", item.Description.Trim(), 500),
                            Decimal("@Quantity", item.Quantity, 12, 3),
                            NVarChar("@Unit", item.Unit.Trim(), 32),
                            Decimal("@UnitPrice", item.UnitPrice, 19, 4),
                            Decimal("@DiscountAmount", item.DiscountAmount, 19, 2),
                            Decimal("@TaxAmount", item.TaxAmount, 19, 2),
                            Int("@SortOrder", index)
                        ]);
                        await insertCommand.ExecuteNonQueryAsync(token).ConfigureAwait(false);
                    }

                    return true;
                },
                cancellationToken: cancellationToken);
        }
        catch (DataAccessException exception) when (exception.InnerException is SqlException { Number: 51022 })
        {
            throw new WorkRuleException("catalog_item_not_found", "A selected catalog item was not found.");
        }

        return await ReadJobItemsAsync(businessId, jobId, cancellationToken).ConfigureAwait(false);
    }

    private async Task EnsureJobExistsAsync(Guid businessId, Guid jobId, CancellationToken cancellationToken)
    {
        const string sql = "SELECT COUNT(*) FROM app.Jobs WHERE BusinessId = @BusinessId AND Id = @JobId;";
        var count = await baseDAL.ExecuteScalarAsync<int>(
            businessId,
            "Jobs.Exists",
            sql,
            [UniqueIdentifier("@BusinessId", businessId), UniqueIdentifier("@JobId", jobId)],
            cancellationToken);
        if (count == 0)
        {
            throw new WorkRuleException("resource_not_found", "The requested resource was not found.");
        }
    }

    private async Task<JobItemSet> ReadJobItemsAsync(Guid businessId, Guid jobId, CancellationToken cancellationToken)
    {
        const string sql = """
            SELECT Id, BusinessId, JobId, CatalogItemId, ItemType, Description, Quantity,
                   Unit, UnitPrice, DiscountAmount, TaxAmount, SortOrder, LineTotal
            FROM app.JobItems
            WHERE BusinessId = @BusinessId AND JobId = @JobId
            ORDER BY SortOrder;
            """;
        var items = await baseDAL.ExecuteQueryAsync(
            businessId,
            "JobItems.List",
            sql,
            ReadJobItem,
            [UniqueIdentifier("@BusinessId", businessId), UniqueIdentifier("@JobId", jobId)],
            cancellationToken);
        return Totals(items);
    }

    private static CustomerRecord ReadCustomer(SqlDataReader reader) => new(
        reader.GetGuid(0), reader.GetGuid(1), reader.GetString(2),
        reader.IsDBNull(3) ? null : reader.GetString(3),
        reader.IsDBNull(4) ? null : reader.GetString(4),
        reader.IsDBNull(5) ? string.Empty : reader.GetString(5),
        reader.GetString(6),
        reader.IsDBNull(9) ? string.Empty : reader.GetString(9),
        reader.IsDBNull(10) ? string.Empty : reader.GetString(10),
        reader.IsDBNull(11) ? string.Empty : reader.GetString(11),
        reader.IsDBNull(12) ? string.Empty : reader.GetString(12),
        !reader.IsDBNull(7),
        AsUtcOffset(reader.GetDateTime(8)));

    private static JobRecord ReadJob(SqlDataReader reader)
    {
        var startsAt = reader.IsDBNull(8) ? (DateTime?)null : reader.GetDateTime(8);
        var endsAt = reader.IsDBNull(9) ? (DateTime?)null : reader.GetDateTime(9);
        return new JobRecord(
            reader.GetGuid(0), reader.GetGuid(1), reader.GetGuid(2), reader.GetString(3),
            reader.GetString(4), reader.IsDBNull(5) ? null : reader.GetString(5),
            reader.GetString(6), reader.GetString(7),
            startsAt.HasValue ? DateOnly.FromDateTime(startsAt.Value) : null,
            startsAt.HasValue && endsAt.HasValue ? $"{startsAt:h:mm tt} – {endsAt:h:mm tt}" : null,
            reader.IsDBNull(10) ? null : reader.GetGuid(10), reader.GetDecimal(11),
            AsUtcOffset(reader.GetDateTime(12)));
    }

    private static CatalogItemRecord ReadCatalogItem(SqlDataReader reader) => new(
        reader.GetGuid(0), reader.GetGuid(1), reader.GetString(2), reader.GetString(3),
        reader.GetString(4), reader.GetDecimal(5), reader.GetDecimal(6),
        reader.IsDBNull(7) ? null : reader.GetString(7), !reader.IsDBNull(8));

    private static JobItemRecord ReadJobItem(SqlDataReader reader) => new(
        reader.GetGuid(0), reader.GetGuid(1), reader.GetGuid(2),
        reader.IsDBNull(3) ? null : reader.GetGuid(3), reader.GetString(4), reader.GetString(5),
        reader.GetDecimal(6), reader.GetString(7), reader.GetDecimal(8), reader.GetDecimal(9),
        reader.GetDecimal(10), reader.GetInt32(11), reader.GetDecimal(12));

    private static JobItemSet Totals(IReadOnlyList<JobItemRecord> items) => new(
        items,
        items.Sum(item => Math.Round(item.Quantity * item.UnitPrice, 2)),
        items.Sum(item => item.DiscountAmount),
        items.Sum(item => item.TaxAmount),
        items.Sum(item => item.LineTotal));

    private static DateTimeOffset AsUtcOffset(DateTime value) =>
        new(DateTime.SpecifyKind(value, DateTimeKind.Utc));

    private static void ValidateCustomer(CreateCustomerCommand command)
    {
        if (string.IsNullOrWhiteSpace(command.Name) || string.IsNullOrWhiteSpace(command.Phone)
            || string.IsNullOrWhiteSpace(command.AddressLine1) || string.IsNullOrWhiteSpace(command.City)
            || command.StateCode.Trim().Length != 2 || string.IsNullOrWhiteSpace(command.PostalCode))
        {
            throw new WorkRuleException("validation_failed", "Name, phone, service address, city, two-letter state, and ZIP are required.");
        }

        if (command.CustomerType is not ("Residential" or "Commercial"))
        {
            throw new WorkRuleException("validation_failed", "Customer type is invalid.");
        }

        if (!string.IsNullOrWhiteSpace(command.Email) &&
            (command.Email.Length > 254 || !MailAddress.TryCreate(command.Email.Trim(), out var parsedEmail) ||
             !string.Equals(parsedEmail.Address, command.Email.Trim(), StringComparison.OrdinalIgnoreCase)))
        {
            throw new WorkRuleException("validation_failed", "Email address is invalid.");
        }
    }

    private static bool IsAllowedTransition(string currentStatus, string targetStatus) =>
        (currentStatus, targetStatus) switch
        {
            ("Draft", "Scheduled") or ("Draft", "Cancelled") => true,
            ("Scheduled", "InProgress") or ("Scheduled", "OnHold") or ("Scheduled", "Cancelled") => true,
            ("InProgress", "OnHold") or ("InProgress", "Completed") or ("InProgress", "Cancelled") => true,
            ("OnHold", "Scheduled") or ("OnHold", "InProgress") or ("OnHold", "Cancelled") => true,
            ("Completed", "InProgress") => true,
            _ => false
        };

    private static void ValidateCatalogItem(CreateCatalogItemCommand command)
    {
        if (string.IsNullOrWhiteSpace(command.Name) || string.IsNullOrWhiteSpace(command.Unit)
            || command.UnitCost < 0 || command.UnitPrice < 0
            || command.ItemType is not ("Service" or "Labor" or "Part"))
        {
            throw new WorkRuleException("validation_failed", "Type, name, unit, and non-negative prices are required.");
        }
    }

    private static void ValidateJobItem(ReplaceJobItemCommand command)
    {
        if (command.Quantity <= 0 || command.UnitPrice < 0 || command.DiscountAmount < 0
            || command.TaxAmount < 0 || command.DiscountAmount > Math.Round(command.Quantity * command.UnitPrice, 2)
            || string.IsNullOrWhiteSpace(command.Description) || string.IsNullOrWhiteSpace(command.Unit)
            || command.ItemType is not ("Service" or "Labor" or "Part"))
        {
            throw new WorkRuleException("validation_failed", "Each item requires valid values.");
        }
    }

    private static string? NullIfWhiteSpace(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static SqlParameter UniqueIdentifier(string name, Guid? value) =>
        new(name, SqlDbType.UniqueIdentifier) { Value = value.HasValue ? value.Value : DBNull.Value };

    private static SqlParameter NVarChar(string name, string? value, int size) =>
        new(name, SqlDbType.NVarChar, size) { Value = value ?? (object)DBNull.Value };

    private static SqlParameter VarChar(string name, string? value, int size) =>
        new(name, SqlDbType.VarChar, size) { Value = value ?? (object)DBNull.Value };

    private static SqlParameter Char(string name, string value, int size) =>
        new(name, SqlDbType.Char, size) { Value = value };

    private static SqlParameter Int(string name, int value) => new(name, SqlDbType.Int) { Value = value };
    private static SqlParameter BigInt(string name, long value) => new(name, SqlDbType.BigInt) { Value = value };
    private static SqlParameter Bit(string name, bool value) => new(name, SqlDbType.Bit) { Value = value };

    private static SqlParameter Decimal(string name, decimal value, byte precision, byte scale) =>
        new(name, SqlDbType.Decimal) { Value = value, Precision = precision, Scale = scale };

    private static SqlParameter DateTime2(string name, DateTime? value) =>
        new(name, SqlDbType.DateTime2) { Value = value ?? (object)DBNull.Value, Scale = 3 };

    private sealed record CustomerRow(CustomerRecord Value, int Total);
    private sealed record JobRow(JobRecord Value, int Total);
    private sealed record CatalogRow(CatalogItemRecord Value, int Total);
}
