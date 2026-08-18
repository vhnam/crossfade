import type { TenantPublicStatus } from '../tenant-status';

export class TenantSafeResponseDto {
  id!: string;
  slug!: string;
  name!: string;
  status!: TenantPublicStatus;
  webhookUrl!: string;
  createdAt!: Date;
  updatedAt!: Date;
}
