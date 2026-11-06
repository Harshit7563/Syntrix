import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { decryptSecret, encryptSecret, sha256 } from '../common/core';

const IFSC = /^[A-Z]{4}0[A-Z0-9]{6}$/;

@Injectable()
export class BeneficiariesService {
  constructor(private p: PrismaService) {}

  private fingerprint(merchantId: string, ifsc: string, account: string) {
    return sha256(`${merchantId}|${ifsc}|${account}`);
  }

  view(row: any, reveal = false) {
    let account = '';
    if (reveal && row.accountEnc) {
      try { account = decryptSecret(row.accountEnc); } catch { account = ''; }
    }
    return {
      id: row.id,
      name: row.name,
      accountLast4: row.accountLast4,
      account: reveal && account ? account : undefined,
      ifsc: row.ifsc,
      mobile: row.mobile || '',
      email: row.email || '',
      verified: !!row.verified,
      verifiedNote: row.verified ? 'Staff-marked. Not a bank penny-drop.' : 'Unverified — no bank confirmation on file.',
      status: row.status,
      createdAt: row.createdAt,
    };
  }

  async list(merchantId: string) {
    const rows = await this.p.beneficiary.findMany({ where: { merchantId }, orderBy: { createdAt: 'desc' } });
    return rows.map((r) => this.view(r, false));
  }

  async get(merchantId: string, id: string, reveal = false) {
    const row = await this.p.beneficiary.findFirst({ where: { id, merchantId } });
    if (!row) throw new BadRequestException('Beneficiary not found');
    return this.view(row, reveal);
  }

  async create(merchantId: string, b: any) {
    const name = String(b.name || '').trim();
    const account = String(b.account || b.accountNumber || '').replace(/\s/g, '');
    const ifsc = String(b.ifsc || '').toUpperCase().replace(/\s/g, '');
    const mobile = String(b.mobile || b.phone || '').replace(/\D/g, '').slice(-10);
    const email = String(b.email || '').trim().toLowerCase();
    if (name.length < 2) throw new BadRequestException('Beneficiary name is required');
    if (!/^\d{8,18}$/.test(account)) throw new BadRequestException('Account number must be 8–18 digits');
    if (!IFSC.test(ifsc)) throw new BadRequestException('IFSC is not valid');
    if (mobile && mobile.length !== 10) throw new BadRequestException('Mobile must be 10 digits');
    const fp = this.fingerprint(merchantId, ifsc, account);
    const dup = await this.p.beneficiary.findUnique({ where: { merchantId_accountFingerprint: { merchantId, accountFingerprint: fp } } });
    if (dup) {
      if (dup.status !== 'ACTIVE') {
        const row = await this.p.beneficiary.update({ where: { id: dup.id }, data: { status: 'ACTIVE', name, mobile: mobile || dup.mobile, email: email || dup.email } });
        return this.view(row, true);
      }
      throw new BadRequestException('This account is already registered');
    }
    const row = await this.p.beneficiary.create({
      data: {
        merchantId,
        name,
        accountEnc: encryptSecret(account),
        accountLast4: account.slice(-4),
        accountFingerprint: fp,
        ifsc,
        mobile: mobile || null,
        email: email || null,
        verified: false,
        status: 'ACTIVE',
      },
    });
    return this.view(row, true);
  }

  async disable(merchantId: string, id: string) {
    const row = await this.p.beneficiary.findFirst({ where: { id, merchantId } });
    if (!row) throw new BadRequestException('Beneficiary not found');
    return this.view(await this.p.beneficiary.update({ where: { id }, data: { status: 'DISABLED' } }));
  }

  async markVerified(id: string, verified: boolean) {
    const row = await this.p.beneficiary.findUnique({ where: { id } });
    if (!row) throw new BadRequestException('Beneficiary not found');
    return this.view(await this.p.beneficiary.update({ where: { id }, data: { verified: !!verified } }), false);
  }

  async resolveForPayout(merchantId: string, body: any) {
    if (body?.beneficiaryId) {
      const row = await this.p.beneficiary.findFirst({ where: { id: String(body.beneficiaryId), merchantId } });
      if (!row) throw new BadRequestException('Beneficiary not found');
      if (row.status !== 'ACTIVE') throw new BadRequestException('This beneficiary is disabled');
      let account = '';
      try { account = decryptSecret(row.accountEnc); } catch { throw new BadRequestException('Stored beneficiary account could not be read'); }
      return {
        ...body,
        beneficiary: {
          name: row.name,
          account,
          ifsc: row.ifsc,
          mobile: row.mobile || body.beneficiary?.mobile,
          email: row.email || body.beneficiary?.email,
          beneficiaryId: row.id,
        },
      };
    }
    return body;
  }
}
