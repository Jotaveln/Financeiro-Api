using Financeiro.Application;
using Financeiro.Domain;
using Financeiro.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Financeiro.Api.Controllers;

[ApiController, Authorize, Route("api/v1/accounts")]
public sealed class AccountsController(FinanceiroDbContext db, ICurrentUser current) : ControllerBase
{
    [HttpGet] public async Task<IActionResult> List(bool activeOnly = false, CancellationToken ct = default)
    {
        var q = db.Accounts.AsNoTracking().Where(x => !activeOnly || x.IsActive);
        var data = await q.Select(x => new { x.Id, x.Name, x.Institution, x.Type, x.InitialBalance, x.Color, x.Icon, x.IsActive, Balance = x.InitialBalance + x.Transactions.Where(t => t.Status == TransactionStatus.Paid).Sum(t => t.Type == TransactionType.Income ? t.Amount : -t.Amount) }).ToListAsync(ct);
        return Ok(data);
    }
    [HttpGet("{id:guid}")] public async Task<IActionResult> Get(Guid id, CancellationToken ct) => await db.Accounts.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id, ct) is { } x ? Ok(x) : NotFound();
    [HttpPost] public async Task<IActionResult> Create(AccountRequest r, CancellationToken ct)
    {
        if (Validate(r) is { } error) return BadRequest(error);
        var x = Map(r); x.UserId = current.UserId;
        db.Add(x); await db.SaveChangesAsync(ct);
        return CreatedAtAction(nameof(Get), new { id = x.Id }, x);
    }
    [HttpPut("{id:guid}")] public async Task<IActionResult> Update(Guid id, AccountRequest r, CancellationToken ct)
    {
        var x = await db.Accounts.FindAsync([id], ct); if (x is null) return NotFound();
        if (Validate(r) is { } error) return BadRequest(error);
        x.Name=r.Name.Trim(); x.Institution=string.IsNullOrWhiteSpace(r.Institution) ? null : r.Institution.Trim(); x.Type=r.Type; x.InitialBalance=r.InitialBalance; x.Color=r.Color??x.Color; x.Icon=r.Icon??x.Icon; x.IsActive=r.IsActive;
        await db.SaveChangesAsync(ct); return Ok(x);
    }
    private static string? Validate(AccountRequest r) => string.IsNullOrWhiteSpace(r.Name) ? "Nome obrigatório." : r.Name.Trim().Length > 120 ? "Nome deve ter no máximo 120 caracteres." : r.InitialBalance < 0 ? "Saldo inicial não pode ser negativo." : r.Institution?.Trim().Length > 120 ? "Instituição deve ter no máximo 120 caracteres." : null;
    [HttpDelete("{id:guid}")] public async Task<IActionResult> Delete(Guid id, CancellationToken ct) { var x = await db.Accounts.Include(a => a.Transactions).SingleOrDefaultAsync(a => a.Id == id, ct); if (x is null) return NotFound(); if (x.Transactions.Count != 0) { x.IsActive=false; await db.SaveChangesAsync(ct); return NoContent(); } db.Remove(x); await db.SaveChangesAsync(ct); return NoContent(); }
    private static Account Map(AccountRequest r) => new() { Name=r.Name.Trim(), Institution=r.Institution, Type=r.Type, InitialBalance=r.InitialBalance, Color=r.Color??"#2563EB", Icon=r.Icon??"wallet", IsActive=r.IsActive };
}

[ApiController, Authorize, Route("api/v1/categories")]
public sealed class CategoriesController(FinanceiroDbContext db, ICurrentUser current) : ControllerBase
{
    [HttpGet] public async Task<IActionResult> List(TransactionType? type, CancellationToken ct) => Ok(await db.Categories.AsNoTracking().Where(x => type == null || x.Type == type).OrderBy(x => x.Name).ToListAsync(ct));
    [HttpPost] public async Task<IActionResult> Create(CategoryRequest r, CancellationToken ct) { if (r.ParentId is not null && !await db.Categories.AnyAsync(x => x.Id == r.ParentId && x.Type == r.Type, ct)) return BadRequest("Subcategoria pai inválida."); var x=new Category { UserId=current.UserId, Name=r.Name.Trim(), Type=r.Type, Color=r.Color??"#64748B", Icon=r.Icon??"tag", ParentId=r.ParentId, IsActive=r.IsActive }; db.Add(x); await db.SaveChangesAsync(ct); return Created($"/api/v1/categories/{x.Id}",x); }
    [HttpPut("{id:guid}")] public async Task<IActionResult> Update(Guid id, CategoryRequest r, CancellationToken ct) { var x=await db.Categories.FindAsync([id],ct); if(x is null)return NotFound(); if (r.ParentId is not null && !await db.Categories.AnyAsync(p => p.Id == r.ParentId && p.Type == r.Type, ct)) return BadRequest("Subcategoria pai inválida."); x.Name=r.Name; x.Type=r.Type; x.Color=r.Color??x.Color;x.Icon=r.Icon??x.Icon;x.ParentId=r.ParentId;x.IsActive=r.IsActive;await db.SaveChangesAsync(ct);return Ok(x); }
    [HttpDelete("{id:guid}")] public async Task<IActionResult> Delete(Guid id,CancellationToken ct){var x=await db.Categories.FindAsync([id],ct);if(x is null)return NotFound();if(await db.Transactions.AnyAsync(t=>t.CategoryId==id,ct)){x.IsActive=false;}else db.Remove(x);await db.SaveChangesAsync(ct);return NoContent();}
}

