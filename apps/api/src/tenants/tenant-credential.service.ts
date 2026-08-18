import { randomBytes, createHash } from 'node:crypto';

import { Injectable } from '@nestjs/common';

@Injectable()
export class TenantCredentialService {
  generateApiKey(): { raw: string; hash: string } {
    const raw = `cf_live_${randomBytes(32).toString('base64url')}`;
    return { raw, hash: this.hashApiKey(raw) };
  }

  hashApiKey(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }

  generateWebhookSecret(): string {
    return randomBytes(32).toString('base64url');
  }
}
