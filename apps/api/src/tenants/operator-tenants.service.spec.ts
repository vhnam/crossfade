import { DuplicateTenantSlugException, TenantNotFoundException } from '../common/exceptions/business.exception';
import { Prisma, TenantStatus } from '../prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { OperatorTenantsService } from './operator-tenants.service';
import { TenantCredentialService } from './tenant-credential.service';

const tenantRow = {
  id: 'tenant-1',
  slug: 'windwise',
  name: 'Windwise',
  apiKeyHash: 'hash',
  webhookUrl: 'https://windwise.example.com/hook',
  webhookSecret: 'secret',
  status: TenantStatus.ACTIVE,
  createdAt: new Date('2026-08-18T00:00:00.000Z'),
  updatedAt: new Date('2026-08-18T00:00:00.000Z'),
};

describe('OperatorTenantsService', () => {
  let service: OperatorTenantsService;
  const prisma = {
    tenant: {
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
    },
  };
  const credentials = {
    generateApiKey: jest.fn(() => ({ raw: 'cf_live_raw', hash: 'hash' })),
    generateWebhookSecret: jest.fn(() => 'whsec'),
    hashApiKey: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new OperatorTenantsService(
      prisma as unknown as PrismaService,
      credentials as unknown as TenantCredentialService,
    );
  });

  it('creates a tenant and returns the raw key and webhook secret once', async () => {
    prisma.tenant.create.mockResolvedValue({ ...tenantRow, webhookSecret: 'whsec' });

    const result = await service.createTenant({
      name: 'Windwise',
      slug: 'windwise',
      webhookUrl: 'https://windwise.example.com/hook',
    });

    expect(result.apiKey).toBe('cf_live_raw');
    expect(result.webhookSecret).toBe('whsec');
    expect(result.status).toBe('active');
  });

  it('maps a slug unique violation to DuplicateTenantSlugException', async () => {
    prisma.tenant.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '6.0.0',
        meta: { target: ['slug'] },
      }),
    );

    await expect(
      service.createTenant({
        name: 'Windwise',
        slug: 'windwise',
        webhookUrl: 'https://windwise.example.com/hook',
      }),
    ).rejects.toBeInstanceOf(DuplicateTenantSlugException);
  });

  it('throws TenantNotFoundException when the tenant id does not exist', async () => {
    prisma.tenant.findUnique.mockResolvedValue(null);

    await expect(service.getTenant('missing')).rejects.toBeInstanceOf(TenantNotFoundException);
  });

  it('suspends a tenant idempotently by updating status', async () => {
    prisma.tenant.findUnique.mockResolvedValue(tenantRow);
    prisma.tenant.update.mockResolvedValue({ ...tenantRow, status: TenantStatus.SUSPENDED });

    const result = await service.suspendTenant('tenant-1');

    expect(result.status).toBe('suspended');
    expect(result).not.toHaveProperty('apiKey');
    expect(result).not.toHaveProperty('webhookSecret');
  });
});
