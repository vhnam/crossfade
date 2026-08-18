import { Injectable } from '@nestjs/common';

import { TenantNotFoundException } from '../common/exceptions/business.exception';
import { PrismaService } from '../prisma/prisma.service';
import { TenantSafeResponseDto } from './dto/tenant-safe-response.dto';

@Injectable()
export class TenantsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSelf(tenantId: string): Promise<TenantSafeResponseDto> {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      throw new TenantNotFoundException();
    }

    return {
      id: tenant.id,
      slug: tenant.slug,
      name: tenant.name,
      status: tenant.status,
      webhookUrl: tenant.webhookUrl,
      createdAt: tenant.createdAt,
      updatedAt: tenant.updatedAt,
    };
  }
}
