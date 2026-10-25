using System.Security.Claims;
using Financeiro.Application;
using Financeiro.Domain;
using Financeiro.Infrastructure;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Diagnostics.HealthChecks;

public sealed class HttpCurrentUser(IHttpContextAccessor accessor) : ICurrentUser
{
    public Guid UserId => Guid.TryParse(accessor.HttpContext?.User.FindFirstValue(ClaimTypes.NameIdentifier) ?? accessor.HttpContext?.User.FindFirstValue("sub"), out var id) ? id : Guid.Empty;
}

public sealed class GlobalExceptionHandler(ILogger<GlobalExceptionHandler> logger) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext context, Exception exception, CancellationToken ct)
    {
        logger.LogError(exception, "Erro não tratado. CorrelationId={CorrelationId}", context.TraceIdentifier);
        var status = exception is ArgumentException ? 400 : 500;
        var problem = new ProblemDetails { Status = status, Title = status == 400 ? "Requisição inválida" : "Erro interno", Detail = status == 400 ? exception.Message : "Ocorreu um erro inesperado.", Instance = context.Request.Path };
        problem.Extensions["traceId"] = context.TraceIdentifier;
        context.Response.StatusCode = status;
        await context.Response.WriteAsJsonAsync(problem, ct);
        return true;
    }
}

public sealed class DatabaseHealthCheck(FinanceiroDbContext db) : IHealthCheck
{
    public async Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context, CancellationToken cancellationToken = default)
    {
        try
        {
            return await db.Database.CanConnectAsync(cancellationToken)
                ? HealthCheckResult.Healthy()
                : HealthCheckResult.Unhealthy("Não foi possível conectar ao PostgreSQL.");
        }
        catch (Exception exception)
        {
            return HealthCheckResult.Unhealthy("Não foi possível conectar ao PostgreSQL.", exception);
        }
    }
}

public static class SeedData
{
    public static async Task InitializeAsync(IServiceProvider root, IConfiguration config, IHostEnvironment env)
    {
        if (!env.IsDevelopment() || !config.GetValue("Seed:Enabled", false)) return;
        await using var scope = root.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<FinanceiroDbContext>();
        await db.Database.MigrateAsync();
        var users = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var email = config["Seed:Email"] ?? config["Seed:DemoEmail"];
        var password = config["Seed:Password"] ?? config["Seed:DemoPassword"];
        if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(password)) return;
        var user = await users.FindByEmailAsync(email);
        if (user is null)
        {
            user = new ApplicationUser { Id = Guid.NewGuid(), Name = "Usuário Demonstração", Email = email, UserName = email, EmailConfirmed = true };
            var result = await users.CreateAsync(user, password);
            if (!result.Succeeded) throw new InvalidOperationException(string.Join("; ", result.Errors.Select(x => x.Description)));
        }
        if (await db.Accounts.IgnoreQueryFilters().AnyAsync(x => x.UserId == user.Id)) return;
        var account = new Account { UserId = user.Id, Name = "Conta Principal", Institution = "Banco Demo", Type = AccountType.Checking, InitialBalance = 2500m };
        var income = new Category { UserId = user.Id, Name = "Salário", Type = TransactionType.Income, Color = "#10B981", Icon = "briefcase" };
        var food = new Category { UserId = user.Id, Name = "Alimentação", Type = TransactionType.Expense, Color = "#F59E0B", Icon = "utensils" };
        db.AddRange(account, income, food, new UserSettings { UserId = user.Id }); await db.SaveChangesAsync();
        db.Transactions.AddRange(
            new Transaction { UserId = user.Id, AccountId = account.Id, CategoryId = income.Id, Description = "Salário", Amount = 5500, Type = TransactionType.Income, Status = TransactionStatus.Paid, Date = DateOnly.FromDateTime(DateTime.Today), PaidAt = DateOnly.FromDateTime(DateTime.Today) },
            new Transaction { UserId = user.Id, AccountId = account.Id, CategoryId = food.Id, Description = "Supermercado", Amount = 420.75m, Type = TransactionType.Expense, Status = TransactionStatus.Paid, Date = DateOnly.FromDateTime(DateTime.Today), PaidAt = DateOnly.FromDateTime(DateTime.Today) });
        db.FinancialGoals.Add(new FinancialGoal { UserId = user.Id, Name = "Reserva de emergência", TargetAmount = 20000, Deadline = DateOnly.FromDateTime(DateTime.Today.AddYears(1)) });
        db.Investments.Add(new Investment { UserId = user.Id, Asset = "Tesouro Selic", Type = InvestmentType.Treasury, Quantity = 1, AveragePrice = 5000, CurrentPrice = 5280, Broker = "Corretora Demo" });
        await db.SaveChangesAsync();
    }
}
