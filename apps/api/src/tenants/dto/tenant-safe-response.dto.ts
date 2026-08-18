import type { TenantStatus } from '@prisma/client';

export class TenantSafeResponseDto {
  id!: string;
  slug!: string;
  name!: string;
  status!: TenantStatus;
  webhookUrl!: string;
  createdAt!: Date;
  updatedAt!: Date;
}
