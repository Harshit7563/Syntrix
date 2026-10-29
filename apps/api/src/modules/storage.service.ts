import { Injectable } from '@nestjs/common'; import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'; import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
@Injectable() export class StorageService { private s3=new S3Client({endpoint:process.env.S3_ENDPOINT,region:process.env.S3_REGION||'us-east-1',forcePathStyle:true,credentials:{accessKeyId:process.env.S3_ACCESS_KEY||'minioadmin',secretAccessKey:process.env.S3_SECRET_KEY||'minioadmin_dev_pw'}}); bucket=process.env.S3_BUCKET||'syntrix-kyc-private';
 async put(key:string,body:Buffer,mime:string){ await this.s3.send(new PutObjectCommand({Bucket:this.bucket,Key:key,Body:body,ContentType:mime,ServerSideEncryption:'AES256'})); }
 async signedGet(key:string){ return getSignedUrl(this.s3,new GetObjectCommand({Bucket:this.bucket,Key:key}),{expiresIn:300}); } // 5-min expiring link
 /** Malware scan hook: real deployments wire ClamAV/provider via MALWARE_SCANNER. Mock never marks documents VERIFIED. */
 async scan(_key:string){ return process.env.MALWARE_SCANNER==='mock' ? 'CLEAN_PENDING_REVIEW' : 'PENDING'; } }
