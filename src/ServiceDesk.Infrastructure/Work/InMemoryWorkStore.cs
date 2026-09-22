using System.Net.Mail;
using ServiceDesk.Application.Work;

namespace ServiceDesk.Infrastructure.Work;

public sealed class InMemoryWorkStore : IWorkStore
{
    private readonly object gate = new();
    private readonly List<CustomerRecord> customers = [];
    private readonly List<JobRecord> jobs = [];
    private readonly Dictionary<Guid, int> jobSequences = [];
    private readonly List<CatalogItemRecord> catalogItems = [];
    private readonly List<JobItemRecord> jobItems = [];

    public InMemoryWorkStore()
    {
        var businessId = Guid.Parse("11111111-1111-1111-1111-111111111111");
        var memberId = Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
        var sarah = SeedCustomer(businessId, "Sarah Miller", "sarah@example.com", "(512) 555-0142", "2401 Lakeview Dr", "Austin", "TX", "78703");
        var michael = SeedCustomer(businessId, "Michael Brown", "michael@example.com", "(512) 555-0188", "88 Congress Ave", "Austin", "TX", "78701");
        SeedCustomer(businessId, "Olivia Davis", "olivia@example.com", "(737) 555-0106", "711 West 6th St", "Austin", "TX", "78703");
        jobs.Add(new JobRecord(Guid.NewGuid(), businessId, sarah.Id, "J-1084", "Water heater inspection", "Inspect pressure and temperature controls.", "InProgress", "Normal", new DateOnly(2026, 9, 10), "9:00 AM – 10:30 AM", memberId, 125m, DateTimeOffset.UtcNow));
        jobs.Add(new JobRecord(Guid.NewGuid(), businessId, michael.Id, "J-1085", "Kitchen drain repair", null, "Scheduled", "Normal", new DateOnly(2026, 9, 10), "11:30 AM – 1:00 PM", memberId, 425m, DateTimeOffset.UtcNow));
        jobSequences[businessId] = 1086;
        catalogItems.Add(new(Guid.NewGuid(), businessId, "Service", "Diagnostic visit", "visit", 0m, 125m, null, false));
        catalogItems.Add(new(Guid.NewGuid(), businessId, "Service", "Drain cleaning", "service", 0m, 285m, null, false));
        catalogItems.Add(new(Guid.NewGuid(), businessId, "Part", "Temperature relief valve", "each", 31.50m, 68m, "TX-TAXABLE", false));
        catalogItems.Add(new(Guid.NewGuid(), businessId, "Part", "Brake pad set", "set", 72m, 139m, "TX-TAXABLE", false));
    }

    public Task<PageResult<CustomerRecord>> ListCustomersAsync(Guid businessId, string? search, bool includeArchived, int page, int pageSize, CancellationToken cancellationToken = default)
    {
        lock (gate)
        {
            var query = customers.Where(x => x.BusinessId == businessId && (includeArchived || !x.IsArchived));
            if (!string.IsNullOrWhiteSpace(search))
            {
                query = query.Where(x => Contains(x.Name, search) || Contains(x.Email, search) || Contains(x.Phone, search) || Contains(x.AddressLine1, search));
            }
            return Task.FromResult(Page(query.OrderBy(x => x.Name), page, pageSize));
        }
    }

    public Task<CustomerRecord?> GetCustomerAsync(Guid businessId, Guid customerId, CancellationToken cancellationToken = default)
    {
        lock (gate) return Task.FromResult(customers.FirstOrDefault(x => x.BusinessId == businessId && x.Id == customerId));
    }

    public Task<CustomerRecord> CreateCustomerAsync(Guid businessId, CreateCustomerCommand command, CancellationToken cancellationToken = default)
    {
        ValidateCustomer(command);
        var customer = new CustomerRecord(Guid.NewGuid(), businessId, command.Name.Trim(), NullIfWhiteSpace(command.CompanyName), NullIfWhiteSpace(command.Email), command.Phone.Trim(), command.CustomerType, command.AddressLine1.Trim(), command.City.Trim(), command.StateCode.Trim().ToUpperInvariant(), command.PostalCode.Trim(), false, DateTimeOffset.UtcNow);
        lock (gate) customers.Add(customer);
        return Task.FromResult(customer);
    }

