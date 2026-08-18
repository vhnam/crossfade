import { TenantStatus } from '../prisma/client';

export type TenantPublicStatus = 'active' | 'suspended';

export function toTenantPublicStatus(status: TenantStatus): TenantPublicStatus {
  switch (status) {
    case TenantStatus.ACTIVE:
      return 'active';
    case TenantStatus.SUSPENDED:
      return 'suspended';
  }
}
