import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';

import { CreateTenantDto } from './dto/create-tenant.dto';
import { RotateKeyResponseDto } from './dto/rotate-key-response.dto';
import { TenantIssuedResponseDto } from './dto/tenant-issued-response.dto';
import { TenantSafeResponseDto } from './dto/tenant-safe-response.dto';
import { OperatorAuthGuard } from './guards/operator-auth.guard';
import { OperatorTenantsService } from './operator-tenants.service';

@Controller('operator/tenants')
@UseGuards(OperatorAuthGuard)
export class OperatorTenantsController {
  constructor(private readonly operatorTenantsService: OperatorTenantsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  createTenant(@Body() dto: CreateTenantDto): Promise<TenantIssuedResponseDto> {
    return this.operatorTenantsService.createTenant(dto);
  }

  @Post(':id/suspend')
  @HttpCode(HttpStatus.OK)
  suspendTenant(@Param('id') id: string): Promise<TenantSafeResponseDto> {
    return this.operatorTenantsService.suspendTenant(id);
  }

  @Post(':id/reactivate')
  @HttpCode(HttpStatus.OK)
  reactivateTenant(@Param('id') id: string): Promise<TenantSafeResponseDto> {
    return this.operatorTenantsService.reactivateTenant(id);
  }

  @Post(':id/rotate-key')
  @HttpCode(HttpStatus.OK)
  rotateKey(@Param('id') id: string): Promise<RotateKeyResponseDto> {
    return this.operatorTenantsService.rotateKey(id);
  }

  @Get(':id')
  getTenant(@Param('id') id: string): Promise<TenantSafeResponseDto> {
    return this.operatorTenantsService.getTenant(id);
  }
}