    public Task<PageResult<JobRecord>> ListJobsAsync(Guid businessId, string? search, string? status, int page, int pageSize, CancellationToken cancellationToken = default)
    {
        lock (gate)
        {
            var query = jobs.Where(x => x.BusinessId == businessId);
            if (!string.IsNullOrWhiteSpace(status)) query = query.Where(x => x.Status.Equals(status, StringComparison.OrdinalIgnoreCase));
            if (!string.IsNullOrWhiteSpace(search)) query = query.Where(x => Contains(x.JobNumber, search) || Contains(x.Title, search));
            return Task.FromResult(Page(query.OrderByDescending(x => x.CreatedAt), page, pageSize));
        }
    }

    public Task<JobRecord?> GetJobAsync(Guid businessId, Guid jobId, CancellationToken cancellationToken = default)
    {
        lock (gate) return Task.FromResult(jobs.FirstOrDefault(x => x.BusinessId == businessId && x.Id == jobId));
    }

    public Task<JobRecord> CreateJobAsync(Guid businessId, CreateJobCommand command, int jobsPerPeriodLimit, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(command.Title)) throw new WorkRuleException("validation_failed", "Job title is required.");
        if (command.Priority is not ("Normal" or "High" or "Emergency")) throw new WorkRuleException("validation_failed", "Priority is invalid.");
        lock (gate)
        {
            if (!customers.Any(x => x.BusinessId == businessId && x.Id == command.CustomerId && !x.IsArchived))
                throw new WorkRuleException("customer_not_found", "The customer was not found.");
            var periodStart = new DateTimeOffset(DateTime.UtcNow.Year, DateTime.UtcNow.Month, 1, 0, 0, 0, TimeSpan.Zero);
            if (jobs.Count(x => x.BusinessId == businessId && x.CreatedAt >= periodStart) >= jobsPerPeriodLimit)
                throw new WorkRuleException("plan_limit_reached", $"The {jobsPerPeriodLimit} jobs per billing period limit has been reached.");
            var next = jobSequences.TryGetValue(businessId, out var value) ? value : 1;
            jobSequences[businessId] = next + 1;
            var status = command.ScheduledDate.HasValue ? "Scheduled" : "Draft";
            var job = new JobRecord(Guid.NewGuid(), businessId, command.CustomerId, $"J-{next:0000}", command.Title.Trim(), NullIfWhiteSpace(command.Description), status, command.Priority, command.ScheduledDate, NullIfWhiteSpace(command.ArrivalWindow), command.AssignedMemberId, 0m, DateTimeOffset.UtcNow);
            jobs.Add(job);
            return Task.FromResult(job);
        }
    }

    public Task<JobRecord> ChangeJobStatusAsync(Guid businessId, Guid jobId, ChangeJobStatusCommand command, CancellationToken cancellationToken = default)
    {
        if (command.Status == "Scheduled" && command.ScheduledDate.HasValue)
        {
            return ScheduleJobAsync(businessId, jobId, new ScheduleJobCommand(command.ScheduledDate.Value, command.ArrivalWindow, command.AssignedMemberId), cancellationToken);
        }

        lock (gate)
        {
            var index = jobs.FindIndex(job => job.BusinessId == businessId && job.Id == jobId);
            if (index < 0) throw new WorkRuleException("resource_not_found", "The requested resource was not found.");
            var current = jobs[index];
            var allowed = (current.Status, command.Status) switch
            {
                ("Draft", "Scheduled") or ("Draft", "Cancelled") => true,
                ("Scheduled", "InProgress") or ("Scheduled", "OnHold") or ("Scheduled", "Cancelled") => true,
                ("InProgress", "OnHold") or ("InProgress", "Completed") or ("InProgress", "Cancelled") => true,
                ("OnHold", "Scheduled") or ("OnHold", "InProgress") or ("OnHold", "Cancelled") => true,
                ("Completed", "InProgress") => true,
                _ => false
            };
            if (!allowed) throw new WorkRuleException("invalid_transition", $"A {current.Status} job cannot change to {command.Status}.");
            jobs[index] = current with { Status = command.Status };
            return Task.FromResult(jobs[index]);
        }
    }

    public Task<JobRecord> ScheduleJobAsync(Guid businessId, Guid jobId, ScheduleJobCommand command, CancellationToken cancellationToken = default)
    {
        var window = AppointmentWindow.Parse(command.ScheduledDate, command.ArrivalWindow);
        if (window is null)
        {
            throw new WorkRuleException("validation_failed", "A scheduled date is required.");
        }

        lock (gate)
        {
            var index = jobs.FindIndex(job => job.BusinessId == businessId && job.Id == jobId);
            if (index < 0) throw new WorkRuleException("resource_not_found", "The requested resource was not found.");
            var current = jobs[index];
            if (current.Status is "Completed" or "Cancelled")
            {
                throw new WorkRuleException("invalid_transition", $"A {current.Status} job cannot be scheduled.");
            }

            var arrivalDisplay = command.ArrivalWindow ?? $"{window.StartsAt:h:mm tt} – {window.EndsAt:h:mm tt}";
            jobs[index] = current with
            {
                Status = "Scheduled",
                ScheduledDate = command.ScheduledDate,
                ArrivalWindow = arrivalDisplay,
                AssignedMemberId = command.AssignedMemberId ?? current.AssignedMemberId
            };
            return Task.FromResult(jobs[index]);
        }
    }

    public Task<PageResult<CatalogItemRecord>> ListCatalogItemsAsync(Guid businessId, string? search, string? itemType, int page, int pageSize, CancellationToken cancellationToken = default)
    {
        lock (gate)
        {
            var query = catalogItems.Where(x => x.BusinessId == businessId && !x.IsArchived);
            if (!string.IsNullOrWhiteSpace(search)) query = query.Where(x => Contains(x.Name, search));
            if (!string.IsNullOrWhiteSpace(itemType)) query = query.Where(x => x.ItemType.Equals(itemType, StringComparison.OrdinalIgnoreCase));
            return Task.FromResult(Page(query.OrderBy(x => x.Name), page, pageSize));
        }
    }

    public Task<CatalogItemRecord> CreateCatalogItemAsync(Guid businessId, CreateCatalogItemCommand command, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(command.Name) || string.IsNullOrWhiteSpace(command.Unit) || command.UnitCost < 0 || command.UnitPrice < 0 || command.ItemType is not ("Service" or "Labor" or "Part"))
            throw new WorkRuleException("validation_failed", "Type, name, unit, and non-negative prices are required.");
        var item = new CatalogItemRecord(Guid.NewGuid(), businessId, command.ItemType, command.Name.Trim(), command.Unit.Trim(), command.UnitCost, command.UnitPrice, NullIfWhiteSpace(command.TaxCategory), false);
        lock (gate) catalogItems.Add(item);
        return Task.FromResult(item);
    }

    public Task<JobItemSet> GetJobItemsAsync(Guid businessId, Guid jobId, CancellationToken cancellationToken = default)
    {
        lock (gate)
        {
            if (!jobs.Any(x => x.BusinessId == businessId && x.Id == jobId)) throw new WorkRuleException("resource_not_found", "The requested resource was not found.");
            return Task.FromResult(Totals(jobItems.Where(x => x.BusinessId == businessId && x.JobId == jobId).OrderBy(x => x.SortOrder).ToArray()));
        }
    }

    public Task<JobItemSet> ReplaceJobItemsAsync(Guid businessId, Guid jobId, IReadOnlyList<ReplaceJobItemCommand> commands, CancellationToken cancellationToken = default)
    {
        lock (gate)
        {
            var jobIndex = jobs.FindIndex(x => x.BusinessId == businessId && x.Id == jobId);
            if (jobIndex < 0) throw new WorkRuleException("resource_not_found", "The requested resource was not found.");
            if (jobs[jobIndex].Status is "Completed" or "Cancelled") throw new WorkRuleException("job_locked", "Completed or cancelled job items cannot be changed.");
            var replacements = commands.Select((x, index) =>
            {
                if (x.Quantity <= 0 || x.UnitPrice < 0 || x.DiscountAmount < 0 || x.TaxAmount < 0 || x.DiscountAmount > Math.Round(x.Quantity * x.UnitPrice, 2) || string.IsNullOrWhiteSpace(x.Description) || x.ItemType is not ("Service" or "Labor" or "Part"))
                    throw new WorkRuleException("validation_failed", "Each item requires a valid type, description, positive quantity, and valid amounts.");
                if (x.CatalogItemId.HasValue && !catalogItems.Any(c => c.BusinessId == businessId && c.Id == x.CatalogItemId && !c.IsArchived))
                    throw new WorkRuleException("catalog_item_not_found", "A selected catalog item was not found.");
                var total = Math.Round(x.Quantity * x.UnitPrice, 2) - x.DiscountAmount + x.TaxAmount;
                return new JobItemRecord(Guid.NewGuid(), businessId, jobId, x.CatalogItemId, x.ItemType, x.Description.Trim(), x.Quantity, x.Unit.Trim(), x.UnitPrice, x.DiscountAmount, x.TaxAmount, index, total);
            }).ToArray();
            jobItems.RemoveAll(x => x.BusinessId == businessId && x.JobId == jobId);
            jobItems.AddRange(replacements);
            var set = Totals(replacements);
            jobs[jobIndex] = jobs[jobIndex] with { Total = set.Total };
            return Task.FromResult(set);
        }
    }

    private static JobItemSet Totals(IReadOnlyList<JobItemRecord> items) => new(items, items.Sum(x => Math.Round(x.Quantity * x.UnitPrice, 2)), items.Sum(x => x.DiscountAmount), items.Sum(x => x.TaxAmount), items.Sum(x => x.LineTotal));

    private CustomerRecord SeedCustomer(Guid businessId, string name, string email, string phone, string address, string city, string state, string postal)
    {
        var item = new CustomerRecord(Guid.NewGuid(), businessId, name, null, email, phone, "Residential", address, city, state, postal, false, DateTimeOffset.UtcNow.AddYears(-1));
        customers.Add(item);
        return item;
    }

    private static PageResult<T> Page<T>(IEnumerable<T> source, int page, int pageSize)
    {
        page = Math.Max(1, page); pageSize = Math.Clamp(pageSize, 1, 100);
        var values = source.ToArray();
        return new(values.Skip((page - 1) * pageSize).Take(pageSize).ToArray(), values.Length, page, pageSize);
    }

    private static bool Contains(string? source, string value) => source?.Contains(value.Trim(), StringComparison.OrdinalIgnoreCase) == true;
    private static string? NullIfWhiteSpace(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
    private static void ValidateCustomer(CreateCustomerCommand command)
    {
        if (string.IsNullOrWhiteSpace(command.Name) || string.IsNullOrWhiteSpace(command.Phone) || string.IsNullOrWhiteSpace(command.AddressLine1) || string.IsNullOrWhiteSpace(command.City) || command.StateCode.Trim().Length != 2 || string.IsNullOrWhiteSpace(command.PostalCode))
            throw new WorkRuleException("validation_failed", "Name, phone, service address, city, two-letter state, and ZIP are required.");
        if (command.CustomerType is not ("Residential" or "Commercial")) throw new WorkRuleException("validation_failed", "Customer type is invalid.");
        if (!string.IsNullOrWhiteSpace(command.Email) &&
            (command.Email.Length > 254 || !MailAddress.TryCreate(command.Email.Trim(), out var parsedEmail) ||
             !string.Equals(parsedEmail.Address, command.Email.Trim(), StringComparison.OrdinalIgnoreCase)))
            throw new WorkRuleException("validation_failed", "Email address is invalid.");
    }
}
