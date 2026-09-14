using ServiceDesk.Application.DataControls;
using ServiceDesk.Application.Financials;
using ServiceDesk.Application.Platform;
using ServiceDesk.Application.Reports;
using ServiceDesk.Application.Subscriptions;
using ServiceDesk.Application.Tenancy;
using ServiceDesk.Application.Work;
using ServiceDesk.Infrastructure.Data;
using ServiceDesk.Infrastructure.Services;

namespace ServiceDesk.Api.Extensions;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddServiceDeskServices(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("ServiceDesk");
        if (!string.IsNullOrWhiteSpace(connectionString))
        {
            services.AddScoped(serviceProvider => new BaseDAL(
                connectionString,
                serviceProvider.GetRequiredService<ILogger<BaseDAL>>()));
            services.AddScoped<IBusinessService, BusinessService>();
            services.AddScoped<IWorkStore, WorkService>();
            services.AddScoped<ServiceDesk.Infrastructure.Notifications.IEmailSender, ServiceDesk.Infrastructure.Notifications.DynamicEmailSender>();
            services.AddScoped<IIdempotencyService, IdempotencyService>();
            services.AddScoped<IFinancialService, FinancialService>();
            services.AddScoped<ISubscriptionService, SubscriptionService>();
            services.AddScoped<IAuditService, AuditService>();
            services.AddScoped<IDataExportService, DataExportService>();
            services.AddScoped<IReportService, ReportService>();
            services.AddScoped<IPlatformAdminService, PlatformAdminService>();
            services.AddHostedService<ServiceDesk.Infrastructure.Notifications.OutboxProcessorService>();
        }
        else
        {
            services.AddSingleton<IWorkStore, ServiceDesk.Infrastructure.Work.InMemoryWorkStore>();
            services.AddSingleton<IBusinessService, ServiceDesk.Infrastructure.Tenancy.InMemoryBusinessStore>();
        }

        return services;
    }
}
