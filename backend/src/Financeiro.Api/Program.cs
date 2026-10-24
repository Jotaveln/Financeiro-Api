using System.Text;
using System.Threading.RateLimiting;
using Financeiro.Application;
using Financeiro.Infrastructure;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi;
using Serilog;

var builder = WebApplication.CreateBuilder(args);
builder.Host.UseSerilog((ctx, cfg) => cfg.ReadFrom.Configuration(ctx.Configuration).Enrich.FromLogContext().WriteTo.Console());
var isDevelopment = builder.Environment.IsDevelopment();
var isProduction = builder.Environment.IsProduction();
var connection = builder.Configuration.GetConnectionString("Postgres")
    ?? builder.Configuration.GetConnectionString("DefaultConnection")
    ?? throw new InvalidOperationException("Configure ConnectionStrings:Postgres ou ConnectionStrings:DefaultConnection.");
var jwtKey = builder.Configuration["Jwt:Key"] ?? throw new InvalidOperationException("Jwt:Key não configurada.");
var jwtIssuer = builder.Configuration["Jwt:Issuer"] ?? throw new InvalidOperationException("Jwt:Issuer não configurada.");
var jwtAudience = builder.Configuration["Jwt:Audience"] ?? throw new InvalidOperationException("Jwt:Audience não configurada.");
if (jwtKey.Length < 32 || (!isDevelopment && jwtKey.Contains("CHANGE_ME", StringComparison.OrdinalIgnoreCase)))
    throw new InvalidOperationException("Jwt:Key deve ter no mínimo 32 caracteres e não pode usar o placeholder em produção.");
var corsOrigins = builder.Configuration.GetSection("Cors:Origins").Get<string[]>() ?? [];
var frontendUrl = builder.Configuration["Frontend:Url"];
if (isProduction)
{
    if (corsOrigins.Length == 0 || corsOrigins.Any(x => !Uri.TryCreate(x, UriKind.Absolute, out var uri) || uri.Scheme != Uri.UriSchemeHttps))
        throw new InvalidOperationException("Configure pelo menos uma origem HTTPS explícita em Cors:Origins em produção.");
    if (!Uri.TryCreate(frontendUrl, UriKind.Absolute, out var frontendUri) || frontendUri.Scheme != Uri.UriSchemeHttps)
        throw new InvalidOperationException("Configure Frontend:Url com a URL HTTPS pública do frontend em produção.");
    if (connection.Contains("Host=localhost", StringComparison.OrdinalIgnoreCase) || connection.Contains("Password=postgres", StringComparison.OrdinalIgnoreCase))
        throw new InvalidOperationException("Configure ConnectionStrings:Postgres com o banco de produção.");
}
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ICurrentUser, HttpCurrentUser>();
builder.Services.AddDbContext<FinanceiroDbContext>(o => o.UseNpgsql(connection));
builder.Services.AddIdentityCore<ApplicationUser>(o => { o.Password.RequiredLength = 8; o.Password.RequireNonAlphanumeric = true; o.Lockout.MaxFailedAccessAttempts = 5; o.User.RequireUniqueEmail = true; })
    .AddEntityFrameworkStores<FinanceiroDbContext>().AddSignInManager().AddDefaultTokenProviders();
builder.Services.AddScoped<TokenService>();
builder.Services.AddHttpClient<IEmailService, EmailService>();
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer(o => o.TokenValidationParameters = new()
{
    ValidateIssuer = true, ValidateAudience = true, ValidateLifetime = true, ValidateIssuerSigningKey = true,
    ValidIssuer = jwtIssuer, ValidAudience = jwtAudience,
    IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)), ClockSkew = TimeSpan.FromSeconds(30)
});
builder.Services.AddAuthorization();
builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<GlobalExceptionHandler>();
builder.Services.AddControllers().AddJsonOptions(o => o.JsonSerializerOptions.Converters.Add(new System.Text.Json.Serialization.JsonStringEnumConverter()));
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(o =>
{
    o.SwaggerDoc("v1", new OpenApiInfo { Title = "Financeiro API", Version = "v1", Description = "API de gestão financeira pessoal" });
    o.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme { Type = SecuritySchemeType.Http, Scheme = "bearer", BearerFormat = "JWT" });
});
builder.Services.AddCors(o => o.AddDefaultPolicy(p => p.WithOrigins(corsOrigins.Length > 0 ? corsOrigins : ["http://localhost:3000"]).AllowAnyHeader().AllowAnyMethod().AllowCredentials()));
builder.Services.AddRateLimiter(o => { o.RejectionStatusCode = 429; o.AddPolicy("auth", c => RateLimitPartition.GetFixedWindowLimiter(c.Connection.RemoteIpAddress?.ToString() ?? "unknown", _ => new() { PermitLimit = 10, Window = TimeSpan.FromMinutes(1) })); });
builder.Services.AddHealthChecks().AddCheck<DatabaseHealthCheck>("postgresql", tags: ["ready"]);

var app = builder.Build();
app.UseForwardedHeaders(new ForwardedHeadersOptions { ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto });
app.UseExceptionHandler();
app.UseSerilogRequestLogging();
app.Use(async (ctx, next) => { ctx.Response.Headers["X-Content-Type-Options"] = "nosniff"; ctx.Response.Headers["X-Frame-Options"] = "DENY"; ctx.Response.Headers["Referrer-Policy"] = "strict-origin-when-cross-origin"; await next(); });
if (app.Environment.IsDevelopment()) { app.UseSwagger(); app.UseSwaggerUI(); }
else { app.UseHsts(); }
app.UseHttpsRedirection(); app.UseCors(); app.UseRateLimiter(); app.UseAuthentication(); app.UseAuthorization();
app.MapControllers(); app.MapHealthChecks("/health/live", new() { Predicate = _ => false }); app.MapHealthChecks("/health/ready", new() { Predicate = check => check.Tags.Contains("ready") });
if (builder.Configuration.GetValue("Database:ApplyMigrations", false))
{
    await using var scope = app.Services.CreateAsyncScope();
    var db = scope.ServiceProvider.GetRequiredService<FinanceiroDbContext>();
    await db.Database.MigrateAsync();
}
await SeedData.InitializeAsync(app.Services, app.Configuration, app.Environment);
app.Run();
public partial class Program { }
