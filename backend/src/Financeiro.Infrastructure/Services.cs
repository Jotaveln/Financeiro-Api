using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Net.Http.Json;
using Financeiro.Application;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;

namespace Financeiro.Infrastructure;

public sealed record TokenPair(string AccessToken, DateTime ExpiresAt, string RefreshToken);

public sealed class TokenService(IConfiguration config, FinanceiroDbContext db)
{
    public async Task<TokenPair> CreateAsync(ApplicationUser user, string? family = null, CancellationToken ct = default)
    {
        var key = config["Jwt:Key"] ?? throw new InvalidOperationException("Jwt:Key não configurada.");
        if (key.Length < 32) throw new InvalidOperationException("Jwt:Key deve ter no mínimo 32 caracteres.");
        var expires = DateTime.UtcNow.AddMinutes(int.TryParse(config["Jwt:AccessMinutes"], out var accessMinutes) ? accessMinutes : 15);
        var claims = new[] { new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()), new Claim(JwtRegisteredClaimNames.Email, user.Email ?? ""), new Claim("name", user.Name), new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()) };
        var jwt = new JwtSecurityToken(config["Jwt:Issuer"], config["Jwt:Audience"], claims, expires: expires,
            signingCredentials: new SigningCredentials(new SymmetricSecurityKey(Encoding.UTF8.GetBytes(key)), SecurityAlgorithms.HmacSha256));
        var raw = Convert.ToBase64String(RandomNumberGenerator.GetBytes(64));
        db.RefreshTokens.Add(new RefreshToken { UserId = user.Id, TokenHash = Hash(raw), Family = family ?? Guid.NewGuid().ToString("N"), ExpiresAt = DateTime.UtcNow.AddDays(int.TryParse(config["Jwt:RefreshDays"], out var refreshDays) ? refreshDays : 14) });
        await db.SaveChangesAsync(ct);
        return new(new JwtSecurityTokenHandler().WriteToken(jwt), expires, raw);
    }

    public async Task<(ApplicationUser User, TokenPair Tokens)?> RotateAsync(string raw, CancellationToken ct)
    {
        var hash = Hash(raw);
        var existing = await db.RefreshTokens.IgnoreQueryFilters().Include(x => x.User).SingleOrDefaultAsync(x => x.TokenHash == hash, ct);
        if (existing is null) return null;
        if (!existing.IsActive)
        {
            if (existing.RevokedAt is not null)
            {
                var family = await db.RefreshTokens.IgnoreQueryFilters().Where(x => x.Family == existing.Family && x.RevokedAt == null).ToListAsync(ct);
                foreach (var token in family) token.RevokedAt = DateTime.UtcNow;
                await db.SaveChangesAsync(ct);
            }
            return null;
        }
        existing.RevokedAt = DateTime.UtcNow;
        var result = await CreateAsync(existing.User!, existing.Family, ct);
        existing.ReplacedByHash = Hash(result.RefreshToken);
        await db.SaveChangesAsync(ct);
        return (existing.User!, result);
    }

    public async Task RevokeAsync(string raw, Guid userId, CancellationToken ct)
    {
        var hash = Hash(raw);
        var token = await db.RefreshTokens.IgnoreQueryFilters().SingleOrDefaultAsync(x => x.TokenHash == hash && x.UserId == userId, ct);
        if (token is not null && token.RevokedAt is null) { token.RevokedAt = DateTime.UtcNow; await db.SaveChangesAsync(ct); }
    }

    private static string Hash(string value) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value)));
}

public sealed class EmailService(IConfiguration configuration, HttpClient client) : IEmailService
{
    public async Task SendPasswordResetAsync(string email, string resetUrl, CancellationToken ct)
    {
        var endpoint = configuration["Email:WebhookUrl"];
        if (string.IsNullOrWhiteSpace(endpoint)) throw new InvalidOperationException("Serviço de e-mail não configurado.");
        using var response = await client.PostAsJsonAsync(endpoint, new { to = email, subject = "Redefinição de senha", resetUrl }, ct);
        response.EnsureSuccessStatusCode();
    }
}
