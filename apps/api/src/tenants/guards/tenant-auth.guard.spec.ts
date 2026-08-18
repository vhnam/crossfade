import { ExecutionContext } from '@nestjs/common';

import { InvalidCredentialException, TenantSuspendedException } from '../../common/exceptions/business.exception';
import { TenantStatus } from '../../prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantCredentialService } from '../tenant-credential.service';
import { TenantAuthGuard } from './tenant-auth.guard';

function httpContext(authorization?: string): ExecutionContext {
  const request = { headers: { authorization }, tenantContext: undefined };
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}

describe('TenantAuthGuard', () => {
  const prisma = { tenant: { findUnique: jest.fn() } };
  const credentials = { hashApiKey: jest.fn(() => 'hashed') };
  let guard: TenantAuthGuard;

  beforeEach(() => {
    jest.clearAllMocks();
    guard = new TenantAuthGuard(prisma as unknown as PrismaService, credentials as unknown as TenantCredentialService);
  });

  it('rejects a missing bearer token with 401', async () => {
    await expect(guard.canActivate(httpContext())).rejects.toBeInstanceOf(InvalidCredentialException);
  });

  it('rejects an unknown key with 401', async () => {
    prisma.tenant.findUnique.mockResolvedValue(null);

    await expect(guard.canActivate(httpContext('Bearer cf_live_unknown'))).rejects.toBeInstanceOf(
      InvalidCredentialException,
    );
  });

  it('rejects a suspended tenant with 403', async () => {
    prisma.tenant.findUnique.mockResolvedValue({ id: 't1', status: TenantStatus.SUSPENDED });

    await expect(guard.canActivate(httpContext('Bearer cf_live_ok'))).rejects.toBeInstanceOf(TenantSuspendedException);
  });

  it('attaches tenantId for an active credential', async () => {
    prisma.tenant.findUnique.mockResolvedValue({ id: 't1', status: TenantStatus.ACTIVE });
    const context = httpContext('Bearer cf_live_ok');

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(context.switchToHttp().getRequest().tenantContext).toEqual({ tenantId: 't1' });
  });
});
