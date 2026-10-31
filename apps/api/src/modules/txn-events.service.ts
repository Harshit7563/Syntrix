import { Injectable } from '@nestjs/common';
import { EventEmitter } from 'events';

export type TxnLiveEvent = {
  type: 'txn';
  id: string;
  merchantId: string | null;
  kind: string;
  status: string;
  amountPaise: number;
  feePaise?: number;
  currency?: string;
  orderId?: string | null;
  utr?: string | null;
  providerCode?: string | null;
  providerName?: string | null;
  message?: string | null;
  createdAt: string;
  updatedAt: string;
};

@Injectable()
export class TxnEventsService {
  private bus = new EventEmitter();
  constructor() {
    this.bus.setMaxListeners(200);
  }

  publish(ev: TxnLiveEvent) {
    this.bus.emit('txn', ev);
  }

  subscribe(listener: (ev: TxnLiveEvent) => void) {
    this.bus.on('txn', listener);
    return () => this.bus.off('txn', listener);
  }
}
