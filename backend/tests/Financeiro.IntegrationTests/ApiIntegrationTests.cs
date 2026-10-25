using System.Net;
using System.Net.Http.Headers;
using System.IdentityModel.Tokens.Jwt;
using System.Net.Http.Json;
using System.Text.Json;
using Financeiro.Application;
using Financeiro.Infrastructure;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Logging;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Npgsql;
using System.Text;

[assembly: CollectionBehavior(DisableTestParallelization = true)]

namespace Financeiro.IntegrationTests;

public sealed class ApiIntegrationTests
{
    private static readonly string RunId = Guid.NewGuid().ToString("N");

    [Fact]
    public async Task Financeiro_fluxo_principal_isola_usuarios_e_processa_cartao()
    {
        var connectionString = GetApprovedTestConnection();
        await AssertMigrationAppliedAsync(connectionString);

        await using var factory = new FinanceiroApiFactory(connectionString);
        using var client = factory.CreateClient();

        var email = $"user-a-{RunId}@test.local";
        var password = "ValidPassword123!";
        var register = await client.PostAsJsonAsync("/api/v1/auth/register", new { name = $"Pessoa Um {RunId}", email, password });
        var registerContent = await register.Content.ReadAsStringAsync();
        Console.WriteLine($"Register trace: {register.Headers.TryGetValues("traceId", out var traceValues)} {string.Join(",", traceValues ?? [])}");
        Assert.True(register.IsSuccessStatusCode, $"Registration failed with {(int)register.StatusCode}: {registerContent}");
        Assert.Equal(HttpStatusCode.Created, register.StatusCode);
        var auth = JsonSerializer.Deserialize<JsonElement>(registerContent);
        var accessToken = auth.GetProperty("accessToken").GetString();
        Assert.False(string.IsNullOrWhiteSpace(accessToken), $"Registration response did not contain an access token: {registerContent}");
        Assert.Equal("Financeiro.Api", ReadJwtClaim(accessToken!, "iss"));
        Assert.Equal("Financeiro.Test", ReadJwtClaim(accessToken!, "aud"));
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        var me = await client.GetAsync("/api/v1/users/me");
        Assert.True(me.IsSuccessStatusCode, $"Authenticated user check failed with {(int)me.StatusCode}: {await me.Content.ReadAsStringAsync()}");

        var source = await PostJson(client, "/api/v1/accounts", new { name = $"Conta corrente {RunId}", institution = "Banco", type = 0, initialBalance = 1000, isActive = true });
        var destination = await PostJson(client, "/api/v1/accounts", new { name = $"Poupança {RunId}", institution = "Banco", type = 1, initialBalance = 0, isActive = true });
        var sourceId = source.GetProperty("id").GetGuid();
        var destinationId = destination.GetProperty("id").GetGuid();

        var category = await PostJson(client, "/api/v1/categories", new { name = $"Mercado {RunId}", type = 1, isActive = true });
        var transactionResponse = await client.PostAsJsonAsync("/api/v1/transactions", new { description = $"Compra {RunId}", amount = 100, type = 1, status = 1, date = "2026-09-27", paidAt = "2026-09-27", accountId = sourceId, categoryId = category.GetProperty("id").GetGuid() });
        var transactionBody = await transactionResponse.Content.ReadAsStringAsync();
        Assert.True(transactionResponse.IsSuccessStatusCode, $"POST /api/v1/transactions returned {(int)transactionResponse.StatusCode}: {transactionBody}");
        var transaction = JsonSerializer.Deserialize<JsonElement>(transactionBody).EnumerateArray().First();
        Assert.Equal($"Compra {RunId}", transaction.GetProperty("description").GetString());

        var transfer = await client.PostAsJsonAsync("/api/v1/transfers", new { sourceAccountId = sourceId, destinationAccountId = destinationId, amount = 250, date = "2026-09-27", description = $"Reserva {RunId}" });
        Assert.Equal(HttpStatusCode.Created, transfer.StatusCode);

        var card = await PostJson(client, "/api/v1/credit-cards", new { name = $"Cartão principal {RunId}", bank = "Banco", brand = 0, limit = 3000, bestPurchaseDay = 5, closingDay = 10, dueDay = 17, isActive = true });
        var purchase = await client.PostAsJsonAsync($"/api/v1/credit-cards/{card.GetProperty("id").GetGuid()}/purchases", new { description = $"Notebook {RunId}", totalAmount = 1200, purchaseDate = "2026-09-27", installmentCount = 3 });
        var purchaseContent = await purchase.Content.ReadAsStringAsync();
        Assert.True(purchase.StatusCode == HttpStatusCode.OK, $"Purchase returned {(int)purchase.StatusCode}: {purchaseContent}");
        var purchaseBody = JsonSerializer.Deserialize<JsonElement>(purchaseContent);
        Assert.Equal(3, purchaseBody.GetProperty("installments").GetArrayLength());

        var secondEmail = $"user-b-{RunId}@test.local";
        var secondRegister = await client.PostAsJsonAsync("/api/v1/auth/register", new { name = $"Pessoa Dois {RunId}", email = secondEmail, password });
        var secondRegisterContent = await secondRegister.Content.ReadAsStringAsync();
        Assert.Equal(HttpStatusCode.Created, secondRegister.StatusCode);
        var secondAuth = JsonSerializer.Deserialize<JsonElement>(secondRegisterContent);
        var secondAccessToken = secondAuth.GetProperty("accessToken").GetString();
        Assert.False(string.IsNullOrWhiteSpace(secondAccessToken), $"Second registration response did not contain an access token: {secondRegisterContent}");
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", secondAccessToken);
        var otherAccount = await client.GetAsync($"/api/v1/accounts/{sourceId}");
        Assert.Equal(HttpStatusCode.NotFound, otherAccount.StatusCode);

        var foreignAccountUpdate = await client.PutAsJsonAsync($"/api/v1/accounts/{sourceId}", new { name = "Conta invadida", institution = "Banco", type = 0, initialBalance = 1, isActive = true });
        Assert.Equal(HttpStatusCode.NotFound, foreignAccountUpdate.StatusCode);
        var foreignAccountDelete = await client.DeleteAsync($"/api/v1/accounts/{sourceId}");
        Assert.Equal(HttpStatusCode.NotFound, foreignAccountDelete.StatusCode);

        var foreignTransaction = await client.PostAsJsonAsync("/api/v1/transactions", new { description = "Tentativa", amount = 1, type = 1, status = 1, date = "2026-09-27", accountId = sourceId, categoryId = category.GetProperty("id").GetGuid() });
        Assert.Equal(HttpStatusCode.BadRequest, foreignTransaction.StatusCode);
        var secondAccount = await PostJson(client, "/api/v1/accounts", new { name = $"Conta B {RunId}", institution = "Banco B", type = 0, initialBalance = 0, isActive = true });
        var foreignCategoryTransaction = await client.PostAsJsonAsync("/api/v1/transactions", new { description = $"Categoria estrangeira {RunId}", amount = 1, type = 1, status = 1, date = "2026-09-27", paidAt = "2026-09-27", accountId = secondAccount.GetProperty("id").GetGuid(), categoryId = category.GetProperty("id").GetGuid() });
        Assert.Equal(HttpStatusCode.BadRequest, foreignCategoryTransaction.StatusCode);
        var foreignTransfer = await client.PostAsJsonAsync("/api/v1/transfers", new { sourceAccountId = sourceId, destinationAccountId = secondAccount.GetProperty("id").GetGuid(), amount = 1, date = "2026-09-27", description = "Tentativa" });
        Assert.Equal(HttpStatusCode.BadRequest, foreignTransfer.StatusCode);

        var foreignSubscription = await client.PostAsJsonAsync("/api/v1/subscriptions", new { name = "Tentativa", amount = 10, cycle = 0, billingDay = 1, startDate = "2026-09-27", accountId = sourceId, isActive = true });
        Assert.Equal(HttpStatusCode.BadRequest, foreignSubscription.StatusCode);

        var foreignParent = await client.PostAsJsonAsync("/api/v1/categories", new { name = "Subcategoria invasora", type = 1, parentId = category.GetProperty("id").GetGuid(), isActive = true });
        Assert.Equal(HttpStatusCode.BadRequest, foreignParent.StatusCode);
        var foreignBudget = await client.PostAsJsonAsync("/api/v1/budgets", new { categoryId = category.GetProperty("id").GetGuid(), month = 9, year = 2026, amount = 10 });
        Assert.Equal(HttpStatusCode.BadRequest, foreignBudget.StatusCode);

        var foreignPurchase = await client.PostAsJsonAsync($"/api/v1/credit-cards/{card.GetProperty("id").GetGuid()}/purchases", new { description = "Tentativa", totalAmount = 10, purchaseDate = "2026-09-27", installmentCount = 1 });
        Assert.Equal(HttpStatusCode.NotFound, foreignPurchase.StatusCode);
        var foreignInvoices = await client.GetAsync($"/api/v1/credit-cards/{card.GetProperty("id").GetGuid()}/invoices");
        Assert.Equal(HttpStatusCode.NotFound, foreignInvoices.StatusCode);
        var foreignGoals = await client.GetAsync("/api/v1/goals");
        Assert.DoesNotContain(RunId, await foreignGoals.Content.ReadAsStringAsync(), StringComparison.OrdinalIgnoreCase);
        var foreignInvestments = await client.GetAsync("/api/v1/investments");
        Assert.DoesNotContain(RunId, await foreignInvestments.Content.ReadAsStringAsync(), StringComparison.OrdinalIgnoreCase);
        var foreignDebts = await client.GetAsync("/api/v1/debts");
        Assert.DoesNotContain(RunId, await foreignDebts.Content.ReadAsStringAsync(), StringComparison.OrdinalIgnoreCase);
        var foreignSubscriptions = await client.GetAsync("/api/v1/subscriptions");
        Assert.DoesNotContain(RunId, await foreignSubscriptions.Content.ReadAsStringAsync(), StringComparison.OrdinalIgnoreCase);
        var foreignNotifications = await client.GetAsync("/api/v1/notifications");
        Assert.DoesNotContain(RunId, await foreignNotifications.Content.ReadAsStringAsync(), StringComparison.OrdinalIgnoreCase);

        var foreignDashboard = await client.GetStringAsync("/api/v1/dashboard");
        Assert.DoesNotContain(sourceId.ToString(), foreignDashboard, StringComparison.OrdinalIgnoreCase);
        var foreignReport = await client.GetStringAsync("/api/v1/reports/summary");
        Assert.DoesNotContain(RunId, foreignReport, StringComparison.OrdinalIgnoreCase);
        var foreignSearch = await client.GetStringAsync($"/api/v1/search?q=Conta%20corrente%20{RunId}");
        Assert.DoesNotContain(sourceId.ToString(), foreignSearch, StringComparison.OrdinalIgnoreCase);
        var foreignExport = await client.GetStringAsync("/api/v1/import-export/transactions.csv");
        Assert.DoesNotContain(RunId, foreignExport, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Auth_refresh_reuse_logout_password_and_csrf_are_enforced()
    {
        var connectionString = GetApprovedTestConnection();
        await AssertMigrationAppliedAsync(connectionString);
        await using var factory = new FinanceiroApiFactory(connectionString);
        using var client = factory.CreateClient();
        var session = await RegisterAsync(client, "auth");

        using var unauthenticated = factory.CreateClient();
        Assert.Equal(HttpStatusCode.Unauthorized, (await unauthenticated.GetAsync("/api/v1/accounts")).StatusCode);
        unauthenticated.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", "not-a-jwt");
        Assert.Equal(HttpStatusCode.Unauthorized, (await unauthenticated.GetAsync("/api/v1/accounts")).StatusCode);
        var expiredToken = new JwtSecurityTokenHandler().CreateEncodedJwt(new SecurityTokenDescriptor
        {
            Subject = new System.Security.Claims.ClaimsIdentity([new System.Security.Claims.Claim("sub", Guid.NewGuid().ToString())]),
            NotBefore = DateTime.UtcNow.AddMinutes(-10),
            Expires = DateTime.UtcNow.AddMinutes(-5),
            Issuer = "Financeiro.Api",
            Audience = "Financeiro.Test",
            SigningCredentials = new SigningCredentials(new SymmetricSecurityKey(Encoding.UTF8.GetBytes("integration-test-key-with-at-least-32-characters")), SecurityAlgorithms.HmacSha256)
        });
        unauthenticated.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", expiredToken);
        Assert.Equal(HttpStatusCode.Unauthorized, (await unauthenticated.GetAsync("/api/v1/accounts")).StatusCode);

        var login = await client.PostAsJsonAsync("/api/v1/auth/login", new { email = session.Email, password = session.Password });
        Assert.Equal(HttpStatusCode.OK, login.StatusCode);
        var invalidRefresh = await RefreshAsync(client, $"invalid-{RunId}", "http://localhost:3000", $"invalid-{RunId}");
        Assert.Equal(HttpStatusCode.Unauthorized, invalidRefresh.StatusCode);
        var loginRefresh = GetRefreshCookie(login);
        Assert.False(string.IsNullOrWhiteSpace(loginRefresh));

        var refreshed = await RefreshAsync(client, loginRefresh!, "http://localhost:3000", loginRefresh!);
        Assert.Equal(HttpStatusCode.OK, refreshed.StatusCode);
        var rotatedRefresh = GetRefreshCookie(refreshed);
        Assert.False(string.IsNullOrWhiteSpace(rotatedRefresh));

        var reuse = await RefreshAsync(client, loginRefresh!, "http://localhost:3000", loginRefresh!);
        Assert.Equal(HttpStatusCode.Unauthorized, reuse.StatusCode);
        var familyRevoked = await RefreshAsync(client, rotatedRefresh!, "http://localhost:3000", rotatedRefresh!);
        Assert.Equal(HttpStatusCode.Unauthorized, familyRevoked.StatusCode);

        var logoutSession = await RegisterAsync(client, "logout");
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", logoutSession.AccessToken);
        using var logout = new HttpRequestMessage(HttpMethod.Post, "/api/v1/auth/logout") { Content = JsonContent.Create(new { refreshToken = logoutSession.RefreshToken }) };
        logout.Headers.Add("Origin", "http://localhost:3000");
        logout.Headers.Add("Cookie", $"refreshToken={logoutSession.RefreshToken}");
        var logoutResponse = await client.SendAsync(logout);
        var logoutBody = await logoutResponse.Content.ReadAsStringAsync();
        Assert.True(logoutResponse.StatusCode == HttpStatusCode.NoContent, $"Logout returned {(int)logoutResponse.StatusCode}: {logoutBody}");
        Assert.Equal(HttpStatusCode.Unauthorized, (await RefreshAsync(client, logoutSession.RefreshToken, "http://localhost:3000", logoutSession.RefreshToken)).StatusCode);

        var passwordSession = await RegisterAsync(client, "password");
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", passwordSession.AccessToken);
        var passwordChange = await client.PostAsJsonAsync("/api/v1/users/change-password", new { currentPassword = passwordSession.Password, newPassword = "NewValidPassword123!" });
        Assert.Equal(HttpStatusCode.NoContent, passwordChange.StatusCode);
        var passwordRefresh = await RefreshAsync(client, passwordSession.RefreshToken, "http://localhost:3000", passwordSession.RefreshToken);
        Assert.Equal(HttpStatusCode.Unauthorized, passwordRefresh.StatusCode);

        var resetSession = await RegisterAsync(client, "reset");
        var forgot = await client.PostAsJsonAsync("/api/v1/auth/forgot-password", new { email = resetSession.Email });
        Assert.Equal(HttpStatusCode.Accepted, forgot.StatusCode);
        var emailService = factory.Services.GetRequiredService<TestEmailService>();
        Assert.NotNull(emailService.LastResetUrl);
        var token = Uri.UnescapeDataString(emailService.LastResetUrl!.Split("token=", 2)[1]);
        var reset = await client.PostAsJsonAsync("/api/v1/auth/reset-password", new { email = resetSession.Email, token, newPassword = "ResetValidPassword123!" });
        Assert.Equal(HttpStatusCode.NoContent, reset.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await RefreshAsync(client, resetSession.RefreshToken, "http://localhost:3000", resetSession.RefreshToken)).StatusCode);

        var csrfSession = await RegisterAsync(client, "csrf");
        Assert.Equal(HttpStatusCode.Unauthorized, (await RefreshAsync(client, csrfSession.RefreshToken, "https://evil.example", csrfSession.RefreshToken)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await RefreshAsync(client, csrfSession.RefreshToken, "http://localhost:3000", csrfSession.RefreshToken)).StatusCode);
        var refererSession = await RegisterAsync(client, "referer");
        Assert.Equal(HttpStatusCode.OK, (await RefreshAsync(client, refererSession.RefreshToken, null, refererSession.RefreshToken, "http://localhost:3000/login")).StatusCode);
        var noOriginSession = await RegisterAsync(client, "no-origin");
        Assert.Equal(HttpStatusCode.Unauthorized, (await RefreshAsync(client, noOriginSession.RefreshToken, null, noOriginSession.RefreshToken)).StatusCode);
        var expiredRefresh = await RegisterAsync(client, "expired-refresh");
        await ExpireRefreshTokenAsync(connectionString, expiredRefresh.RefreshToken);
        Assert.Equal(HttpStatusCode.Unauthorized, (await RefreshAsync(client, expiredRefresh.RefreshToken, "http://localhost:3000", expiredRefresh.RefreshToken)).StatusCode);
        var badRefererSession = await RegisterAsync(client, "bad-referer");
        Assert.Equal(HttpStatusCode.Unauthorized, (await RefreshAsync(client, badRefererSession.RefreshToken, null, badRefererSession.RefreshToken, "https://evil.example/login")).StatusCode);
    }

    [Fact]
    public async Task Auth_rate_limit_rejects_excess_requests()
    {
        var connectionString = GetApprovedTestConnection();
        await AssertMigrationAppliedAsync(connectionString);
        await using var factory = new FinanceiroApiFactory(connectionString);
        using var client = factory.CreateClient();
        var responses = new List<HttpStatusCode>();
        for (var i = 0; i < 11; i++)
            responses.Add((await client.PostAsJsonAsync("/api/v1/auth/forgot-password", new { email = $"missing-{Guid.NewGuid():N}@example.test" })).StatusCode);
        Assert.Equal(10, responses.Count(x => x == HttpStatusCode.Accepted));
        Assert.Equal(HttpStatusCode.TooManyRequests, responses[^1]);
    }

    [Fact]
    public async Task Csv_export_neutralizes_formula_prefixes()
    {
        var connectionString = GetApprovedTestConnection();
        await AssertMigrationAppliedAsync(connectionString);
        await using var factory = new FinanceiroApiFactory(connectionString);
        using var client = factory.CreateClient();
        var session = await RegisterAsync(client, "csv");
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", session.AccessToken);
        var account = await PostJson(client, "/api/v1/accounts", new { name = "CSV", institution = "Teste", type = 0, initialBalance = 0, isActive = true });
        var category = await PostJson(client, "/api/v1/categories", new { name = "CSV", type = 1, isActive = true });
        foreach (var description in new[] { "=SUM(A1:A2)", "+cmd", "-1+2", "@formula" })
            await client.PostAsJsonAsync("/api/v1/transactions", new { description, amount = 1, type = 1, status = 1, date = "2026-09-27", paidAt = "2026-09-27", accountId = account.GetProperty("id").GetGuid(), categoryId = category.GetProperty("id").GetGuid() });
        var csv = await client.GetStringAsync("/api/v1/import-export/transactions.csv");
        Assert.Contains("'=SUM(A1:A2)", csv);
        Assert.Contains("'+cmd", csv);
        Assert.Contains("'-1+2", csv);
        Assert.Contains("'@formula", csv);
    }

    private static string GetApprovedTestConnection()
    {
        var connectionString = Environment.GetEnvironmentVariable("TEST_CONNECTION_STRING");
        if (string.IsNullOrWhiteSpace(connectionString)) throw new InvalidOperationException("TEST_CONNECTION_STRING é obrigatória.");
        if (!string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("ConnectionStrings__Postgres"))) throw new InvalidOperationException("ConnectionStrings__Postgres não pode ser usada nos testes.");
        if (Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT")?.Equals("Production", StringComparison.OrdinalIgnoreCase) == true) throw new InvalidOperationException("Testes não podem executar em Production.");
        var parsed = new NpgsqlConnectionStringBuilder(connectionString);
        if (!(parsed.Host?.EndsWith(".supabase.co", StringComparison.OrdinalIgnoreCase) ?? false) || !string.Equals(parsed.Database, "postgres", StringComparison.OrdinalIgnoreCase) || (parsed.Host?.Contains("render", StringComparison.OrdinalIgnoreCase) ?? false)) throw new InvalidOperationException("A suíte aceita somente TEST_CONNECTION_STRING do Supabase de testes.");
        return connectionString;
    }

    private static async Task AssertMigrationAppliedAsync(string connectionString)
    {
        await using var connection = new NpgsqlConnection(connectionString);
        await connection.OpenAsync();
        await using var command = connection.CreateCommand();
        command.CommandText = "SELECT COUNT(*) FROM public.\"__EFMigrationsHistory\" WHERE \"MigrationId\" = '20260927030932_InitialCreate';";
        var count = Convert.ToInt32(await command.ExecuteScalarAsync());
        Assert.Equal(1, count);
    }

    private static async Task ExpireRefreshTokenAsync(string connectionString, string rawToken)
    {
        await using var db = new FinanceiroDbContext(
            new DbContextOptionsBuilder<FinanceiroDbContext>().UseNpgsql(connectionString).Options,
            new TestCurrentUser());
        var hash = Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(Encoding.UTF8.GetBytes(rawToken)));
        var token = await db.RefreshTokens.IgnoreQueryFilters().SingleAsync(x => x.TokenHash == hash);
        token.ExpiresAt = DateTime.UtcNow.AddMinutes(-1);
        await db.SaveChangesAsync();
    }