[ApiController, Authorize, Route("api/v1/transactions")]
public sealed class TransactionsController(FinanceiroDbContext db, ICurrentUser current) : ControllerBase
{
    [HttpGet] public async Task<IActionResult> List(int page=1,int pageSize=20,string? search=null,TransactionType? type=null,TransactionStatus? status=null,DateOnly? from=null,DateOnly? to=null,string sort="date",string order="desc",CancellationToken ct=default)
    {
        page=Math.Max(1,page);pageSize=Math.Clamp(pageSize,1,100);var q=db.Transactions.AsNoTracking().Include(x=>x.Account).Include(x=>x.Category).AsQueryable();
        if(!string.IsNullOrWhiteSpace(search))q=q.Where(x=>x.Description.ToLower().Contains(search.ToLower()));if(type is not null)q=q.Where(x=>x.Type==type);if(status is not null)q=q.Where(x=>x.Status==status);if(from is not null)q=q.Where(x=>x.Date>=from);if(to is not null)q=q.Where(x=>x.Date<=to);
        q=(sort.ToLower(),order.ToLower()) switch { ("amount","asc")=>q.OrderBy(x=>x.Amount),("amount",_)=>q.OrderByDescending(x=>x.Amount),("description","asc")=>q.OrderBy(x=>x.Description),("description",_)=>q.OrderByDescending(x=>x.Description),("date","asc")=>q.OrderBy(x=>x.Date),_=>q.OrderByDescending(x=>x.Date)};
        var total=await q.CountAsync(ct);var items=await q.Skip((page-1)*pageSize).Take(pageSize).Select(x=>new{x.Id,x.Description,x.Amount,x.Type,x.Status,x.Date,x.DueDate,x.PaidAt,x.Notes,x.Tags,x.AccountId,Account=x.Account!.Name,x.CategoryId,Category=x.Category!=null?x.Category.Name:null,x.TransferId}).ToListAsync(ct);return Ok(new PagedResult<object>(items.Cast<object>().ToList(),page,pageSize,total));
    }
    [HttpGet("{id:guid}")] public async Task<IActionResult> Get(Guid id,CancellationToken ct)=>await db.Transactions.AsNoTracking().SingleOrDefaultAsync(x=>x.Id==id,ct) is{}x?Ok(x):NotFound();
    [HttpPost] public async Task<IActionResult> Create(TransactionRequest r,CancellationToken ct){var validation=await Validate(r,ct);if(validation is not null)return BadRequest(validation);var count=r.Recurrence is RecurrenceType.None?1:Math.Clamp(r.Occurrences,1,120);var key=count>1?Guid.NewGuid().ToString("N"):null;var amounts=r.Recurrence==RecurrenceType.Installment?FinancialCalculations.SplitAmount(r.Amount,count):Enumerable.Repeat(r.Amount,count).ToArray();var list=new List<Transaction>();for(var i=0;i<count;i++){var date=r.Recurrence switch{RecurrenceType.Weekly=>r.Date.AddDays(i*7),RecurrenceType.Yearly=>r.Date.AddYears(i),_=>r.Date.AddMonths(i)};DateOnly? dueDate=r.DueDate is null?null:r.Recurrence switch{RecurrenceType.Weekly=>r.DueDate.Value.AddDays(i*7),RecurrenceType.Yearly=>r.DueDate.Value.AddYears(i),_=>r.DueDate.Value.AddMonths(i)};list.Add(new(){UserId=current.UserId,Description=count>1?$"{r.Description} ({i+1}/{count})":r.Description,Amount=amounts[i],Type=r.Type,Status=i==0?r.Status:TransactionStatus.Pending,Date=date,DueDate=dueDate,PaidAt=i==0?r.PaidAt:null,AccountId=r.AccountId,CategoryId=r.CategoryId,Notes=r.Notes,Tags=r.Tags,Recurrence=r.Recurrence,RecurrenceKey=key});}db.AddRange(list);await db.SaveChangesAsync(ct);return CreatedAtAction(nameof(Get),new{id=list[0].Id},list);}
    [HttpPut("{id:guid}")] public async Task<IActionResult> Update(Guid id,TransactionRequest r,CancellationToken ct){var x=await db.Transactions.FindAsync([id],ct);if(x is null)return NotFound();if(x.TransferId is not null)return Conflict("Edite a transferência vinculada.");if(await Validate(r,ct) is{}error)return BadRequest(error);x.Description=r.Description;x.Amount=r.Amount;x.Type=r.Type;x.Status=r.Status;x.Date=r.Date;x.DueDate=r.DueDate;x.PaidAt=r.PaidAt;x.AccountId=r.AccountId;x.CategoryId=r.CategoryId;x.Notes=r.Notes;x.Tags=r.Tags;await db.SaveChangesAsync(ct);return Ok(x);}
    [HttpDelete("{id:guid}")] public async Task<IActionResult> Delete(Guid id,CancellationToken ct){var x=await db.Transactions.FindAsync([id],ct);if(x is null)return NotFound();if(x.TransferId is not null)return Conflict("Exclua a transferência vinculada.");db.Remove(x);await db.SaveChangesAsync(ct);return NoContent();}
    private async Task<string?> Validate(TransactionRequest r,CancellationToken ct){if(string.IsNullOrWhiteSpace(r.Description)||r.Description.Trim().Length>200)return"Descrição obrigatória com no máximo 200 caracteres.";if(r.Amount<=0)return"Valor deve ser positivo.";if(!Enum.IsDefined(typeof(RecurrenceType),r.Recurrence)||r.Occurrences is<1 or>120)return"Recorrência inválida.";if(!await db.Accounts.AnyAsync(x=>x.Id==r.AccountId&&x.IsActive,ct))return"Conta inválida.";if(r.CategoryId is not null&&!await db.Categories.AnyAsync(x=>x.Id==r.CategoryId&&x.Type==r.Type&&x.IsActive,ct))return"Categoria inválida.";if(r.DueDate is not null&&r.DueDate<r.Date)return"Vencimento não pode ser anterior à data.";if(r.PaidAt is not null&&r.PaidAt<r.Date)return"Pagamento não pode ser anterior à data.";return null;}
}

