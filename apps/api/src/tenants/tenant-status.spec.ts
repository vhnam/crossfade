import { TenantStatus } from '../prisma/client';
import { toTenantPublicStatus } from './tenant-status';

describe('toTenantPublicStatus', () => {
  it('maps Prisma ACTIVE to contract active', () => {
    expect(toTenantPublicStatus(TenantStatus.ACTIVE)).toBe('active');
  });

  it('maps Prisma SUSPENDED to contract suspended', () => {
    expect(toTenantPublicStatus(TenantStatus.SUSPENDED)).toBe('suspended');
  });
});
