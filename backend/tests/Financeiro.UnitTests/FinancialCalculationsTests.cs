using Financeiro.Application;
using Financeiro.Domain;

namespace Financeiro.UnitTests;

public sealed class FinancialCalculationsTests
{
    [Fact]
    public void Purchase_on_closing_day_stays_in_current_invoice()
    {
        Assert.Equal((9, 2026), FinancialCalculations.InvoicePeriod(new DateOnly(2026, 9, 10), 10));
    }

    [Fact]
    public void Purchase_after_closing_day_moves_to_next_invoice()
    {
        Assert.Equal((10, 2026), FinancialCalculations.InvoicePeriod(new DateOnly(2026, 9, 11), 10));
    }

    [Fact]
    public void Invoice_due_date_clamps_common_and_leap_february()
    {
        Assert.Equal(new DateOnly(2026, 10, 17), FinancialCalculations.InvoiceDueDate(2026, 9, 17));
        Assert.Equal(new DateOnly(2027, 2, 28), FinancialCalculations.InvoiceDueDate(2027, 1, 31));
        Assert.Equal(new DateOnly(2028, 2, 29), FinancialCalculations.InvoiceDueDate(2028, 1, 31));
    }

    [Fact]
    public void Split_amount_preserves_exact_total()
    {
        Assert.Equal(new[] { 333.33m, 333.33m, 333.34m }, FinancialCalculations.SplitAmount(1000m, 3));
    }

    [Theory]
    [InlineData(SubscriptionCycle.Monthly, 2026, 11, 10)]
    [InlineData(SubscriptionCycle.Quarterly, 2027, 1, 10)]
    [InlineData(SubscriptionCycle.Semiannual, 2027, 4, 10)]
    [InlineData(SubscriptionCycle.Annual, 2027, 10, 10)]
    public void Next_billing_supports_calendar_cycles(SubscriptionCycle cycle, int year, int month, int day)
    {
        Assert.Equal(new DateOnly(year, month, day), FinancialCalculations.NextBillingDate(new DateOnly(2026, 10, 10), cycle, 10, new DateOnly(2026, 10, 29)));
    }

    [Fact]
    public void Unknown_subscription_cycle_is_rejected()
    {
        Assert.Throws<ArgumentOutOfRangeException>(() => FinancialCalculations.NextBillingDate(new DateOnly(2026, 10, 10), (SubscriptionCycle)99, 10, new DateOnly(2026, 10, 29)));
        Assert.Throws<ArgumentOutOfRangeException>(() => FinancialCalculations.BillingOccurrences(new DateOnly(2026, 10, 10), (SubscriptionCycle)99, 10, new DateOnly(2026, 10, 1), new DateOnly(2026, 10, 31)).ToArray());
    }

    [Fact]
    public void Weekly_billing_uses_start_date_as_anchor()
    {
        Assert.Equal(new DateOnly(2026, 11, 5), FinancialCalculations.NextBillingDate(new DateOnly(2026, 10, 29), SubscriptionCycle.Weekly, 1, new DateOnly(2026, 11, 2)));
    }

    [Fact]
    public void Billing_occurrences_are_inclusive_and_clamped()
    {
        var dates = FinancialCalculations.BillingOccurrences(new DateOnly(2026, 1, 31), SubscriptionCycle.Monthly, 31, new DateOnly(2026, 2, 1), new DateOnly(2026, 4, 30)).ToArray();
        Assert.Equal(new[] { new DateOnly(2026, 2, 28), new DateOnly(2026, 3, 31), new DateOnly(2026, 4, 30) }, dates);
    }
}
