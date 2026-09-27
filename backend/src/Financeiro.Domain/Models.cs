namespace Financeiro.Domain;

public enum AccountType { Checking, Savings, Wallet, Digital, Cash, Brokerage, Other }
public enum TransactionType { Income, Expense }
public enum TransactionStatus { Pending, Paid, Overdue, Cancelled }
public enum RecurrenceType { None, Monthly, Weekly, Yearly, Installment }
public enum CardBrand { Visa, Mastercard, Elo, Amex, Hipercard, Other }
public enum InvoiceStatus { Open, Closed, Paid, Overdue }
public enum InvestmentType { FixedIncome, Treasury, Cdb, LciLca, Stock, Fii, Etf, Fund, Crypto, Other }
public enum DebtType { Financing, Loan, Personal, Installment }
public enum NotificationType { DueDate, Invoice, Budget, Goal, LowBalance }
public enum SubscriptionCycle { Monthly, Annual }

public abstract class Entity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

public abstract class UserEntity : Entity { public Guid UserId { get; set; } }

public sealed class Account : UserEntity
{
    public string Name { get; set; } = "";
    public string? Institution { get; set; }
    public AccountType Type { get; set; }
    public decimal InitialBalance { get; set; }
    public string Color { get; set; } = "#2563EB";
    public string Icon { get; set; } = "wallet";
    public bool IsActive { get; set; } = true;
    public ICollection<Transaction> Transactions { get; set; } = [];
    public decimal CalculateBalance() => InitialBalance + Transactions.Where(x => x.Status == TransactionStatus.Paid).Sum(x => x.Type == TransactionType.Income ? x.Amount : -x.Amount);
}

public sealed class Category : UserEntity
{
    public string Name { get; set; } = "";
    public TransactionType Type { get; set; }
    public string Color { get; set; } = "#64748B";
    public string Icon { get; set; } = "tag";
    public Guid? ParentId { get; set; }
    public Category? Parent { get; set; }
    public bool IsActive { get; set; } = true;
}

public sealed class Transaction : UserEntity
{
    public string Description { get; set; } = "";
    public decimal Amount { get; set; }
    public TransactionType Type { get; set; }
    public TransactionStatus Status { get; set; }
    public DateOnly Date { get; set; }
    public DateOnly? DueDate { get; set; }
    public DateOnly? PaidAt { get; set; }
    public string? Notes { get; set; }
    public string? Tags { get; set; }
    public Guid AccountId { get; set; }
    public Account? Account { get; set; }
    public Guid? CategoryId { get; set; }
    public Category? Category { get; set; }
    public Guid? TransferId { get; set; }
    public RecurrenceType Recurrence { get; set; }
    public string? RecurrenceKey { get; set; }
}

public sealed class Transfer : UserEntity
{
    public Guid SourceAccountId { get; set; }
    public Guid DestinationAccountId { get; set; }
    public decimal Amount { get; set; }
    public DateOnly Date { get; set; }
    public string? Description { get; set; }
    public Guid DebitTransactionId { get; set; }
    public Guid CreditTransactionId { get; set; }
}

public sealed class CreditCard : UserEntity
{
    public string Name { get; set; } = "";
    public string Bank { get; set; } = "";
    public CardBrand Brand { get; set; }
    public decimal Limit { get; set; }
    public int BestPurchaseDay { get; set; }
    public int ClosingDay { get; set; }
    public int DueDay { get; set; }
    public bool IsActive { get; set; } = true;
    public ICollection<CreditCardInvoice> Invoices { get; set; } = [];
}

public sealed class CreditCardInvoice : UserEntity
{
    public Guid CreditCardId { get; set; }
    public CreditCard? CreditCard { get; set; }
    public int Month { get; set; }
    public int Year { get; set; }
    public DateOnly ClosingDate { get; set; }
    public DateOnly DueDate { get; set; }
    public InvoiceStatus Status { get; set; }
    public DateOnly? PaidAt { get; set; }
    public Guid? PaymentTransactionId { get; set; }
    public ICollection<Installment> Installments { get; set; } = [];
    public decimal Total => Installments.Sum(x => x.Amount);
}

