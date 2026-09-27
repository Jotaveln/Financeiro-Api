using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Financeiro.Infrastructure;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Testcontainers.PostgreSql;
using Xunit.Sdk;

namespace Financeiro.IntegrationTests;

public sealed class ApiIntegrationTests
{
    [Fact]
    public async Task Financeiro_fluxo_principal_isola_usuarios_e_processa_cartao()
    {
        if (!string.Equals(Environment.GetEnvironmentVariable("RUN_POSTGRES_INTEGRATION"), "true", StringComparison.OrdinalIgnoreCase))
        {
            Console.WriteLine("Integração PostgreSQL não executada: defina RUN_POSTGRES_INTEGRATION=true e tenha Docker disponível.");
            return;
        }

        PostgreSqlContainer postgres;
        try
        {
            postgres = new PostgreSqlBuilder()
                .WithImage("postgres:17-alpine")
                .WithDatabase("financeiro_test")
                .WithUsername("postgres")
                .WithPassword("postgres")
                .Build();
            await postgres.StartAsync();
        }
        catch (Exception ex) when (ex is Docker.DotNet.DockerApiException or InvalidOperationException or TimeoutException)
        {
            throw SkipException.ForSkip($"Docker/PostgreSQL indisponível: {ex.Message}");
        }

        await using var container = postgres;
        await using var factory = new FinanceiroApiFactory(container.GetConnectionString());
        using var client = factory.CreateClient();

        var email = $"{Guid.NewGuid():N}@example.test";
        var password = "ValidPassword123!";
        var register = await client.PostAsJsonAsync("/api/v1/auth/register", new { name = "Pessoa Um", email, password });
        Assert.Equal(HttpStatusCode.Created, register.StatusCode);
        var auth = await register.Content.ReadFromJsonAsync<JsonElement>();
        var accessToken = auth.GetProperty("accessToken").GetString();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);

        var source = await PostJson(client, "/api/v1/accounts", new { name = "Conta corrente", institution = "Banco", type = 0, initialBalance = 1000, isActive = true });
        var destination = await PostJson(client, "/api/v1/accounts", new { name = "Poupança", institution = "Banco", type = 1, initialBalance = 0, isActive = true });
        var sourceId = source.GetProperty("id").GetGuid();
        var destinationId = destination.GetProperty("id").GetGuid();

        var category = await PostJson(client, "/api/v1/categories", new { name = "Mercado", type = 1, isActive = true });
        var transaction = await PostJson(client, "/api/v1/transactions", new { description = "Compra", amount = 100, type = 1, status = 1, date = "2026-09-27", paidAt = "2026-09-27", accountId = sourceId, categoryId = category.GetProperty("id").GetGuid() });
        Assert.Equal("Compra", transaction.GetProperty("description").GetString());

        var transfer = await client.PostAsJsonAsync("/api/v1/transfers", new { sourceAccountId = sourceId, destinationAccountId = destinationId, amount = 250, date = "2026-09-27", description = "Reserva" });
        Assert.Equal(HttpStatusCode.Created, transfer.StatusCode);

        var card = await PostJson(client, "/api/v1/credit-cards", new { name = "Cartão principal", bank = "Banco", brand = 0, limit = 3000, bestPurchaseDay = 5, closingDay = 10, dueDay = 17, isActive = true });
        var purchase = await client.PostAsJsonAsync($"/api/v1/credit-cards/{card.GetProperty("id").GetGuid()}/purchases", new { description = "Notebook", totalAmount = 1200, purchaseDate = "2026-09-27", installmentCount = 3 });
        Assert.Equal(HttpStatusCode.OK, purchase.StatusCode);
        var purchaseBody = await purchase.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(3, purchaseBody.GetProperty("installments").GetArrayLength());

        var secondEmail = $"{Guid.NewGuid():N}@example.test";
        var secondRegister = await client.PostAsJsonAsync("/api/v1/auth/register", new { name = "Pessoa Dois", email = secondEmail, password });
        Assert.Equal(HttpStatusCode.Created, secondRegister.StatusCode);
        var otherAccount = await client.GetAsync($"/api/v1/accounts/{sourceId}");
        Assert.Equal(HttpStatusCode.NotFound, otherAccount.StatusCode);
    }

    private static async Task<JsonElement> PostJson(HttpClient client, string path, object body)
    {
        var response = await client.PostAsJsonAsync(path, body);
        Assert.True(response.IsSuccessStatusCode, await response.Content.ReadAsStringAsync());
        return await response.Content.ReadFromJsonAsync<JsonElement>();
    }
}

internal sealed class FinanceiroApiFactory(string connectionString) : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.ConfigureAppConfiguration((_, config) => config.AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["ConnectionStrings:Postgres"] = connectionString,
            ["Jwt:Key"] = "integration-test-key-with-at-least-32-characters",
            ["Jwt:Issuer"] = "Financeiro.Api",
            ["Jwt:Audience"] = "Financeiro.Test",
            ["Seed:Enabled"] = "false",
            ["Cors:Origins:0"] = "http://localhost:3000"
        }));
    }
}
