import { Injectable } from '@nestjs/common';

import { DuplicateTenantSlugException, TenantNotFoundException } from '../common/exceptions/business.exception';
import { TenantStatus } from '../prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { RotateKeyResponseDto } from './dto/rotate-key-response.dto';
import { TenantIssuedResponseDto } from './dto/tenant-issued-response.dto';
import { TenantSafeResponseDto } from './dto/tenant-safe-response.dto';
import { TenantCredentialService } from './tenant-credential.service';
import { toTenantPublicStatus } from './tenant-status';

@Injectable()
export class OperatorTenantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantCredentialService: TenantCredentialService,
  ) {}

  async createTenant(dto: CreateTenantDto): Promise<TenantIssuedResponseDto> {
    const { raw: apiKey, hash: apiKeyHash } = this.tenantCredentialService.generateApiKey();
    const webhookSecret = this.tenantCredentialService.generateWebhookSecret();

    try {
      const tenant = await this.prisma.tenant.create({
        data: {
          name: dto.name,
          slug: dto.slug,
          webhookUrl: dto.webhookUrl,
          apiKeyHash,
          webhookSecret,
          status: TenantStatus.ACTIVE,
        },
      });

      return {
        id: tenant.id,
        slug: tenant.slug,
        name: tenant.name,
        status: toTenantPublicStatus(tenant.status),
        apiKey,
        webhookUrl: tenant.webhookUrl,
        webhookSecret: tenant.webhookSecret,
        createdAt: tenant.createdAt,
      };
    } catch (error: unknown) {
      if (isSlugUniqueViolation(error)) {
        throw new DuplicateTenantSlugException();
      }
      throw error;
    }
  }

  async suspendTenant(tenantId: string): Promise<TenantSafeResponseDto> {
    return this.setStatus(tenantId, TenantStatus.SUSPENDED);
  }

  async reactivateTenant(tenantId: string): Promise<TenantSafeResponseDto> {
    return this.setStatus(tenantId, TenantStatus.ACTIVE);
  }

  async rotateKey(tenantId: string): Promise<RotateKeyResponseDto> {
    await this.getTenantOrThrow(tenantId);

    const { raw: apiKey, hash: apiKeyHash } = this.tenantCredentialService.generateApiKey();
    const tenant = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { apiKeyHash },
    });

    return { id: tenant.id, apiKey };
  }

  async getTenant(tenantId: string): Promise<TenantSafeResponseDto> {
    const tenant = await this.getTenantOrThrow(tenantId);
    return this.toSafeResponse(tenant);
  }

  private async setStatus(tenantId: string, status: TenantStatus): Promise<TenantSafeResponseDto> {
    await this.getTenantOrThrow(tenantId);

    const tenant = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { status },
    });

    return this.toSafeResponse(tenant);
  }

  private async getTenantOrThrow(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      throw new TenantNotFoundException();
    }
    return tenant;
  }

  private toSafeResponse(tenant: {
    id: string;
    slug: string;
    name: string;
    status: TenantStatus;
    webhookUrl: string;
    createdAt: Date;
    updatedAt: Date;
  }): TenantSafeResponseDto {
    return {
      id: tenant.id,
      slug: tenant.slug,
      name: tenant.name,
      status: toTenantPublicStatus(tenant.status),
      webhookUrl: tenant.webhookUrl,
      createdAt: tenant.createdAt,
      updatedAt: tenant.updatedAt,
    };
  }
}

function isSlugUniqueViolation(error: unknown): boolean {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return false;
  }

  const { code, meta } = error as { code: unknown; meta?: { target?: unknown } };
  if (code !== 'P2002') {
    return false;
  }

  const target = meta?.target;
  const fields = Array.isArray(target) ? target : typeof target === 'string' ? [target] : [];
  return fields.includes('slug');
}