public sealed class CreditCardPurchase : UserEntity
{
    public Guid CreditCardId { get; set; }
    public string Description { get; set; } = "";
    public decimal TotalAmount { get; set; }
    public DateOnly PurchaseDate { get; set; }
    public Guid? CategoryId { get; set; }
    public int InstallmentCount { get; set; }
    public ICollection<Installment> Installments { get; set; } = [];
}

public sealed class Installment : UserEntity
{
    public Guid CreditCardPurchaseId { get; set; }
    public CreditCardPurchase? Purchase { get; set; }
    public Guid CreditCardInvoiceId { get; set; }
    public CreditCardInvoice? Invoice { get; set; }
    public int Number { get; set; }
    public int Total { get; set; }
    public decimal Amount { get; set; }
}

public sealed class Budget : UserEntity
{
    public Guid CategoryId { get; set; }
    public Category? Category { get; set; }
    public int Month { get; set; }
    public int Year { get; set; }
    public decimal Amount { get; set; }
}

public sealed class FinancialGoal : UserEntity
{
    public string Name { get; set; } = "";
    public decimal TargetAmount { get; set; }
    public DateOnly? Deadline { get; set; }
    public string Color { get; set; } = "#10B981";
    public bool IsCompleted { get; set; }
    public ICollection<GoalContribution> Contributions { get; set; } = [];
    public decimal CurrentAmount => Contributions.Sum(x => x.Amount);
}

public sealed class GoalContribution : UserEntity
{
    public Guid FinancialGoalId { get; set; }
    public FinancialGoal? Goal { get; set; }
    public decimal Amount { get; set; }
    public DateOnly Date { get; set; }
    public string? Notes { get; set; }
}

public sealed class Investment : UserEntity
{
    public string Asset { get; set; } = "";
    public InvestmentType Type { get; set; }
    public decimal Quantity { get; set; }
    public decimal AveragePrice { get; set; }
    public decimal CurrentPrice { get; set; }
    public string? Broker { get; set; }
    public decimal InvestedAmount => Quantity * AveragePrice;
    public decimal CurrentAmount => Quantity * CurrentPrice;
}

public sealed class Debt : UserEntity
{
    public string Name { get; set; } = "";
    public DebtType Type { get; set; }
    public decimal Principal { get; set; }
    public decimal InterestRate { get; set; }
    public int InstallmentCount { get; set; }
    public DateOnly StartDate { get; set; }
    public ICollection<DebtInstallment> Installments { get; set; } = [];
}

public sealed class DebtInstallment : UserEntity
{
    public Guid DebtId { get; set; }
    public Debt? Debt { get; set; }
    public int Number { get; set; }
    public decimal Amount { get; set; }
    public DateOnly DueDate { get; set; }
    public DateOnly? PaidAt { get; set; }
}

public sealed class Subscription : UserEntity
{
    public string Name { get; set; } = "";
    public decimal Amount { get; set; }
    public SubscriptionCycle Cycle { get; set; }
    public int BillingDay { get; set; }
    public DateOnly StartDate { get; set; }
    public Guid? AccountId { get; set; }
    public Guid? CategoryId { get; set; }
    public bool IsActive { get; set; } = true;
}

public sealed class Notification : UserEntity
{
    public NotificationType Type { get; set; }
    public string Title { get; set; } = "";
    public string Message { get; set; } = "";
    public string UniqueKey { get; set; } = "";
    public bool IsRead { get; set; }
    public DateTime? ReadAt { get; set; }
}

public sealed class UserSettings : UserEntity
{
    public string Currency { get; set; } = "BRL";
    public string Culture { get; set; } = "pt-BR";
    public string DateFormat { get; set; } = "dd/MM/yyyy";
    public string Theme { get; set; } = "system";
    public decimal LowBalanceThreshold { get; set; }
}
