import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';

import { InvalidCredentialException, TenantSuspendedException } from '../../common/exceptions/business.exception';
import type { RequestTenantContext } from '../../common/types/request-context';
import { TenantStatus } from '../../prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantCredentialService } from '../tenant-credential.service';

@Injectable()
export class TenantAuthGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantCredentialService: TenantCredentialService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { tenantContext?: RequestTenantContext }>();

    const authorization = request.headers.authorization;
    const token = authorization?.startsWith('Bearer ') ? authorization.slice('Bearer '.length) : undefined;
    if (!token) {
      throw new InvalidCredentialException();
    }

    const apiKeyHash = this.tenantCredentialService.hashApiKey(token);
    const tenant = await this.prisma.tenant.findUnique({ where: { apiKeyHash } });
    if (!tenant) {
      throw new InvalidCredentialException();
    }

    if (tenant.status === TenantStatus.SUSPENDED) {
      throw new TenantSuspendedException();
    }

    request.tenantContext = { tenantId: tenant.id };
    return true;
  }
}
