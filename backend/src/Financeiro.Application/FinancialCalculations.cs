using Financeiro.Domain;

namespace Financeiro.Application;

public static class FinancialCalculations
{
    public static DateOnly ClampDate(int year, int month, int day)
        => new(year, month, Math.Clamp(day, 1, DateTime.DaysInMonth(year, month)));

    public static (int Month, int Year) InvoicePeriod(DateOnly purchaseDate, int closingDay)
    {
        var period = purchaseDate.Day <= closingDay ? purchaseDate : purchaseDate.AddMonths(1);
        return (period.Month, period.Year);
    }

    public static DateOnly InvoiceClosingDate(int year, int month, int closingDay)
        => ClampDate(year, month, closingDay);

    public static DateOnly InvoiceDueDate(int year, int month, int dueDay)
    {
        var dueMonth = new DateOnly(year, month, 1).AddMonths(1);
        return ClampDate(dueMonth.Year, dueMonth.Month, dueDay);
    }

    public static IReadOnlyList<decimal> SplitAmount(decimal total, int count)
    {
        if (total < 0 || count < 1) throw new ArgumentOutOfRangeException();
        var baseAmount = decimal.Round(total / count, 2, MidpointRounding.AwayFromZero);
        var values = Enumerable.Repeat(baseAmount, count).ToArray();
        values[^1] = total - baseAmount * (count - 1);
        return values;
    }

    public static DateOnly? NextBillingDate(
        DateOnly startDate,
        SubscriptionCycle cycle,
        int billingDay,
        DateOnly today)
    {
        if (!Enum.IsDefined(typeof(SubscriptionCycle), cycle)) throw new ArgumentOutOfRangeException(nameof(cycle));
        if (cycle == SubscriptionCycle.Weekly)
        {
            var days = Math.Max(0, (today.DayNumber - startDate.DayNumber + 6) / 7);
            var candidate = startDate.AddDays(days * 7);
            return candidate < today ? candidate.AddDays(7) : candidate;
        }

        var months = cycle switch
        {
            SubscriptionCycle.Monthly => 1,
            SubscriptionCycle.Quarterly => 3,
            SubscriptionCycle.Semiannual => 6,
            SubscriptionCycle.Annual => 12,
            _ => 1,
        };
        var elapsedMonths = (today.Year - startDate.Year) * 12 + today.Month - startDate.Month;
        var cycles = Math.Max(0, elapsedMonths / months);
        while (true)
        {
            var month = startDate.AddMonths(cycles * months);
            var candidate = ClampDate(month.Year, month.Month, billingDay);
            if (candidate < startDate || candidate < today)
            {
                cycles++;
                continue;
            }
            return candidate;
        }
    }

    public static IEnumerable<DateOnly> BillingOccurrences(
        DateOnly startDate,
        SubscriptionCycle cycle,
        int billingDay,
        DateOnly from,
        DateOnly to)
    {
        if (from > to) yield break;
        if (!Enum.IsDefined(typeof(SubscriptionCycle), cycle)) throw new ArgumentOutOfRangeException(nameof(cycle));
        if (cycle == SubscriptionCycle.Weekly)
        {
            var offset = Math.Max(0, (from.DayNumber - startDate.DayNumber + 6) / 7);
            var date = startDate.AddDays(offset * 7);
            while (date <= to)
            {
                if (date >= from) yield return date;
                date = date.AddDays(7);
            }
            yield break;
        }

        var months = cycle switch
        {
            SubscriptionCycle.Monthly => 1,
            SubscriptionCycle.Quarterly => 3,
            SubscriptionCycle.Semiannual => 6,
            SubscriptionCycle.Annual => 12,
            _ => 1,
        };
        var elapsedMonths = (from.Year - startDate.Year) * 12 + from.Month - startDate.Month;
        var cycles = Math.Max(0, elapsedMonths / months - 1);
        while (cycles < 10000)
        {
            var month = startDate.AddMonths(cycles * months);
            var date = ClampDate(month.Year, month.Month, billingDay);
            if (date >= startDate && date >= from && date <= to) yield return date;
            if (date > to) yield break;
            cycles++;
        }
    }
}
