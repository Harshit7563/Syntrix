import { Injectable } from '@nestjs/common';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import * as fs from 'fs/promises';
import * as path from 'path';
import { createHmac } from 'crypto';

@Injectable()
export class StorageService {
  private driver = (process.env.STORAGE_DRIVER || 's3').toLowerCase();
  private localRoot = process.env.LOCAL_STORAGE_PATH || '/data/uploads';
  private bucket = process.env.S3_BUCKET || 'syntrix-kyc-private';
  private s3 =
    this.driver === 'local'
      ? null
      : new S3Client({
          endpoint: process.env.S3_ENDPOINT,
          region: process.env.S3_REGION || 'us-east-1',
          forcePathStyle: true,
          credentials: {
            accessKeyId: process.env.S3_ACCESS_KEY || 'minioadmin',
            secretAccessKey: process.env.S3_SECRET_KEY || 'minioadmin_dev_pw',
          },
        });

  private localPath(key: string) {
    const safe = key.replace(/\.\./g, '_');
    return path.join(this.localRoot, this.bucket, safe);
  }

  async put(key: string, body: Buffer, mime: string) {
    if (this.driver === 'local') {
      const file = this.localPath(key);
      await fs.mkdir(path.dirname(file), { recursive: true });
      await fs.writeFile(file, body);
      await fs.writeFile(`${file}.meta`, JSON.stringify({ mime }), 'utf8');
      return;
    }
    await this.s3!.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: mime,
        ServerSideEncryption: 'AES256',
      }),
    );
  }

  async signedGet(key: string) {
    if (this.driver === 'local') {
      const exp = Math.floor(Date.now() / 1000) + 300;
      const sig = createHmac('sha256', process.env.COOKIE_SECRET || 'local-storage')
        .update(`${key}:${exp}`)
        .digest('hex');
      const base = (process.env.PUBLIC_API_URL || process.env.WEB_ORIGIN || '').replace(/\/$/, '');
      return `${base}/api/storage/local?key=${encodeURIComponent(key)}&exp=${exp}&sig=${sig}`;
    }
    return getSignedUrl(this.s3!, new GetObjectCommand({ Bucket: this.bucket, Key: key }), {
      expiresIn: 300,
    });
  }

  async readLocal(key: string) {
    const file = this.localPath(key);
    const body = await fs.readFile(file);
    let mime = 'application/octet-stream';
    try {
      mime = JSON.parse(await fs.readFile(`${file}.meta`, 'utf8')).mime || mime;
    } catch {
      /* ignore */
    }
    return { body, mime };
  }

  verifyLocalSig(key: string, exp: number, sig: string) {
    if (!exp || exp < Math.floor(Date.now() / 1000)) return false;
    const expect = createHmac('sha256', process.env.COOKIE_SECRET || 'local-storage')
      .update(`${key}:${exp}`)
      .digest('hex');
    return expect === sig;
  }

  /** Malware scan hook: real deployments wire ClamAV/provider via MALWARE_SCANNER. Mock never marks documents VERIFIED. */
  async scan(_key: string) {
    return process.env.MALWARE_SCANNER === 'mock' ? 'CLEAN_PENDING_REVIEW' : 'PENDING';
  }
}
