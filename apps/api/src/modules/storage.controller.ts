import { Controller, Get, Query, Res, BadRequestException } from '@nestjs/common';
import { StorageService } from './storage.service';

@Controller('storage')
export class StorageController {
  constructor(private s3: StorageService) {}

  @Get('local')
  async local(
    @Query('key') key: string,
    @Query('exp') exp: string,
    @Query('sig') sig: string,
    @Res() res: any,
  ) {
    if (!key || !exp || !sig) throw new BadRequestException('Missing signed params');
    if (!this.s3.verifyLocalSig(key, Number(exp), sig)) throw new BadRequestException('Link expired or invalid');
    try {
      const { body, mime } = await this.s3.readLocal(key);
      res.setHeader('Content-Type', mime);
      res.setHeader('Content-Disposition', 'inline');
      res.send(body);
    } catch {
      throw new BadRequestException('File not found');
    }
  }
}
