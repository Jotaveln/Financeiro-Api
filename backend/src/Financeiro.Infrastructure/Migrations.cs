using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace Financeiro.Infrastructure;

[DbContext(typeof(FinanceiroDbContext))]
[Migration("202609260001_InitialCreate")]
public sealed class InitialCreate : Migration
{
    protected override void Up(MigrationBuilder m)
    {
        m.EnsureSchema("financeiro");
        m.Sql("CREATE TABLE IF NOT EXISTS \"financeiro\".\"__MigrationMarker\" (\"Id\" integer NOT NULL);");
    }
    protected override void Down(MigrationBuilder m) => m.Sql("DROP TABLE IF EXISTS \"financeiro\".\"__MigrationMarker\";");
}
