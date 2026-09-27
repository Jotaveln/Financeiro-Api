using System.Text;
using System.Threading.RateLimiting;
using Financeiro.Application;
using Financeiro.Infrastructure;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi;
using Serilog;

var builder = WebApplication.CreateBuilder(args);
builder.Host.UseSerilog((ctx, cfg) => cfg.ReadFrom.Configuration(ctx.Configuration).Enrich.FromLogContext().WriteTo.Console());
var connection = builder.Configuration.GetConnectionString("Postgres")
    ?? builder.Configuration.GetConnectionString("DefaultConnection")
    ?? throw new InvalidOperationException("Configure ConnectionStrings:Postgres ou ConnectionStrings:DefaultConnection.");
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ICurrentUser, HttpCurrentUser>();
builder.Services.AddDbContext<FinanceiroDbContext>(o => o.UseNpgsql(connection));
builder.Services.AddIdentityCore<ApplicationUser>(o => { o.Password.RequiredLength = 8; o.Password.RequireNonAlphanumeric = true; o.Lockout.MaxFailedAccessAttempts = 5; o.User.RequireUniqueEmail = true; })
    .AddEntityFrameworkStores<FinanceiroDbContext>().AddSignInManager().AddDefaultTokenProviders();
builder.Services.AddScoped<TokenService>();
builder.Services.AddHttpClient<IEmailService, EmailService>();
var jwtKey = builder.Configuration["Jwt:Key"] ?? throw new InvalidOperationException("Jwt:Key não configurada.");
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer(o => o.TokenValidationParameters = new()
{
    ValidateIssuer = true, ValidateAudience = true, ValidateLifetime = true, ValidateIssuerSigningKey = true,
    ValidIssuer = builder.Configuration["Jwt:Issuer"], ValidAudience = builder.Configuration["Jwt:Audience"],
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
builder.Services.AddCors(o => o.AddDefaultPolicy(p => p.WithOrigins(builder.Configuration.GetSection("Cors:Origins").Get<string[]>() ?? ["http://localhost:3000"]).AllowAnyHeader().AllowAnyMethod().AllowCredentials()));
builder.Services.AddRateLimiter(o => { o.RejectionStatusCode = 429; o.AddPolicy("auth", c => RateLimitPartition.GetFixedWindowLimiter(c.Connection.RemoteIpAddress?.ToString() ?? "unknown", _ => new() { PermitLimit = 10, Window = TimeSpan.FromMinutes(1) })); });
builder.Services.AddHealthChecks().AddCheck<DatabaseHealthCheck>("postgresql", tags: ["ready"]);

var app = builder.Build();
app.UseExceptionHandler();
app.UseSerilogRequestLogging();
app.Use(async (ctx, next) => { ctx.Response.Headers["X-Content-Type-Options"] = "nosniff"; ctx.Response.Headers["X-Frame-Options"] = "DENY"; ctx.Response.Headers["Referrer-Policy"] = "strict-origin-when-cross-origin"; await next(); });
if (app.Environment.IsDevelopment()) { app.UseSwagger(); app.UseSwaggerUI(); }
else { app.UseHsts(); }
app.UseHttpsRedirection(); app.UseCors(); app.UseRateLimiter(); app.UseAuthentication(); app.UseAuthorization();
app.MapControllers(); app.MapHealthChecks("/health/live", new() { Predicate = _ => false }); app.MapHealthChecks("/health/ready", new() { Predicate = check => check.Tags.Contains("ready") });
await SeedData.InitializeAsync(app.Services, app.Configuration, app.Environment);
app.Run();
public partial class Program { }