[ApiController, Authorize, Route("api/v1/transfers")]
public sealed class TransfersController(FinanceiroDbContext db,ICurrentUser current):ControllerBase
{
    [HttpGet]public async Task<IActionResult>List(CancellationToken ct)=>Ok(await db.Transfers.AsNoTracking().OrderByDescending(x=>x.Date).ToListAsync(ct));
    [HttpPost]public async Task<IActionResult>Create(TransferRequest r,CancellationToken ct){if(r.Amount<=0||r.SourceAccountId==r.DestinationAccountId)return BadRequest("Transferência inválida.");if(await db.Accounts.CountAsync(x=>(x.Id==r.SourceAccountId||x.Id==r.DestinationAccountId)&&x.IsActive,ct)!=2)return BadRequest("Conta inválida.");await using var tx=await db.Database.BeginTransactionAsync(ct);var transfer=new Transfer{UserId=current.UserId,SourceAccountId=r.SourceAccountId,DestinationAccountId=r.DestinationAccountId,Amount=r.Amount,Date=r.Date,Description=r.Description};var debit=new Transaction{UserId=current.UserId,AccountId=r.SourceAccountId,Description=r.Description??"Transferência enviada",Amount=r.Amount,Type=TransactionType.Expense,Status=TransactionStatus.Paid,Date=r.Date,PaidAt=r.Date,TransferId=transfer.Id};var credit=new Transaction{UserId=current.UserId,AccountId=r.DestinationAccountId,Description=r.Description??"Transferência recebida",Amount=r.Amount,Type=TransactionType.Income,Status=TransactionStatus.Paid,Date=r.Date,PaidAt=r.Date,TransferId=transfer.Id};transfer.DebitTransactionId=debit.Id;transfer.CreditTransactionId=credit.Id;db.AddRange(transfer,debit,credit);await db.SaveChangesAsync(ct);await tx.CommitAsync(ct);return Created($"/api/v1/transfers/{transfer.Id}",transfer);}
    [HttpDelete("{id:guid}")]public async Task<IActionResult>Delete(Guid id,CancellationToken ct){var x=await db.Transfers.SingleOrDefaultAsync(x=>x.Id==id,ct);if(x is null)return NotFound();var entries=await db.Transactions.Where(t=>t.TransferId==id).ToListAsync(ct);db.RemoveRange(entries);db.Remove(x);await db.SaveChangesAsync(ct);return NoContent();}
}
