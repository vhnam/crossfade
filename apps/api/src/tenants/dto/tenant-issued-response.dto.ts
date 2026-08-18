import type { TenantPublicStatus } from '../tenant-status';

export class TenantIssuedResponseDto {
  id!: string;
  slug!: string;
  name!: string;
  status!: TenantPublicStatus;
  apiKey!: string;
  webhookUrl!: string;
  webhookSecret!: string;
  createdAt!: Date;
}
