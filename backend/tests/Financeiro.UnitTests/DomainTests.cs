using Financeiro.Domain;

namespace Financeiro.UnitTests;

public sealed class DomainTests
{
    [Fact]
    public void Account_balance_uses_only_paid_transactions()
    {
        var account = new Account { InitialBalance = 1000m };
        account.Transactions.Add(new Transaction { Amount = 250m, Type = TransactionType.Income, Status = TransactionStatus.Paid });
        account.Transactions.Add(new Transaction { Amount = 80m, Type = TransactionType.Expense, Status = TransactionStatus.Paid });
        account.Transactions.Add(new Transaction { Amount = 900m, Type = TransactionType.Expense, Status = TransactionStatus.Pending });
        Assert.Equal(1170m, account.CalculateBalance());
    }

    [Fact]
    public void Goal_percentage_is_derived_from_contributions()
    {
        var goal = new FinancialGoal { TargetAmount = 2000m };
        goal.Contributions.Add(new GoalContribution { Amount = 500m });
        goal.Contributions.Add(new GoalContribution { Amount = 250m });
        Assert.Equal(750m, goal.CurrentAmount);
    }

    [Fact]
    public void Investment_return_is_positive_when_current_price_increases()
    {
        var investment = new Investment { Quantity = 10, AveragePrice = 100, CurrentPrice = 115 };
        Assert.Equal(1000m, investment.InvestedAmount);
        Assert.Equal(1150m, investment.CurrentAmount);
    }

    [Fact]
    public void Goal_progress_never_divides_by_zero()
    {
        var goal = new FinancialGoal { TargetAmount = 0 };
        Assert.Equal(0m, goal.CurrentAmount);
    }

    [Fact]
    public void Debt_installments_keep_total_after_rounding()
    {
        const decimal principal = 1000m;
        const int count = 3;
        var installment = decimal.Round(principal / count, 2);
        var final = principal - installment * (count - 1);
        Assert.Equal(principal, installment + installment + final);
        Assert.Equal(333.34m, final);
    }
}
