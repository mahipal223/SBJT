using System.Globalization;

namespace ServiceDesk.Application.Work;

public sealed record AppointmentWindow(DateTime StartsAt, DateTime EndsAt)
{
    public static AppointmentWindow? Parse(DateOnly? date, string? arrivalWindow)
    {
        if (!date.HasValue)
        {
            return null;
        }

        if (string.IsNullOrWhiteSpace(arrivalWindow))
        {
            var defaultStart = date.Value.ToDateTime(new TimeOnly(9, 0));
            return new(defaultStart, defaultStart.AddMinutes(90));
        }

        var parts = arrivalWindow.Split(['–', '-'], StringSplitOptions.TrimEntries);
        if (parts.Length != 2 ||
            !TimeOnly.TryParse(parts[0], CultureInfo.InvariantCulture, DateTimeStyles.None, out var start) ||
            !TimeOnly.TryParse(parts[1], CultureInfo.InvariantCulture, DateTimeStyles.None, out var end) ||
            end <= start)
        {
            throw new WorkRuleException("validation_failed", "Enter an arrival window such as 9:00 AM – 10:30 AM, with the end after the start.");
        }

        return new(date.Value.ToDateTime(start), date.Value.ToDateTime(end));
    }
}
