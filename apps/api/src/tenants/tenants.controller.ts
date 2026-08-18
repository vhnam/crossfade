import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';

import type { RequestTenantContext } from '../common/types/request-context';
import { TenantSafeResponseDto } from './dto/tenant-safe-response.dto';
import { TenantAuthGuard } from './guards/tenant-auth.guard';
import { TenantsService } from './tenants.service';

@Controller('tenants')
@UseGuards(TenantAuthGuard)
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Get('me')
  getSelf(@Req() request: Request & { tenantContext: RequestTenantContext }): Promise<TenantSafeResponseDto> {
    return this.tenantsService.getSelf(request.tenantContext.tenantId);
  }
}
