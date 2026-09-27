using Financeiro.Application;
using Financeiro.Domain;
using Financeiro.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Financeiro.Api.Controllers;

[ApiController, Authorize, Route("api/v1/dashboard")]
public sealed class DashboardController(FinanceiroDbContext db) : ControllerBase
{
    [HttpGet] public async Task<IActionResult> Get(int? month,int? year,CancellationToken ct){var now=DateTime.UtcNow;var m=month??now.Month;var y=year??now.Year;var start=new DateOnly(y,m,1);var end=start.AddMonths(1);var tx=await db.Transactions.AsNoTracking().Where(x=>x.Date>=start&&x.Date<end).ToListAsync(ct);var accounts=await db.Accounts.AsNoTracking().Include(x=>x.Transactions).ToListAsync(ct);var income=tx.Where(x=>x.Type==TransactionType.Income&&x.Status!=TransactionStatus.Cancelled).Sum(x=>x.Amount);var expense=tx.Where(x=>x.Type==TransactionType.Expense&&x.Status!=TransactionStatus.Cancelled).Sum(x=>x.Amount);var byCategory=tx.Where(x=>x.Type==TransactionType.Expense).GroupBy(x=>x.Category?.Name??"Outros").Select(g=>new{category=g.Key,value=g.Sum(x=>x.Amount)}).Cast<object>().ToArray();var cash=await db.Transactions.AsNoTracking().Where(x=>x.Date>=start.AddMonths(-5)&&x.Date<end).GroupBy(x=>new{x.Date.Year,x.Date.Month}).Select(g=>new{month=$"{g.Key.Month:D2}/{g.Key.Year}",income=g.Where(x=>x.Type==TransactionType.Income).Sum(x=>x.Amount),expense=g.Where(x=>x.Type==TransactionType.Expense).Sum(x=>x.Amount)}).OrderBy(x=>x.month).Cast<object>().ToArrayAsync(ct);return Ok(new DashboardResponse(accounts.Sum(x=>x.InitialBalance+x.Transactions.Where(t=>t.Status==TransactionStatus.Paid).Sum(t=>t.Type==TransactionType.Income?t.Amount:-t.Amount)),accounts.Sum(x=>x.InitialBalance+x.Transactions.Where(t=>t.Status==TransactionStatus.Paid).Sum(t=>t.Type==TransactionType.Income?t.Amount:-t.Amount))+await db.Investments.SumAsync(x=>x.Quantity*x.CurrentPrice,ct)-await db.Debts.SelectMany(x=>x.Installments).Where(x=>x.PaidAt==null).SumAsync(x=>x.Amount,ct),income,expense,income-expense,await db.Investments.SumAsync(x=>x.Quantity*x.CurrentPrice,ct),await db.Debts.SelectMany(x=>x.Installments).Where(x=>x.PaidAt==null).SumAsync(x=>x.Amount,ct),await db.CreditCards.SumAsync(x=>x.Limit,ct),await db.Transactions.CountAsync(x=>x.Status==TransactionStatus.Pending&&x.Type==TransactionType.Expense,ct),await db.Transactions.CountAsync(x=>x.Status==TransactionStatus.Pending&&x.Type==TransactionType.Income,ct),cash,byCategory,tx.OrderByDescending(x=>x.Date).Take(8).Cast<object>().ToArray(),tx.Where(x=>x.DueDate>=DateOnly.FromDateTime(now)&&x.DueDate<=DateOnly.FromDateTime(now.AddDays(30))).OrderBy(x=>x.DueDate).Cast<object>().ToArray()));}
}

[ApiController,Authorize,Route("api/v1/budgets")]
public sealed class BudgetsController(FinanceiroDbContext db,ICurrentUser current):ControllerBase
{
 [HttpGet]public async Task<IActionResult>List(int? month,int? year,CancellationToken ct){var n=DateTime.UtcNow;var m=month??n.Month;var y=year??n.Year;var start=new DateOnly(y,m,1);var end=start.AddMonths(1);var b=await db.Budgets.AsNoTracking().Include(x=>x.Category).Where(x=>x.Month==m&&x.Year==y).ToListAsync(ct);var spent=await db.Transactions.AsNoTracking().Where(x=>x.Date>=start&&x.Date<end&&x.Type==TransactionType.Expense&&x.Status!=TransactionStatus.Cancelled).GroupBy(x=>x.CategoryId).Select(g=>new{g.Key,value=g.Sum(x=>x.Amount)}).ToDictionaryAsync(x=>x.Key,x=>x.value,ct);return Ok(b.Select(x=>new{x.Id,x.CategoryId,Category=x.Category!.Name,x.Month,x.Year,x.Amount,Spent=spent.GetValueOrDefault(x.CategoryId),Available=x.Amount-spent.GetValueOrDefault(x.CategoryId),Percent=x.Amount==0?0:spent.GetValueOrDefault(x.CategoryId)/x.Amount*100}));}
 [HttpPost]public async Task<IActionResult>Create(BudgetRequest r,CancellationToken ct){if(r.Amount<0||!await db.Categories.AnyAsync(x=>x.Id==r.CategoryId&&x.Type==TransactionType.Expense,ct))return BadRequest("Orçamento inválido.");var x=new Budget{UserId=current.UserId,CategoryId=r.CategoryId,Month=r.Month,Year=r.Year,Amount=r.Amount};db.Add(x);await db.SaveChangesAsync(ct);return Ok(x);}
 [HttpDelete("{id:guid}")]public async Task<IActionResult>Delete(Guid id,CancellationToken ct){var x=await db.Budgets.FindAsync([id],ct);if(x is null)return NotFound();db.Remove(x);await db.SaveChangesAsync(ct);return NoContent();}
}

