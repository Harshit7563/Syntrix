import { BadRequestException, Body, Controller, Get, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma.service';
import { AuthGuard, CurrentUser, Perm, StaffGuard } from '../common/guards';
import { JobsService } from './jobs.service';
import { matchStatementRow, parseCsvStatements } from './bank-statement';

@ApiTags('admin-recon')
@Controller('admin')
@UseGuards(AuthGuard, StaffGuard)
export class ReconController {
  constructor(private p: PrismaService, private jobs: JobsService) {}

  @Post('reconcile')
  @Perm('recon:run')
  async run(@Body() b: any) {
    return this.jobs.reconcile(b.providerId);
  }

  @Get('reconciliation')
  @Perm('recon:run')
  async runs() {
    return this.p.reconciliationRun.findMany({ orderBy: { startedAt: 'desc' }, take: 20, include: { items: { take: 50 } } }).then((rs) =>
      rs.map((r) => ({ ...r, items: r.items.map((i) => ({ ...i, expectedPaise: Number(i.expectedPaise), actualPaise: i.actualPaise ? Number(i.actualPaise) : null })) })),
    );
  }

  @Get('reconciliation/statements')
  @Perm('recon:run')
  async statements() {
    const rows = await this.p.bankStatementImport.findMany({ orderBy: { createdAt: 'desc' }, take: 20, include: { lines: { take: 80 } } });
    return rows.map((r) => ({
      ...r,
      lines: r.lines.map((l) => ({ ...l, amountPaise: Number(l.amountPaise) })),
      note: r.note || 'CSV match only. Unmatched lines are not treated as successful payments.',
    }));
  }

  @Post('reconciliation/statements')
  @Perm('recon:run')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 2 * 1024 * 1024 } }))
  async uploadStatement(@CurrentUser() u: any, @UploadedFile() f: any) {
    if (!f?.buffer) throw new BadRequestException('Upload a CSV with headers date, amount, utr');
    const text = f.buffer.toString('utf8');
    const parsed = parseCsvStatements(text);
    if (!parsed.length) throw new BadRequestException('No rows parsed. Use headers date, amount, utr (optional narration)');
    const txns = await this.p.transaction.findMany({
      where: { status: { in: ['SUCCESS', 'REFUNDED', 'PARTIALLY_REFUNDED'] } },
      select: { id: true, utr: true, amountPaise: true, createdAt: true, status: true },
      take: 5000,
    });
    const hits = txns.map((t) => ({ id: t.id, utr: t.utr, amountPaise: Number(t.amountPaise), createdAt: t.createdAt, status: t.status }));
    const lines = parsed.map((row) => {
      const m = matchStatementRow(row, hits);
      return {
        txnDate: row.date || null,
        amountPaise: BigInt(row.amountPaise),
        utr: row.utr || null,
        narration: row.narration || null,
        status: m.status,
        transactionId: m.transactionId,
        note: m.note,
      };
    });
    const matched = lines.filter((l) => l.status === 'MATCHED').length;
    const unmatched = lines.length - matched;
    const imp = await this.p.bankStatementImport.create({
      data: {
        filename: String(f.originalname || 'statement.csv').replace(/[^\w.-]/g, '_'),
        uploadedBy: u.id,
        lineCount: lines.length,
        matched,
        unmatched,
        note: 'Does not change transaction status. Unmatched ≠ failed payout.',
        lines: { create: lines },
      },
      include: { lines: true },
    });
    return {
      id: imp.id,
      filename: imp.filename,
      lineCount: imp.lineCount,
      matched: imp.matched,
      unmatched: imp.unmatched,
      lines: imp.lines.map((l) => ({ ...l, amountPaise: Number(l.amountPaise) })),
    };
  }
}
