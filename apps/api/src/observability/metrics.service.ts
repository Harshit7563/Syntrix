import { Injectable } from '@nestjs/common';
import { routeLabel } from './log';

@Injectable()
export class MetricsService {
  private http = new Map<string, { count: number; ms: number }>();
  readonly startedAt = Date.now();

  observeHttp(method: string, path: string, status: number, ms: number) {
    const route = routeLabel(path);
    const key = `${method.toUpperCase()}|${route}|${status}`;
    const cur = this.http.get(key) || { count: 0, ms: 0 };
    cur.count += 1;
    cur.ms += Math.max(0, ms);
    this.http.set(key, cur);
  }

  render(): string {
    const lines = [
      '# HELP syntrix_up 1 if this process is serving metrics',
      '# TYPE syntrix_up gauge',
      'syntrix_up 1',
      '# HELP syntrix_process_uptime_seconds Process uptime',
      '# TYPE syntrix_process_uptime_seconds gauge',
      `syntrix_process_uptime_seconds ${((Date.now() - this.startedAt) / 1000).toFixed(0)}`,
      '# HELP syntrix_http_requests_total HTTP requests',
      '# TYPE syntrix_http_requests_total counter',
    ];
    for (const [key, v] of [...this.http.entries()].sort()) {
      const [method, route, status] = key.split('|');
      lines.push(`syntrix_http_requests_total{method="${esc(method)}",route="${esc(route)}",status="${esc(status)}"} ${v.count}`);
    }
    lines.push('# HELP syntrix_http_request_duration_ms_sum Request duration sum');
    lines.push('# TYPE syntrix_http_request_duration_ms_sum counter');
    for (const [key, v] of [...this.http.entries()].sort()) {
      const [method, route, status] = key.split('|');
      lines.push(`syntrix_http_request_duration_ms_sum{method="${esc(method)}",route="${esc(route)}",status="${esc(status)}"} ${Math.round(v.ms)}`);
    }
    return lines.join('\n') + '\n';
  }
}

function esc(s: string) {
  return String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}