[ApiController,Authorize,Route("api/v1/goals")]
public sealed class GoalsController(FinanceiroDbContext db,ICurrentUser current):ControllerBase
{
 [HttpGet]public async Task<IActionResult>List(CancellationToken ct)=>Ok(await db.FinancialGoals.AsNoTracking().Include(x=>x.Contributions).Select(x=>new{x.Id,x.Name,x.TargetAmount,x.Deadline,x.Color,x.IsCompleted,CurrentAmount=x.Contributions.Sum(c=>c.Amount),Percent=x.TargetAmount==0?0:x.Contributions.Sum(c=>c.Amount)/x.TargetAmount*100}).ToListAsync(ct));
 [HttpPost]public async Task<IActionResult>Create(GoalRequest r,CancellationToken ct){var x=new FinancialGoal{UserId=current.UserId,Name=r.Name.Trim(),TargetAmount=r.TargetAmount,Deadline=r.Deadline,Color=r.Color??"#10B981"};db.Add(x);await db.SaveChangesAsync(ct);return Ok(x);}
 [HttpPost("{id:guid}/contributions")]public async Task<IActionResult>Contribute(Guid id,ContributionRequest r,CancellationToken ct){if(r.Amount<=0)return BadRequest("Valor deve ser positivo.");var goal=await db.FinancialGoals.Include(x=>x.Contributions).SingleOrDefaultAsync(x=>x.Id==id,ct);if(goal is null)return NotFound();var x=new GoalContribution{UserId=current.UserId,FinancialGoalId=id,Amount=r.Amount,Date=r.Date,Notes=r.Notes};goal.IsCompleted=goal.CurrentAmount+r.Amount>=goal.TargetAmount;db.Add(x);await db.SaveChangesAsync(ct);return Ok(x);}
 [HttpDelete("{id:guid}")]public async Task<IActionResult>Delete(Guid id,CancellationToken ct){var x=await db.FinancialGoals.FindAsync([id],ct);if(x is null)return NotFound();db.Remove(x);await db.SaveChangesAsync(ct);return NoContent();}
}

[ApiController,Authorize,Route("api/v1/investments")]
public sealed class InvestmentsController(FinanceiroDbContext db,ICurrentUser current):ControllerBase
{
 [HttpGet]public async Task<IActionResult>List(CancellationToken ct)=>Ok(await db.Investments.AsNoTracking().Select(x=>new{x.Id,x.Asset,x.Type,x.Quantity,x.AveragePrice,x.CurrentPrice,x.Broker,InvestedAmount=x.Quantity*x.AveragePrice,CurrentAmount=x.Quantity*x.CurrentPrice,ReturnPercent=x.Quantity*x.AveragePrice==0?0:(x.CurrentPrice/x.AveragePrice-1)*100}).ToListAsync(ct));
 [HttpPost]public async Task<IActionResult>Create(InvestmentRequest r,CancellationToken ct){if(r.Quantity<=0||r.AveragePrice<0||r.CurrentPrice<0)return BadRequest("Valores inválidos.");var x=new Investment{UserId=current.UserId,Asset=r.Asset.Trim(),Type=r.Type,Quantity=r.Quantity,AveragePrice=r.AveragePrice,CurrentPrice=r.CurrentPrice,Broker=r.Broker};db.Add(x);await db.SaveChangesAsync(ct);return Ok(x);}
 [HttpPut("{id:guid}")]public async Task<IActionResult>Update(Guid id,InvestmentRequest r,CancellationToken ct){var x=await db.Investments.FindAsync([id],ct);if(x is null)return NotFound();x.Asset=r.Asset;x.Type=r.Type;x.Quantity=r.Quantity;x.AveragePrice=r.AveragePrice;x.CurrentPrice=r.CurrentPrice;x.Broker=r.Broker;await db.SaveChangesAsync(ct);return Ok(x);}
 [HttpDelete("{id:guid}")]public async Task<IActionResult>Delete(Guid id,CancellationToken ct){var x=await db.Investments.FindAsync([id],ct);if(x is null)return NotFound();db.Remove(x);await db.SaveChangesAsync(ct);return NoContent();}
}
