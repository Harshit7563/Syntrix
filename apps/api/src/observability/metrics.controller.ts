import { Controller, Get, Header, Req, UnauthorizedException } from '@nestjs/common';
import { MetricsService } from './metrics.service';

@Controller()
export class MetricsController {
  constructor(private metrics: MetricsService) {}

  @Get('metrics')
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  scrape(@Req() req: any) {
    const want = process.env.METRICS_TOKEN;
    if (want) {
      const got = String(req.headers?.['x-metrics-token'] || req.query?.token || '');
      if (got !== want) throw new UnauthorizedException('metrics token required');
    }
    return this.metrics.render();
  }
}
