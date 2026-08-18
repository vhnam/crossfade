import type { TenantStatus } from '@prisma/client';

export class TenantIssuedResponseDto {
  id!: string;
  slug!: string;
  name!: string;
  status!: TenantStatus;
  apiKey!: string;
  webhookUrl!: string;
  webhookSecret!: string;
  createdAt!: Date;
}
