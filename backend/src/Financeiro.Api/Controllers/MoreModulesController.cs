using CsvHelper;
using Financeiro.Application;
using Financeiro.Domain;
using Financeiro.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Globalization;
using System.Text;

namespace Financeiro.Api.Controllers;

[ApiController,Authorize,Route("api/v1/debts")]
public sealed class DebtsController(FinanceiroDbContext db,ICurrentUser current):ControllerBase
{
 [HttpGet]public async Task<IActionResult>List(CancellationToken ct)=>Ok(await db.Debts.AsNoTracking().Include(x=>x.Installments).Select(x=>new{x.Id,x.Name,x.Type,x.Principal,x.InterestRate,x.InstallmentCount,x.StartDate,Paid=x.Installments.Where(i=>i.PaidAt!=null).Sum(i=>i.Amount),Remaining=x.Installments.Where(i=>i.PaidAt==null).Sum(i=>i.Amount),NextDue=x.Installments.Where(i=>i.PaidAt==null).OrderBy(i=>i.DueDate).Select(i=>(DateOnly?)i.DueDate).FirstOrDefault()}).ToListAsync(ct));
 [HttpPost]public async Task<IActionResult>Create(DebtRequest r,CancellationToken ct){if(r.Principal<=0||r.InstallmentCount<1)return BadRequest("Dívida inválida.");var d=new Debt{UserId=current.UserId,Name=r.Name.Trim(),Type=r.Type,Principal=r.Principal,InterestRate=r.InterestRate,InstallmentCount=r.InstallmentCount,StartDate=r.StartDate};var amount=decimal.Round(r.Principal/r.InstallmentCount,2);for(var i=1;i<=r.InstallmentCount;i++)d.Installments.Add(new DebtInstallment{UserId=current.UserId,Number=i,Amount=i==r.InstallmentCount?r.Principal-amount*(r.InstallmentCount-1):amount,DueDate=r.StartDate.AddMonths(i)});db.Add(d);await db.SaveChangesAsync(ct);return Ok(d);}
 [HttpDelete("{id:guid}")]public async Task<IActionResult>Delete(Guid id,CancellationToken ct){var d=await db.Debts.FindAsync([id],ct);if(d is null)return NotFound();db.Remove(d);await db.SaveChangesAsync(ct);return NoContent();}
}

[ApiController,Authorize,Route("api/v1/subscriptions")]
public sealed class SubscriptionsController(FinanceiroDbContext db,ICurrentUser current):ControllerBase
{
 [HttpGet]public async Task<IActionResult>List(CancellationToken ct)=>Ok(await db.Subscriptions.AsNoTracking().ToListAsync(ct));
 [HttpPost]public async Task<IActionResult>Create(SubscriptionRequest r,CancellationToken ct){if(r.Amount<=0||r.BillingDay is<1 or>31)return BadRequest("Assinatura inválida.");var x=new Subscription{UserId=current.UserId,Name=r.Name.Trim(),Amount=r.Amount,Cycle=r.Cycle,BillingDay=r.BillingDay,StartDate=r.StartDate,AccountId=r.AccountId,CategoryId=r.CategoryId,IsActive=r.IsActive};db.Add(x);await db.SaveChangesAsync(ct);return Ok(x);}
 [HttpPut("{id:guid}")]public async Task<IActionResult>Update(Guid id,SubscriptionRequest r,CancellationToken ct){var x=await db.Subscriptions.FindAsync([id],ct);if(x is null)return NotFound();x.Name=r.Name;x.Amount=r.Amount;x.Cycle=r.Cycle;x.BillingDay=r.BillingDay;x.StartDate=r.StartDate;x.AccountId=r.AccountId;x.CategoryId=r.CategoryId;x.IsActive=r.IsActive;await db.SaveChangesAsync(ct);return Ok(x);}
 [HttpDelete("{id:guid}")]public async Task<IActionResult>Delete(Guid id,CancellationToken ct){var x=await db.Subscriptions.FindAsync([id],ct);if(x is null)return NotFound();db.Remove(x);await db.SaveChangesAsync(ct);return NoContent();}
}

