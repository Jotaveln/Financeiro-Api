using Financeiro.Domain;

namespace Financeiro.Application;

public sealed record PagedResult<T>(IReadOnlyList<T> Items, int Page, int PageSize, int Total)
{
    public int TotalPages => (int)Math.Ceiling(Total / (double)PageSize);
}

public sealed record AccountRequest(string Name, string? Institution, AccountType Type, decimal InitialBalance, string? Color, string? Icon, bool IsActive = true);
public sealed record TransactionRequest(string Description, decimal Amount, TransactionType Type, TransactionStatus Status, DateOnly Date, DateOnly? DueDate, DateOnly? PaidAt, Guid AccountId, Guid? CategoryId, string? Notes, string? Tags, RecurrenceType Recurrence = RecurrenceType.None, int Occurrences = 1);
public sealed record CategoryRequest(string Name, TransactionType Type, string? Color, string? Icon, Guid? ParentId, bool IsActive = true);
public sealed record TransferRequest(Guid SourceAccountId, Guid DestinationAccountId, decimal Amount, DateOnly Date, string? Description);
public sealed record CreditCardRequest(string Name, string Bank, CardBrand Brand, decimal Limit, int BestPurchaseDay, int ClosingDay, int DueDay, bool IsActive = true);
public sealed record CardPurchaseRequest(string Description, decimal TotalAmount, DateOnly PurchaseDate, Guid? CategoryId, int InstallmentCount);
public sealed record InvoicePaymentRequest(Guid AccountId, DateOnly PaymentDate);
public sealed record BudgetRequest(Guid CategoryId, int Month, int Year, decimal Amount);
public sealed record GoalRequest(string Name, decimal TargetAmount, DateOnly? Deadline, string? Color);
public sealed record ContributionRequest(decimal Amount, DateOnly Date, string? Notes);
public sealed record InvestmentRequest(string Asset, InvestmentType Type, decimal Quantity, decimal AveragePrice, decimal CurrentPrice, string? Broker);
public sealed record DebtRequest(string Name, DebtType Type, decimal Principal, decimal InterestRate, int InstallmentCount, DateOnly StartDate);
public sealed record SubscriptionRequest(string Name, decimal Amount, SubscriptionCycle Cycle, int BillingDay, DateOnly StartDate, Guid? AccountId, Guid? CategoryId, bool IsActive = true);
public sealed record RegisterRequest(string Name, string Email, string Password);
public sealed record LoginRequest(string Email, string Password);
public sealed record RefreshRequest(string? RefreshToken);
public sealed record ForgotPasswordRequest(string Email);
public sealed record ResetPasswordRequest(string Email, string Token, string NewPassword);
public sealed record ChangePasswordRequest(string CurrentPassword, string NewPassword);
public sealed record UpdateProfileRequest(string Name, string? PhoneNumber);
public sealed record UserSettingsRequest(string? Currency, string? Culture, string? DateFormat, string? Theme, decimal LowBalanceThreshold);
public sealed record AuthResponse(string AccessToken, DateTime ExpiresAt, object User);
public sealed record DashboardResponse(decimal Balance, decimal NetWorth, decimal MonthIncome, decimal MonthExpense, decimal MonthlyResult, decimal Investments, decimal Debts, decimal AvailableCardLimit, int Payables, int Receivables, object[] CashFlow, object[] ByCategory, object[] Recent, object[] Upcoming);

public interface ICurrentUser { Guid UserId { get; } }
public interface IEmailService { Task SendPasswordResetAsync(string email, string resetUrl, CancellationToken ct); }