    private static async Task<AuthSession> RegisterAsync(HttpClient client, string label)
    {
        var email = $"{label}-{RunId}-{Guid.NewGuid():N}@test.local";
        const string password = "ValidPassword123!";
        var response = await client.PostAsJsonAsync("/api/v1/auth/register", new { name = $"{label}-{RunId}", email, password });
        var content = await response.Content.ReadAsStringAsync();
        Assert.True(response.StatusCode == HttpStatusCode.Created, $"Registration failed with {(int)response.StatusCode}: {content}");
        var body = JsonSerializer.Deserialize<JsonElement>(content);
        var accessToken = body.GetProperty("accessToken").GetString();
        var refreshToken = GetRefreshCookie(response);
        Assert.False(string.IsNullOrWhiteSpace(accessToken));
        Assert.False(string.IsNullOrWhiteSpace(refreshToken));
        return new AuthSession(email, password, accessToken!, refreshToken!);
    }

    private static async Task<HttpResponseMessage> RefreshAsync(HttpClient client, string refreshToken, string? origin, string cookie, string? referer = null)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, "/api/v1/auth/refresh") { Content = JsonContent.Create(new { refreshToken }) };
        request.Headers.Add("Cookie", $"refreshToken={cookie}");
        if (origin is not null) request.Headers.Add("Origin", origin);
        if (referer is not null) request.Headers.Add("Referer", referer);
        return await client.SendAsync(request);
    }

    private static string? GetRefreshCookie(HttpResponseMessage response)
    {
        if (!response.Headers.TryGetValues("Set-Cookie", out var values)) return null;
        var cookie = values.FirstOrDefault(x => x.StartsWith("refreshToken=", StringComparison.OrdinalIgnoreCase));
        return cookie?.Split(';', 2)[0].Split('=', 2)[1];
    }

    private sealed record AuthSession(string Email, string Password, string AccessToken, string RefreshToken);

    private static string? ReadJwtClaim(string token, string claim)
    {
        var parts = token.Split('.');
        Assert.Equal(3, parts.Length);
        var payload = JsonSerializer.Deserialize<JsonElement>(Convert.FromBase64String(PadBase64(parts[1])));
        return payload.TryGetProperty(claim, out var value) ? value.GetString() : null;
    }

    private static string PadBase64(string value) => value.Replace('-', '+').Replace('_', '/') + new string('=', (4 - value.Length % 4) % 4);

    private static async Task<JsonElement> PostJson(HttpClient client, string path, object body)
    {
        var response = await client.PostAsJsonAsync(path, body);
        var content = await response.Content.ReadAsStringAsync();
        Assert.True(response.IsSuccessStatusCode, $"POST {path} returned {(int)response.StatusCode}: {content}");
        return JsonSerializer.Deserialize<JsonElement>(content);
    }
}