[ApiController,Authorize,Route("api/v1/credit-cards")]
public sealed class CreditCardsController(FinanceiroDbContext db,ICurrentUser current):ControllerBase
{
 [HttpGet]public async Task<IActionResult>List(CancellationToken ct)=>Ok(await db.CreditCards.AsNoTracking().Include(x=>x.Invoices).ThenInclude(i=>i.Installments).Select(x=>new{x.Id,x.Name,x.Bank,x.Brand,x.Limit,x.BestPurchaseDay,x.ClosingDay,x.DueDay,x.IsActive,Used=x.Invoices.SelectMany(i=>i.Installments).Where(i=>i.Invoice!.Status!=InvoiceStatus.Paid).Sum(i=>i.Amount),Available=x.Limit-x.Invoices.SelectMany(i=>i.Installments).Where(i=>i.Invoice!.Status!=InvoiceStatus.Paid).Sum(i=>i.Amount)}).ToListAsync(ct));
 [HttpPost]public async Task<IActionResult>Create(CreditCardRequest r,CancellationToken ct){if(r.Limit<0||r.ClosingDay is<1 or>31||r.DueDay is<1 or>31)return BadRequest("Cartão inválido.");var x=new CreditCard{UserId=current.UserId,Name=r.Name.Trim(),Bank=r.Bank.Trim(),Brand=r.Brand,Limit=r.Limit,BestPurchaseDay=r.BestPurchaseDay,ClosingDay=r.ClosingDay,DueDay=r.DueDay,IsActive=r.IsActive};db.Add(x);await db.SaveChangesAsync(ct);return Ok(x);}
 [HttpPost("{id:guid}/purchases")]public async Task<IActionResult>Purchase(Guid id,CardPurchaseRequest r,CancellationToken ct){if(r.TotalAmount<=0||r.InstallmentCount<1)return BadRequest("Compra inválida.");var card=await db.CreditCards.SingleOrDefaultAsync(x=>x.Id==id,ct);if(card is null)return NotFound();var purchase=new CreditCardPurchase{UserId=current.UserId,CreditCardId=id,Description=r.Description,TotalAmount=r.TotalAmount,PurchaseDate=r.PurchaseDate,CategoryId=r.CategoryId,InstallmentCount=r.InstallmentCount};for(var i=1;i<=r.InstallmentCount;i++){var date=r.PurchaseDate.AddMonths(i-1);var inv=await db.CreditCardInvoices.SingleOrDefaultAsync(x=>x.CreditCardId==id&&x.Month==date.Month&&x.Year==date.Year,ct);if(inv is null){var closing=new DateOnly(date.Year,date.Month,Math.Min(card.ClosingDay,DateTime.DaysInMonth(date.Year,date.Month)));inv=new CreditCardInvoice{UserId=current.UserId,CreditCardId=id,Month=date.Month,Year=date.Year,ClosingDate=closing,DueDate=closing.AddMonths(1).AddDays(card.DueDay-1),Status=InvoiceStatus.Open};db.Add(inv);await db.SaveChangesAsync(ct);}purchase.Installments.Add(new Installment{UserId=current.UserId,CreditCardPurchaseId=purchase.Id,CreditCardInvoiceId=inv.Id,Number=i,Total=r.InstallmentCount,Amount=i==r.InstallmentCount?r.TotalAmount-decimal.Round(r.TotalAmount/r.InstallmentCount,2)*(r.InstallmentCount-1):decimal.Round(r.TotalAmount/r.InstallmentCount,2)});}db.Add(purchase);await db.SaveChangesAsync(ct);return Ok(purchase);}
 [HttpGet("{id:guid}/invoices")]public async Task<IActionResult>Invoices(Guid id,CancellationToken ct)=>Ok(await db.CreditCardInvoices.AsNoTracking().Where(x=>x.CreditCardId==id).Include(x=>x.Installments).OrderByDescending(x=>x.Year).ThenByDescending(x=>x.Month).ToListAsync(ct));
 [HttpPost("invoices/{invoiceId:guid}/pay")]public async Task<IActionResult>PayInvoice(Guid invoiceId,InvoicePaymentRequest r,CancellationToken ct){var inv=await db.CreditCardInvoices.Include(x=>x.Installments).SingleOrDefaultAsync(x=>x.Id==invoiceId,ct);if(inv is null)return NotFound();if(inv.Status==InvoiceStatus.Paid)return Conflict("Fatura já paga.");if(!await db.Accounts.AnyAsync(x=>x.Id==r.AccountId,ct))return BadRequest("Conta inválida.");var amount=inv.Installments.Sum(x=>x.Amount);db.Transactions.Add(new Transaction{UserId=current.UserId,AccountId=r.AccountId,Description=$"Pagamento fatura {inv.Month:D2}/{inv.Year}",Amount=amount,Type=TransactionType.Expense,Status=TransactionStatus.Paid,Date=r.PaymentDate,PaidAt=r.PaymentDate});inv.Status=InvoiceStatus.Paid;inv.PaidAt=r.PaymentDate;await db.SaveChangesAsync(ct);return Ok(inv);}
}

