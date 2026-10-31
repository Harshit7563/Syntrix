import { Injectable, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { feePaise, nextStatus, sha256, stableStringify, pickRouteByAmount, circuitThreshold, circuitCooldownMs, isCircuitOpen } from '../common/core';
import { adapterFor, hasCapability, ProviderTimeoutError, activeProviderCreds } from './providers';
import { LedgerService, acct } from './ledger.service';

@Injectable() export class PaymentsService {
  constructor(private p: PrismaService, private ledger: LedgerService) {}

  /** NEW traffic only: skip providers whose circuit is open. In-flight txns keep their providerId. */
  private async openCircuitIds() {
    const now = new Date();
    const rows = await this.p.provider.findMany({ where: { circuitOpenUntil: { gt: now } }, select: { id: true } });
    return new Set(rows.map(r => r.id));
  }

  /** Admin console: hit a specific provider, bypass amount-band routing. */
  private async forceProvider(providerId: string) {
    const prov = await this.p.provider.findUnique({ where: { id: providerId } });
    if (!prov || !prov.isActive) throw new BadRequestException('Selected API not found or inactive');
    return prov;
  }

  /**
   * Pick an active routed provider for this product+amount.
   * Never falls back to a random Provider — only matching routing rules.
   */
  private async providerFor(merchantId: string, productCode: string, amountPaise?: number) {
    const rules = await this.p.routingRule.findMany({
      where: { productCode, isActive: true, OR: [{ merchantId }, { merchantId: null }] },
      orderBy: { priority: 'asc' },
    });
    const skip = await this.openCircuitIds();
    const mapped = rules.map(r => ({
      id: r.id,
      providerId: r.providerId,
      priority: r.priority,
      minAmountPaise: r.minAmountPaise == null ? null : Number(r.minAmountPaise),
      maxAmountPaise: r.maxAmountPaise == null ? null : Number(r.maxAmountPaise),
      isActive: r.isActive,
    }));
    let rule: any = null;
    if (amountPaise != null) rule = pickRouteByAmount(mapped, amountPaise, skip);
    else rule = mapped.find(r => !skip.has(r.providerId)) || null;

    if (!rule) {
      if (amountPaise != null) {
        throw new BadRequestException(
          `No healthy API covers amount ₹${(amountPaise / 100).toFixed(2)} for ${productCode}. Activate another band or wait for circuit cooldown.`,
        );
      }
      throw new BadRequestException('No active provider routed for this product — ask Operations to configure routing');
    }

    const prov = await this.p.provider.findUnique({ where: { id: rule.providerId } });
    if (!prov || !prov.isActive || isCircuitOpen(prov) || skip.has(prov.id)) {
      if (amountPaise != null) {
        throw new BadRequestException(
          `No healthy API covers amount ₹${(amountPaise / 100).toFixed(2)} for ${productCode}. Activate another band or wait for circuit cooldown.`,
        );
      }
      throw new BadRequestException('No active provider routed for this product — ask Operations to configure routing');
    }
    return prov;
  }

  /** Prefer original txn provider for refunds; only fall back to routing if missing/inactive. */
  private async providerForRefund(orig: any) {
    if (orig.providerId) {
      const prov = await this.p.provider.findUnique({ where: { id: orig.providerId } });
      if (prov && prov.isActive && !isCircuitOpen(prov)) return prov;
    }
    return this.providerFor(orig.merchantId, 'PAYIN', Number(orig.amountPaise));
  }

  /** Success clears the breaker. Only hard errors (timeout / transport) bump it — not issuer declines. */
  async noteProviderOutcome(providerId: string, ok: boolean, reason?: string) {
    if (ok) {
      await this.p.provider.update({ where: { id: providerId }, data: { healthFailures: 0, circuitOpenUntil: null } });
      return { reset: true };
    }
    const thr = circuitThreshold();
    const cool = circuitCooldownMs();
    const prov = await this.p.provider.findUnique({ where: { id: providerId } });
    if (!prov) return { opened: false };
    const failures = (prov.healthFailures || 0) + 1;
    const open = failures >= thr;
    const until = open ? new Date(Date.now() + cool) : prov.circuitOpenUntil;
    await this.p.provider.update({
      where: { id: providerId },
      data: { healthFailures: open ? 0 : failures, circuitOpenUntil: until || null },
    });
    if (open) {
      await this.p.auditLog.create({
        data: {
          actorId: null,
          action: 'CIRCUIT_OPEN',
          entity: 'Provider',
          entityId: providerId,
          metadata: { failures, threshold: thr, cooldownSec: cool / 1000, reason: reason || 'timeout', until: until?.toISOString() },
        },
      });
    }
    return { opened: open, failures, until };
  }

  private async checkAccess(merchantId: string, env: string, productCode: string) {
    const prod = await this.p.apiProduct.findUnique({ where: { code: productCode } });
    if (!prod) throw new BadRequestException(`Unknown product ${productCode}`);
    const a = await this.p.merchantProductAccess.findFirst({
      where: { merchantId, productId: prod.id, env: env as any, status: 'ENABLED' },
    });
    if (!a) throw new BadRequestException(`Product ${productCode} is not enabled for this merchant in ${env}`);
    return prod;
  }
  private async pricing(merchantId: string, productId: string) {
    return this.p.pricingPlan.findUnique({ where: { merchantId_productId: { merchantId, productId } } });
  }
  private outbox(tx: any, aggregateId: string, type: string, payload: any) {
    return tx.outboxEvent.create({ data: { aggregate: 'Transaction', aggregateId, type, payload } });
  }
  private async emitMerchantEvent(tx: any, merchantId: string, env: string, type: string, payload: any) {
    const ev = await tx.webhookEvent.create({ data: { merchantId, env: env as any, type, payload } });
    const eps = await tx.webhookEndpoint.findMany({ where: { merchantId, env: env as any, isActive: true } });
    for (const ep of eps) {
      if (ep.events.length && !ep.events.includes(type)) continue;
      await tx.webhookDelivery.create({ data: { endpointId: ep.id, eventId: ev.id, status: 'PENDING' } });
    }
    return ev;
  }

  async createPayin(merchant: any, env: string, body: any, idemKey: string, forceProviderId?: string) {
    if (!idemKey) throw new BadRequestException('Idempotency-Key header is required');
    const amount = body.amountPaise;
    if (!Number.isSafeInteger(amount) || amount <= 0) throw new BadRequestException('amountPaise must be a positive integer (paise)');
    const reqHash = sha256(stableStringify(body));
    const prior = await this.p.idempotencyRecord.findUnique({
      where: { merchantId_scope_key: { merchantId: merchant.id, scope: 'PAYIN', key: idemKey } },
    });
    if (prior) {
      if (prior.requestHash !== reqHash) throw new ConflictException('Idempotency-Key reused with a different payload');
      return prior.response;
    }
    const product = await this.checkAccess(merchant.id, env, 'PAYIN');
    const price = await this.pricing(merchant.id, product.id);
    if (price?.txnLimitPaise && BigInt(amount) > price.txnLimitPaise) {
      throw new BadRequestException('Amount exceeds your per-transaction limit');
    }
    const provider = forceProviderId ? await this.forceProvider(forceProviderId) : await this.providerFor(merchant.id, 'PAYIN', amount);
    if (!(await hasCapability(this.p, provider.id, 'createPayin', 'PAYIN')) && !provider.isMock) {
      throw new BadRequestException('Routed provider does not support createPayin (capabilities matrix)');
    }
    let txn: any;
    try {
      txn = await this.p.transaction.create({
        data: {
          merchantId: merchant.id,
          kind: 'PAYIN',
          env: env as any,
          merchantRef: body.merchantRef,
          amountPaise: BigInt(amount),
          providerId: provider.id,
          customer: body.customer,
          metadata: { ...(body.metadata || {}), method: body.method || body.customer?.method || 'API' },
          status: 'PROCESSING',
        },
      });
    } catch (e: any) {
      if (e.code === 'P2002') {
        const ex = await this.p.transaction.findUnique({
          where: { merchantId_env_merchantRef: { merchantId: merchant.id, env: env as any, merchantRef: body.merchantRef } },
        });
        return this.view(ex);
      }
      throw e;
    }
    const started = Date.now();
    let result: any;
    let hardError = false; // timeout / transport — trips circuit; issuer FAILED does not
    try {
      result = await adapterFor(provider, await activeProviderCreds(this.p, provider.id)).createPayin({ ...body, idempotencyKey: idemKey });
    } catch (e) {
      hardError = true;
      result =
        e instanceof ProviderTimeoutError
          ? { status: 'UNKNOWN', message: 'Provider timed out — status unknown, NOT a failure. We will check status automatically.' }
          : { status: 'UNKNOWN', message: String((e as Error).message) };
    }
    txn = await this.p.$transaction(async tx => {
      const t = await tx.transaction.update({
        where: { id: txn.id },
        data: {
          status: nextStatus('PROCESSING', result.status),
          providerRef: result.providerRef,
          utr: result.status === 'SUCCESS' ? (result.utr ? String(result.utr) : null) : null,
          failureReason: result.status === 'FAILED' ? result.message : null,
          feePaise: BigInt(result.status === 'SUCCESS' ? feePaise(amount, price?.feeBps || 0, Number(price?.feeFlatPaise || 0)) : 0),
          metadata: { ...(txn.metadata as any || {}), ...(result.paymentLink ? { paymentLink: result.paymentLink, upiLink: result.upiLink || result.paymentLink, orderId: result.orderId || null } : {}) },
        },
      });
      await tx.transactionAttempt.create({
        data: {
          transactionId: t.id,
          providerId: provider.id,
          providerRef: result.providerRef,
          status: t.status,
          latencyMs: Date.now() - started,
          rawResponse: (result?.raw ?? {
            status: result?.status,
            providerRef: result?.providerRef,
            utr: result?.utr,
            message: result?.message,
          }) as any,
        },
      });
      if (t.status === 'SUCCESS') {
        const fee = Number(t.feePaise);
        await this.ledger.post(tx, `payin:${t.id}`, 'Payin collection', [
          { account: 'platform:clearing', merchantId: null, kind: 'PLATFORM', debit: amount, credit: 0 },
          { account: acct(merchant.id, 'COLLECTIONS'), merchantId: merchant.id, kind: 'COLLECTIONS', debit: 0, credit: amount - fee },
          { account: 'platform:fees', merchantId: null, kind: 'PLATFORM', debit: 0, credit: fee },
        ]);
      }
      await this.emitMerchantEvent(tx, merchant.id, env, `payin.${String(t.status).toLowerCase()}`, {
        id: t.id,
        merchantRef: t.merchantRef,
        amountPaise: amount,
        status: t.status,
        paymentLink: result.paymentLink || null,
        upiLink: result.upiLink || null,
      });
      await this.outbox(tx, t.id, 'TRANSACTION_UPDATED', { transactionId: t.id });
      return t;
    });
    if (txn.status === 'SUCCESS') await this.noteProviderOutcome(provider.id, true);
    else if (hardError) await this.noteProviderOutcome(provider.id, false, result.message || 'payin_hard_error');
    // issuer FAILED / soft decline does NOT open circuit
    const view = this.view(txn);
    try {
      await this.p.idempotencyRecord.create({
        data: {
          merchantId: merchant.id,
          scope: 'PAYIN',
          key: idemKey,
          requestHash: reqHash,
          response: view as any,
          statusCode: 201,
        },
      });
    } catch (e: any) {
      if (e.code === 'P2002') {
        const rec = await this.p.idempotencyRecord.findUnique({
          where: { merchantId_scope_key: { merchantId: merchant.id, scope: 'PAYIN', key: idemKey } },
        });
        if (rec) return rec.response;
      }
      throw e;
    }
    // Bill only successful captures
    if (txn.status === 'SUCCESS') {
      await this.p.usageRecord.create({
        data: {
          merchantId: merchant.id,
          productCode: 'PAYIN',
          env: env as any,
          feePaise: txn.feePaise,
          period: new Date().toISOString().slice(0, 7),
        },
      });
    }
    return view;
  }

  async createPayout(merchant: any, env: string, body: any, idemKey: string, forceProviderId?: string) {
    if (!idemKey) throw new BadRequestException('Idempotency-Key header is required');
    const amount = body.amountPaise;
    if (!Number.isSafeInteger(amount) || amount <= 0) throw new BadRequestException('amountPaise must be a positive integer (paise)');
    const reqHash = sha256(stableStringify(body));
    const prior = await this.p.idempotencyRecord.findUnique({
      where: { merchantId_scope_key: { merchantId: merchant.id, scope: 'PAYOUT', key: idemKey } },
    });
    if (prior) {
      if (prior.requestHash !== reqHash) throw new ConflictException('Idempotency-Key reused with a different payload');
      return prior.response;
    }
    const product = await this.checkAccess(merchant.id, env, 'PAYOUT');
    const price = await this.pricing(merchant.id, product.id);
    const fee = feePaise(amount, price?.feeBps || 0, Number(price?.feeFlatPaise || 0));
    const need = amount + fee;
    if (price?.txnLimitPaise && BigInt(amount) > price.txnLimitPaise) {
      throw new BadRequestException(`Amount exceeds your per-payout limit of ₹${(Number(price.txnLimitPaise) / 100).toFixed(2)}`);
    }

    // 1) FIRST gate — payout balance must cover amount+fee BEFORE any provider routing/hit
    const balNow = await this.ledger.balance(this.p, merchant.id, acct(merchant.id, 'PAYOUT_BALANCE'));
    if (balNow < need) {
      throw new BadRequestException(
        `Insufficient payout balance: available ₹${(balNow / 100).toFixed(2)}, need ₹${(need / 100).toFixed(2)}. Transfer settled collections first.`,
      );
    }

    // 2) Only after balance OK — pick API (or admin-forced provider)
    const provider = forceProviderId ? await this.forceProvider(forceProviderId) : await this.providerFor(merchant.id, 'PAYOUT', amount);
    if (!(await hasCapability(this.p, provider.id, 'createPayout', 'PAYOUT')) && !provider.isMock) {
      throw new BadRequestException('Routed provider does not support createPayout (capabilities matrix)');
    }

    // 3) Atomic re-check + hold (race-safe). Provider is hit ONLY after hold succeeds.
    let txn: any;
    let dupFound = false;
    await this.p
      .$transaction(
        async tx => {
          if (price?.dailyLimitPaise) {
            const dayStart = new Date();
            dayStart.setHours(0, 0, 0, 0);
            const todayAgg = await tx.transaction.aggregate({
              where: {
                merchantId: merchant.id,
                kind: 'PAYOUT',
                env: env as any,
                status: { in: ['SUCCESS', 'PROCESSING', 'PENDING', 'UNKNOWN'] },
                createdAt: { gte: dayStart },
              },
              _sum: { amountPaise: true },
            });
            const used = BigInt(Math.round(Number(todayAgg._sum.amountPaise || 0)));
            if (used + BigInt(amount) > price.dailyLimitPaise) {
              throw new BadRequestException('Daily payout limit reached for today (Payout Shield)');
            }
          }
          const bal = await this.ledger.balance(tx, merchant.id, acct(merchant.id, 'PAYOUT_BALANCE'));
          if (bal < need) {
            throw new BadRequestException(
              `Insufficient payout balance: available ₹${(bal / 100).toFixed(2)}, need ₹${(need / 100).toFixed(2)}. Transfer settled collections first.`,
            );
          }
          const mode = body.method || body.mode || 'IMPS';
          txn = await tx.transaction.create({
            data: {
              merchantId: merchant.id,
              kind: 'PAYOUT',
              env: env as any,
              merchantRef: body.merchantRef,
              amountPaise: BigInt(amount),
              feePaise: BigInt(fee),
              providerId: provider.id,
              customer: body.beneficiary,
              metadata: {
                method: mode,
                mode,
                openingBalancePaise: bal,
                closingBalancePaise: bal - need,
                totalAmountPaise: need,
              },
              status: 'PROCESSING',
            },
          });
          await this.ledger.post(tx, `payout-hold:${txn.id}`, 'Payout hold', [
            { account: acct(merchant.id, 'PAYOUT_BALANCE'), merchantId: merchant.id, kind: 'PAYOUT_BALANCE', debit: need, credit: 0 },
            { account: 'platform:payout_clearing', merchantId: null, kind: 'PLATFORM', debit: 0, credit: need },
          ]);
        },
        { isolationLevel: 'Serializable' } as any,
      )
      .catch(async (e: any) => {
        if (['P2002', 'P2034'].includes(e.code)) {
          const ex = await this.p.transaction.findUnique({
            where: { merchantId_env_merchantRef: { merchantId: merchant.id, env: env as any, merchantRef: body.merchantRef } },
          });
          if (ex) {
            dupFound = true;
            txn = ex;
            return;
          }
        }
        throw e;
      });
    if (dupFound) {
      const dup = txn;
      const rec = await this.p.idempotencyRecord.findUnique({
        where: { merchantId_scope_key: { merchantId: merchant.id, scope: 'PAYOUT', key: idemKey } },
      });
      return rec ? rec.response : this.view(dup);
    }

    // 4) Provider hit — only if balance was locked successfully
    let result: any;
    let hardError = false;
    try {
      result = await adapterFor(provider, await activeProviderCreds(this.p, provider.id)).createPayout({
        ...body,
        idempotencyKey: idemKey,
      });
    } catch (e) {
      if (e instanceof ProviderTimeoutError) {
        hardError = true;
        result = {
          status: 'UNKNOWN',
          message: 'Provider timeout — outcome UNKNOWN. Do NOT retry or switch provider; status check/reconciliation will resolve it.',
        };
      } else {
        // Non-timeout errors: fail + release hold (don't leave money locked forever)
        hardError = true;
        result = { status: 'FAILED', message: String((e as Error).message || 'Provider error') };
      }
    }
    // UNKNOWN: funds stay held, no auto-retry, no provider switch on THIS txn. Circuit may open for NEW traffic only.
    txn = await this.p.$transaction(async tx => {
      let t = await tx.transaction.update({
        where: { id: txn.id },
        data: {
          status: nextStatus('PROCESSING', result.status),
          providerRef: result.providerRef,
          utr: result.status === 'SUCCESS' ? result.utr || null : null,
          failureReason: result.status === 'FAILED' ? result.message : null,
        },
      });
      await tx.transactionAttempt.create({
        data: {
          transactionId: t.id,
          providerId: provider.id,
          providerRef: result.providerRef,
          status: t.status,
          rawResponse: (result?.raw ?? {
            status: result?.status,
            providerRef: result?.providerRef,
            utr: result?.utr,
            message: result?.message,
          }) as any,
        },
      });
      if (t.status === 'FAILED') {
        const amt = amount + fee;
        await this.ledger.post(tx, `payout-reversal:${t.id}`, 'Payout failed — hold released', [
          { account: 'platform:payout_clearing', merchantId: null, kind: 'PLATFORM', debit: amt, credit: 0 },
          { account: acct(merchant.id, 'PAYOUT_BALANCE'), merchantId: merchant.id, kind: 'PAYOUT_BALANCE', debit: 0, credit: amt },
        ]);
        const meta: any = t.metadata || {};
        if (meta.openingBalancePaise != null) {
          t = await tx.transaction.update({
            where: { id: t.id },
            data: { metadata: { ...meta, closingBalancePaise: meta.openingBalancePaise } },
          });
        }
      }
      await this.emitMerchantEvent(tx, merchant.id, env, `payout.${String(t.status).toLowerCase()}`, {
        id: t.id,
        merchantRef: t.merchantRef,
        amountPaise: amount,
        status: t.status,
      });
      return t;
    });
    if (txn.status === 'SUCCESS') await this.noteProviderOutcome(provider.id, true);
    // Only hard errors (timeout / thrown transport) trip circuit — soft issuer FAILED from adapter does not
    else if (hardError) await this.noteProviderOutcome(provider.id, false, result.message || 'payout_hard_error');
    const view = this.view(txn);
    try {
      await this.p.idempotencyRecord.create({
        data: {
          merchantId: merchant.id,
          scope: 'PAYOUT',
          key: idemKey,
          requestHash: reqHash,
          response: view as any,
          statusCode: 201,
        },
      });
    } catch (e: any) {
      if (e.code === 'P2002') {
        const rec = await this.p.idempotencyRecord.findUnique({
          where: { merchantId_scope_key: { merchantId: merchant.id, scope: 'PAYOUT', key: idemKey } },
        });
        if (rec) return rec.response;
      }
      throw e;
    }
    return view;
  }

  async createRefund(merchant: any, env: string, body: any, idemKey: string) {
    const orig = await this.p.transaction.findFirst({
      where: { merchantId: merchant.id, env: env as any, OR: [{ id: body.paymentId }, { merchantRef: body.paymentRef }] },
    });
    if (!orig || orig.status !== 'SUCCESS') throw new BadRequestException('Only a successful pay-in can be refunded');
    const amount = body.amountPaise || Number(orig.amountPaise);
    if (amount > Number(orig.amountPaise)) throw new BadRequestException('Refund exceeds original amount');
    if (amount > 50000) {
      const ap = await this.p.pendingApproval.create({
        data: {
          kind: 'REFUND',
          payload: { merchantId: merchant.id, transactionId: orig.id, amountPaise: amount, merchantRef: body.merchantRef },
          requestedBy: 'api',
        },
      });
      return { status: 'PENDING_APPROVAL', approvalId: ap.id, message: 'Refunds above ₹500 require maker-checker approval' };
    }
    const provider = await this.providerForRefund(orig);
    const result = await adapterFor(provider, await activeProviderCreds(this.p, provider.id)).createRefund({
      paymentRef: orig.providerRef || orig.id,
      amountPaise: amount,
      merchantRef: body.merchantRef,
    });
    const refund = await this.p.$transaction(async tx => {
      const r = await tx.refund.create({
        data: {
          transactionId: orig.id,
          merchantRef: body.merchantRef,
          amountPaise: BigInt(amount),
          status: result.status,
          providerRef: result.providerRef,
        },
      });
      if (result.status === 'SUCCESS') {
        await tx.transaction.update({
          where: { id: orig.id },
          data: { status: amount === Number(orig.amountPaise) ? 'REFUNDED' : 'PARTIALLY_REFUNDED' },
        });
        await this.ledger.post(tx, `refund:${r.id}`, 'Refund', [
          { account: acct(merchant.id, 'COLLECTIONS'), merchantId: merchant.id, kind: 'COLLECTIONS', debit: amount, credit: 0 },
          { account: 'platform:clearing', merchantId: null, kind: 'PLATFORM', debit: 0, credit: amount },
        ]);
      }
      await this.emitMerchantEvent(tx, merchant.id, env, 'refund.processed', {
        refundId: r.id,
        amountPaise: amount,
        status: result.status,
      });
      return r;
    });
    return { id: refund.id, status: refund.status, amountPaise: amount };
  }

  async getByRef(merchant: any, env: string, kind: string, ref: string) {
    const t = await this.p.transaction.findFirst({
      where: { merchantId: merchant.id, env: env as any, kind: kind as any, OR: [{ merchantRef: ref }, { id: ref }] },
    });
    if (!t) throw new BadRequestException('Transaction not found for this merchant');
    return this.view(t);
  }

  /** Status-check / reconciliation: the ONLY path that resolves UNKNOWN payouts. */
  async reconcileTxn(t: any) {
    if (!t.providerId) return t;
    const prov = await this.p.provider.findUnique({ where: { id: t.providerId } });
    if (!prov) return t;
    const ref =
      t.providerRef || (prov.isMock ? (t.kind === 'PAYOUT' ? `mockpo_${t.merchantRef}` : `mockpay_${t.merchantRef}`) : null);
    if (!ref) return t;
    const a = adapterFor(prov, await activeProviderCreds(this.p, prov.id));
    let r: any;
    try {
      r = t.kind === 'PAYOUT' ? await a.getPayoutStatus(ref) : await a.getPayinStatus(ref);
    } catch {
      return t;
    }
    if (!r || !r.status) return t;
    const patch: any = {};
    if (!t.providerRef && r.status) patch.providerRef = ref;
    // Status check: fill original UTR from real provider if we didn't have one yet
    if (r.utr && !t.utr) patch.utr = String(r.utr);
    if (Object.keys(patch).length) await this.p.transaction.update({ where: { id: t.id }, data: patch });
    const ns = nextStatus(t.status, r.status);
    if (ns !== t.status) {
      await this.p.$transaction(async tx => {
        let fee = Number(t.feePaise || 0);
        if (t.kind === 'PAYIN' && ns === 'SUCCESS') {
          const prod = await tx.apiProduct.findUnique({ where: { code: 'PAYIN' } });
          const price = prod ? await tx.pricingPlan.findUnique({ where: { merchantId_productId: { merchantId: t.merchantId, productId: prod.id } } }) : null;
          fee = feePaise(Number(t.amountPaise), price?.feeBps || 0, Number(price?.feeFlatPaise || 0));
        }
        await tx.transaction.update({
          where: { id: t.id },
          data: { status: ns, ...(t.kind === 'PAYIN' && ns === 'SUCCESS' ? { feePaise: BigInt(fee) } : {}), ...(r.utr && ns === 'SUCCESS' ? { utr: String(r.utr) } : {}) },
        });
        if (t.kind === 'PAYIN' && ns === 'SUCCESS') {
          const amount = Number(t.amountPaise);
          await this.ledger.post(tx, `payin:${t.id}`, 'Payin collection', [
            { account: 'platform:clearing', merchantId: null, kind: 'PLATFORM', debit: amount, credit: 0 },
            { account: acct(t.merchantId, 'COLLECTIONS'), merchantId: t.merchantId, kind: 'COLLECTIONS', debit: 0, credit: amount - fee },
            { account: 'platform:fees', merchantId: null, kind: 'PLATFORM', debit: 0, credit: fee },
          ]);
        }
        if (t.kind === 'PAYOUT' && ns === 'FAILED') {
          const amt = Number(t.amountPaise) + Number(t.feePaise);
          await this.ledger.post(tx, `payout-reversal:${t.id}`, 'Payout confirmed failed on status check — hold released', [
            { account: 'platform:payout_clearing', merchantId: null, kind: 'PLATFORM', debit: amt, credit: 0 },
            { account: acct(t.merchantId, 'PAYOUT_BALANCE'), merchantId: t.merchantId, kind: 'PAYOUT_BALANCE', debit: 0, credit: amt },
          ]);
        }
      });
      if (ns === 'SUCCESS' && t.providerId) await this.noteProviderOutcome(t.providerId, true);
    }
    return { ...t, status: ns };
  }

  view(t: any) {
    return t
      ? {
          id: t.id,
          kind: t.kind,
          env: t.env,
          status: t.status,
          merchantRef: t.merchantRef,
          amountPaise: Number(t.amountPaise),
          feePaise: Number(t.feePaise),
          currency: t.currency,
          providerRef: t.providerRef,
          utr: t.utr || null,
          paymentLink: t.metadata?.paymentLink || null,
          upiLink: t.metadata?.upiLink || null,
          createdAt: t.createdAt,
        }
      : null;
  }
}