internal sealed class TestCurrentUser : ICurrentUser
{
    public Guid UserId => Guid.Empty;
}

internal sealed class TestEmailService : IEmailService
{
    public string? LastResetUrl { get; private set; }

    public Task SendPasswordResetAsync(string email, string resetUrl, CancellationToken ct)
    {
        LastResetUrl = resetUrl;
        return Task.CompletedTask;
    }
}

internal sealed class FinanceiroApiFactory(string connectionString) : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.UseSetting("ConnectionStrings:Postgres", connectionString);
        builder.ConfigureAppConfiguration((_, config) => config.AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["ConnectionStrings:Postgres"] = connectionString,
            ["ConnectionStrings:DefaultConnection"] = connectionString,
            ["Jwt:Key"] = "integration-test-key-with-at-least-32-characters",
            ["Jwt:Issuer"] = "Financeiro.Api",
            ["Jwt:Audience"] = "Financeiro.Test",
            ["Seed:Enabled"] = "false",
            ["Cors:Origins:0"] = "http://localhost:3000",
            ["Frontend:Url"] = "http://localhost:3000"
        }));
        builder.ConfigureLogging(logging =>
        {
            logging.ClearProviders();
            logging.AddConsole();
            logging.SetMinimumLevel(LogLevel.Debug);
        });
        builder.ConfigureServices(services =>
        {
            services.RemoveAll<IEmailService>();
            services.AddSingleton<TestEmailService>();
            services.AddSingleton<IEmailService>(services => services.GetRequiredService<TestEmailService>());
            services.PostConfigure<JwtBearerOptions>(JwtBearerDefaults.AuthenticationScheme, options =>
            {
                options.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidateIssuer = true,
                    ValidateAudience = true,
                    ValidateLifetime = true,
                    ValidateIssuerSigningKey = true,
                    ValidIssuer = "Financeiro.Api",
                    ValidAudience = "Financeiro.Test",
                    IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes("integration-test-key-with-at-least-32-characters")),
                    ClockSkew = TimeSpan.FromSeconds(30)
                };
            });
        });
    }
}