[ApiController,Authorize,Route("api/v1/reports")]
public sealed class ReportsController(FinanceiroDbContext db):ControllerBase
{
 [HttpGet("summary")]public async Task<IActionResult>Summary(DateOnly? from,DateOnly? to,CancellationToken ct){var start=from??DateOnly.FromDateTime(DateTime.UtcNow.AddMonths(-11));var end=to??DateOnly.FromDateTime(DateTime.UtcNow);var tx=await db.Transactions.AsNoTracking().Where(x=>x.Date>=start&&x.Date<=end&&x.Status!=TransactionStatus.Cancelled).ToListAsync(ct);return Ok(new{from=start,to=end,monthly=tx.GroupBy(x=>new{x.Date.Year,x.Date.Month}).OrderBy(g=>g.Key.Year).ThenBy(g=>g.Key.Month).Select(g=>new{month=$"{g.Key.Month:D2}/{g.Key.Year}",income=g.Where(x=>x.Type==TransactionType.Income).Sum(x=>x.Amount),expense=g.Where(x=>x.Type==TransactionType.Expense).Sum(x=>x.Amount)}),categories=tx.Where(x=>x.Type==TransactionType.Expense).GroupBy(x=>x.Category?.Name??"Outros").Select(g=>new{category=g.Key,value=g.Sum(x=>x.Amount)}),cards=await db.CreditCardInvoices.Where(x=>x.DueDate>=start&&x.DueDate<=end).GroupBy(x=>x.CreditCard!.Name).Select(g=>new{card=g.Key,value=g.SelectMany(x=>x.Installments).Sum(i=>i.Amount)}).ToListAsync(ct)});}
}

[ApiController,Authorize,Route("api/v1/search")]
public sealed class SearchController(FinanceiroDbContext db):ControllerBase
{
 [HttpGet]public async Task<IActionResult>Search(string q,int limit=10,CancellationToken ct=default){if(string.IsNullOrWhiteSpace(q))return Ok(Array.Empty<object>());q=q.Trim().ToLower();limit=Math.Clamp(limit,1,50);var tx=await db.Transactions.Where(x=>x.Description.ToLower().Contains(q)).Take(limit).Select(x=>new{type="transaction",x.Id,title=x.Description,value=x.Amount}).ToListAsync(ct);var ac=await db.Accounts.Where(x=>x.Name.ToLower().Contains(q)).Take(limit).Select(x=>new{type="account",x.Id,title=x.Name,value=(decimal?)null}).ToListAsync(ct);return Ok(tx.Cast<object>().Concat(ac).Take(limit));}
}

[ApiController,Authorize,Route("api/v1/notifications")]
public sealed class NotificationsController(FinanceiroDbContext db):ControllerBase
{
 [HttpGet]public async Task<IActionResult>List(bool unreadOnly=false,CancellationToken ct=default)=>Ok(await db.Notifications.AsNoTracking().Where(x=>!unreadOnly||!x.IsRead).OrderByDescending(x=>x.CreatedAt).Take(100).ToListAsync(ct));
 [HttpPost("{id:guid}/read")]public async Task<IActionResult>Read(Guid id,CancellationToken ct){var x=await db.Notifications.FindAsync([id],ct);if(x is null)return NotFound();x.IsRead=true;x.ReadAt=DateTime.UtcNow;await db.SaveChangesAsync(ct);return NoContent();}
}

[ApiController,Authorize,Route("api/v1/import-export")]
public sealed class ImportExportController(FinanceiroDbContext db):ControllerBase
{
 [HttpGet("transactions.csv")]public async Task<IActionResult>Export(DateOnly? from,DateOnly? to,CancellationToken ct){var q=db.Transactions.AsNoTracking().AsQueryable();if(from is not null)q=q.Where(x=>x.Date>=from);if(to is not null)q=q.Where(x=>x.Date<=to);await using var stream=new MemoryStream();await using(var writer=new StreamWriter(stream,Encoding.UTF8,leaveOpen:true)){await using var csv=new CsvWriter(writer,CultureInfo.GetCultureInfo("pt-BR"));await csv.WriteRecordsAsync(await q.Select(x=>new{description=x.Description,amount=x.Amount,type=x.Type.ToString(),status=x.Status.ToString(),date=x.Date.ToString("dd/MM/yyyy"),notes=x.Notes}).ToListAsync(ct),ct);}return File(stream.ToArray(),"text/csv","transacoes.csv");}
 [HttpPost("transactions/preview")]public async Task<IActionResult>Preview(IFormFile file,CancellationToken ct){if(file.Length>5*1024*1024)return BadRequest("Arquivo excede 5 MB.");using var reader=new StreamReader(file.OpenReadStream());using var csv=new CsvReader(reader,CultureInfo.GetCultureInfo("pt-BR"));var records=new List<object>();await foreach(var row in csv.GetRecordsAsync<dynamic>(ct)){records.Add(row);if(records.Count>=100)break;}return Ok(new{rows=records,totalPreview=records.Count});}
}
