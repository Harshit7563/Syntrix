import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import * as crypto from 'crypto';
import { MetricsService } from './metrics.service';
import { routeLabel, slog } from './log';

const SKIP = new Set(['/health', '/health/ready', '/metrics']);

@Injectable()
export class HttpLogInterceptor implements NestInterceptor {
  constructor(private metrics: MetricsService) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<any> {
    const http = ctx.switchToHttp();
    const req: any = http.getRequest();
    const res: any = http.getResponse();
    const started = Date.now();
    const id = String(req.headers?.['x-request-id'] || crypto.randomUUID());
    req.requestId = id;
    if (res?.setHeader) res.setHeader('x-request-id', id);
    return next.handle().pipe(
      tap({
        next: () => this.done(req, res?.statusCode || 200, started),
        error: (err) => this.done(req, Number(err?.status || err?.statusCode || 500), started, err),
      }),
    );
  }

  private done(req: any, status: number, started: number, err?: any) {
    const path = String(req.path || req.url || '/');
    const method = String(req.method || 'GET');
    const ms = Date.now() - started;
    if (!SKIP.has(path.split('?')[0])) {
      this.metrics.observeHttp(method, path, status, ms);
      slog(status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info', 'http', {
        requestId: req.requestId,
        method,
        route: routeLabel(path),
        status,
        ms,
        ip: String(req.ip || '').replace(/^::ffff:/, ''),
        ...(err?.message ? { error: String(err.message).slice(0, 180) } : {}),
      });
    }
  }
}
