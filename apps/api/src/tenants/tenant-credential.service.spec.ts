import { TenantCredentialService } from './tenant-credential.service';

describe('TenantCredentialService', () => {
  const service = new TenantCredentialService();

  it('issues a cf_live_ key whose SHA-256 hash matches hashApiKey', () => {
    const { raw, hash } = service.generateApiKey();

    expect(raw.startsWith('cf_live_')).toBe(true);
    expect(hash).toBe(service.hashApiKey(raw));
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('returns a non-empty webhook secret without logging it', () => {
    const secret = service.generateWebhookSecret();
    expect(secret.length).toBeGreaterThan(0);
  });
});
