using System.Security.Claims;
using System.Text;
using Financeiro.Application;
using Financeiro.Domain;
using Financeiro.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.EntityFrameworkCore;

namespace Financeiro.Api.Controllers;

[ApiController, Route("api/v1/auth"), EnableRateLimiting("auth")]
public sealed class AuthController(UserManager<ApplicationUser> users, SignInManager<ApplicationUser> signIn, TokenService tokens, FinanceiroDbContext db, IEmailService email, IConfiguration config) : ControllerBase
{
    [HttpPost("register")]
    public async Task<IActionResult> Register(RegisterRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Name)) { ModelState.AddModelError("name", "Nome é obrigatório."); return ValidationProblem(ModelState); }
        var user = new ApplicationUser { Id = Guid.NewGuid(), Name = request.Name.Trim(), Email = request.Email.Trim().ToLowerInvariant(), UserName = request.Email.Trim().ToLowerInvariant() };
        var result = await users.CreateAsync(user, request.Password);
        if (!result.Succeeded) { foreach (var error in result.Errors) ModelState.AddModelError(error.Code, error.Description); return ValidationProblem(ModelState); }
        db.UserSettings.Add(new UserSettings { UserId = user.Id }); await db.SaveChangesAsync(ct);
        return Created("/api/v1/users/me", await Issue(user, ct));
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login(LoginRequest request, CancellationToken ct)
    {
        var user = await users.FindByEmailAsync(request.Email.Trim());
        if (user is null || !(await signIn.CheckPasswordSignInAsync(user, request.Password, true)).Succeeded) return Unauthorized(new ProblemDetails { Title = "Credenciais inválidas", Status = 401 });
        return Ok(await Issue(user, ct));
    }

    [HttpPost("refresh")]
    public async Task<IActionResult> Refresh(RefreshRequest request, CancellationToken ct)
    {
        var raw = Request.Cookies["refreshToken"] ?? request.RefreshToken;
        if (string.IsNullOrWhiteSpace(raw)) return Unauthorized();
        var rotated = await tokens.RotateAsync(raw, ct);
        if (rotated is null) return Unauthorized();
        SetRefreshCookie(rotated.Value.Tokens.RefreshToken);
        return Ok(new AuthResponse(rotated.Value.Tokens.AccessToken, rotated.Value.Tokens.ExpiresAt, UserDto(rotated.Value.User)));
    }

    [Authorize, HttpPost("logout")]
    public async Task<IActionResult> Logout(RefreshRequest request, CancellationToken ct)
    {
        var raw = Request.Cookies["refreshToken"] ?? request.RefreshToken;
        if (!string.IsNullOrWhiteSpace(raw)) await tokens.RevokeAsync(raw, Guid.Parse(User.FindFirstValue("sub")!), ct);
        Response.Cookies.Delete("refreshToken"); return NoContent();
    }

    [HttpPost("forgot-password")]
    public async Task<IActionResult> Forgot(ForgotPasswordRequest request)
    {
        var user = await users.FindByEmailAsync(request.Email.Trim());
        if (user is not null)
        {
            var token = WebEncoders.Base64UrlEncode(Encoding.UTF8.GetBytes(await users.GeneratePasswordResetTokenAsync(user)));
            var baseUrl = config["Frontend:Url"] ?? throw new InvalidOperationException("Frontend:Url não configurada.");
            await email.SendPasswordResetAsync(user.Email!, $"{baseUrl.TrimEnd('/')}/redefinir-senha?email={Uri.EscapeDataString(user.Email!)}&token={Uri.EscapeDataString(token)}", HttpContext.RequestAborted);
        }
        return Accepted(new { message = "Se o e-mail estiver cadastrado, as instruções serão enviadas." });
    }

    [HttpPost("reset-password")]
    public async Task<IActionResult> Reset(ResetPasswordRequest request)
    {
        var user = await users.FindByEmailAsync(request.Email.Trim());
        if (user is null) return BadRequest(new ProblemDetails { Title = "Solicitação inválida" });
        string token;
        try { token = Encoding.UTF8.GetString(WebEncoders.Base64UrlDecode(request.Token)); } catch { return BadRequest(new ProblemDetails { Title = "Token inválido" }); }
        var result = await users.ResetPasswordAsync(user, token, request.NewPassword);
        if (result.Succeeded) return NoContent();
        foreach (var error in result.Errors) ModelState.AddModelError(error.Code, error.Description);
        return ValidationProblem(ModelState);
    }

    private async Task<AuthResponse> Issue(ApplicationUser user, CancellationToken ct) { var pair = await tokens.CreateAsync(user, ct: ct); SetRefreshCookie(pair.RefreshToken); return new(pair.AccessToken, pair.ExpiresAt, UserDto(user)); }
    private void SetRefreshCookie(string value) => Response.Cookies.Append("refreshToken", value, new() { HttpOnly = true, Secure = !HttpContext.RequestServices.GetRequiredService<IWebHostEnvironment>().IsDevelopment(), SameSite = SameSiteMode.Strict, Expires = DateTimeOffset.UtcNow.AddDays(14), Path = "/api/v1/auth" });
    private static object UserDto(ApplicationUser u) => new { u.Id, u.Name, u.Email, u.PhoneNumber };
}

[ApiController, Authorize, Route("api/v1/users")]
public sealed class UsersController(UserManager<ApplicationUser> users, FinanceiroDbContext db, ICurrentUser current) : ControllerBase
{
    [HttpGet("me")] public async Task<IActionResult> Me() { var u = await users.FindByIdAsync(current.UserId.ToString()); return u is null ? NotFound() : Ok(new { u.Id, u.Name, u.Email, u.PhoneNumber, Settings = await db.UserSettings.SingleOrDefaultAsync() }); }
    [HttpPut("me")] public async Task<IActionResult> Update(UpdateProfileRequest r) { var u = await users.FindByIdAsync(current.UserId.ToString()); if (u is null) return NotFound(); u.Name = r.Name.Trim(); u.PhoneNumber = r.PhoneNumber; var result = await users.UpdateAsync(u); return result.Succeeded ? NoContent() : BadRequest(result.Errors); }
    [HttpPost("change-password")] public async Task<IActionResult> Change(ChangePasswordRequest r) { var u = await users.FindByIdAsync(current.UserId.ToString()); if (u is null) return NotFound(); var result = await users.ChangePasswordAsync(u, r.CurrentPassword, r.NewPassword); if (result.Succeeded) return NoContent();
        foreach (var error in result.Errors) ModelState.AddModelError(error.Code, error.Description);
        return ValidationProblem(ModelState); }
    [HttpPut("settings")] public async Task<IActionResult> Settings(UserSettings r, CancellationToken ct) { var s = await db.UserSettings.SingleOrDefaultAsync(ct) ?? new UserSettings { UserId = current.UserId }; s.Currency = r.Currency; s.Culture = r.Culture; s.DateFormat = r.DateFormat; s.Theme = r.Theme; s.LowBalanceThreshold = r.LowBalanceThreshold; if (db.Entry(s).State == EntityState.Detached) db.Add(s); await db.SaveChangesAsync(ct); return Ok(s); }
}
