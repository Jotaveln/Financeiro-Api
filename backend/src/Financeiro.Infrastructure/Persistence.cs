using Financeiro.Application;
using Financeiro.Domain;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace Financeiro.Infrastructure;

public sealed class ApplicationUser : IdentityUser<Guid>
{
    public string Name { get; set; } = "";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public sealed class RefreshToken : Entity
{
    public Guid UserId { get; set; }
    public ApplicationUser? User { get; set; }
    public string TokenHash { get; set; } = "";
    public string Family { get; set; } = "";
    public DateTime ExpiresAt { get; set; }
    public DateTime? RevokedAt { get; set; }
    public string? ReplacedByHash { get; set; }
    public bool IsActive => RevokedAt is null && ExpiresAt > DateTime.UtcNow;
}

public sealed class FinanceiroDbContext(DbContextOptions<FinanceiroDbContext> options, ICurrentUser currentUser)
    : IdentityDbContext<ApplicationUser, IdentityRole<Guid>, Guid>(options)
{
    private readonly ICurrentUser _currentUser = currentUser;
    public DbSet<Account> Accounts => Set<Account>();
    public DbSet<Category> Categories => Set<Category>();
    public DbSet<Transaction> Transactions => Set<Transaction>();
    public DbSet<Transfer> Transfers => Set<Transfer>();
    public DbSet<CreditCard> CreditCards => Set<CreditCard>();
    public DbSet<CreditCardInvoice> CreditCardInvoices => Set<CreditCardInvoice>();
    public DbSet<CreditCardPurchase> CreditCardPurchases => Set<CreditCardPurchase>();
    public DbSet<Installment> Installments => Set<Installment>();
    public DbSet<Budget> Budgets => Set<Budget>();
    public DbSet<FinancialGoal> FinancialGoals => Set<FinancialGoal>();
    public DbSet<GoalContribution> GoalContributions => Set<GoalContribution>();
    public DbSet<Investment> Investments => Set<Investment>();
    public DbSet<Debt> Debts => Set<Debt>();
    public DbSet<DebtInstallment> DebtInstallments => Set<DebtInstallment>();
    public DbSet<Subscription> Subscriptions => Set<Subscription>();
    public DbSet<Notification> Notifications => Set<Notification>();
    public DbSet<UserSettings> UserSettings => Set<UserSettings>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        base.OnModelCreating(b);
        b.HasDefaultSchema("financeiro");
        foreach (var entity in b.Model.GetEntityTypes().Where(x => typeof(Entity).IsAssignableFrom(x.ClrType)))
        {
            b.Entity(entity.ClrType).Property(nameof(Entity.CreatedAt)).HasDefaultValueSql("CURRENT_TIMESTAMP");
            b.Entity(entity.ClrType).Property(nameof(Entity.UpdatedAt)).HasDefaultValueSql("CURRENT_TIMESTAMP");
        }
        foreach (var type in new[] { typeof(Account), typeof(Category), typeof(Transaction), typeof(Transfer), typeof(CreditCard), typeof(CreditCardInvoice), typeof(CreditCardPurchase), typeof(Installment), typeof(Budget), typeof(FinancialGoal), typeof(GoalContribution), typeof(Investment), typeof(Debt), typeof(DebtInstallment), typeof(Subscription), typeof(Notification), typeof(UserSettings) })
            b.Entity(type).HasIndex(nameof(UserEntity.UserId));

        b.Entity<Account>().HasQueryFilter(x => x.UserId == _currentUser.UserId);
        b.Entity<Category>().HasQueryFilter(x => x.UserId == _currentUser.UserId);
        b.Entity<Transaction>().HasQueryFilter(x => x.UserId == _currentUser.UserId);
        b.Entity<Transfer>().HasQueryFilter(x => x.UserId == _currentUser.UserId);
        b.Entity<CreditCard>().HasQueryFilter(x => x.UserId == _currentUser.UserId);
        b.Entity<CreditCardInvoice>().HasQueryFilter(x => x.UserId == _currentUser.UserId);
        b.Entity<CreditCardPurchase>().HasQueryFilter(x => x.UserId == _currentUser.UserId);
        b.Entity<Installment>().HasQueryFilter(x => x.UserId == _currentUser.UserId);
        b.Entity<Budget>().HasQueryFilter(x => x.UserId == _currentUser.UserId);
        b.Entity<FinancialGoal>().HasQueryFilter(x => x.UserId == _currentUser.UserId);
        b.Entity<GoalContribution>().HasQueryFilter(x => x.UserId == _currentUser.UserId);
        b.Entity<Investment>().HasQueryFilter(x => x.UserId == _currentUser.UserId);
        b.Entity<Debt>().HasQueryFilter(x => x.UserId == _currentUser.UserId);
        b.Entity<DebtInstallment>().HasQueryFilter(x => x.UserId == _currentUser.UserId);
        b.Entity<Subscription>().HasQueryFilter(x => x.UserId == _currentUser.UserId);
        b.Entity<Notification>().HasQueryFilter(x => x.UserId == _currentUser.UserId);
        b.Entity<UserSettings>().HasQueryFilter(x => x.UserId == _currentUser.UserId);

        b.Entity<Account>().Property(x => x.InitialBalance).HasPrecision(18, 2);
        b.Entity<Transaction>().Property(x => x.Amount).HasPrecision(18, 2);
        b.Entity<CreditCard>().Property(x => x.Limit).HasPrecision(18, 2);
        b.Entity<CreditCardInvoice>().Ignore(x => x.Total);
        b.Entity<FinancialGoal>().Ignore(x => x.CurrentAmount);
        b.Entity<Investment>().Ignore(x => x.InvestedAmount);
        b.Entity<Investment>().Ignore(x => x.CurrentAmount);
        b.Entity<Account>().Ignore(nameof(Account.CalculateBalance));
        b.Entity<Budget>().HasIndex(x => new { x.UserId, x.CategoryId, x.Month, x.Year }).IsUnique();
        b.Entity<CreditCardInvoice>().HasIndex(x => new { x.CreditCardId, x.Month, x.Year }).IsUnique();
        b.Entity<Notification>().HasIndex(x => new { x.UserId, x.UniqueKey }).IsUnique();
        b.Entity<RefreshToken>().HasIndex(x => x.TokenHash).IsUnique();
        b.Entity<Category>().HasOne(x => x.Parent).WithMany().HasForeignKey(x => x.ParentId).OnDelete(DeleteBehavior.Restrict);
        b.Entity<Transaction>().HasOne(x => x.Account).WithMany(x => x.Transactions).HasForeignKey(x => x.AccountId).OnDelete(DeleteBehavior.Restrict);
        b.Entity<Transaction>().HasOne(x => x.Category).WithMany().HasForeignKey(x => x.CategoryId).OnDelete(DeleteBehavior.SetNull);
        b.Entity<CreditCardInvoice>().HasOne(x => x.CreditCard).WithMany(x => x.Invoices).HasForeignKey(x => x.CreditCardId).OnDelete(DeleteBehavior.Cascade);
        b.Entity<Installment>().HasOne(x => x.Purchase).WithMany(x => x.Installments).HasForeignKey(x => x.CreditCardPurchaseId);
        b.Entity<Installment>().HasOne(x => x.Invoice).WithMany(x => x.Installments).HasForeignKey(x => x.CreditCardInvoiceId).OnDelete(DeleteBehavior.Restrict);
        b.Entity<GoalContribution>().HasOne(x => x.Goal).WithMany(x => x.Contributions).HasForeignKey(x => x.FinancialGoalId);
        b.Entity<DebtInstallment>().HasOne(x => x.Debt).WithMany(x => x.Installments).HasForeignKey(x => x.DebtId);
    }

    public override Task<int> SaveChangesAsync(CancellationToken ct = default)
    {
        foreach (var entry in ChangeTracker.Entries<Entity>().Where(x => x.State == EntityState.Modified)) entry.Entity.UpdatedAt = DateTime.UtcNow;
        return base.SaveChangesAsync(ct);
    }
}
