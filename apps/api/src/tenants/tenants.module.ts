import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { OperatorAuthGuard } from './guards/operator-auth.guard';
import { TenantAuthGuard } from './guards/tenant-auth.guard';
import { OperatorTenantsController } from './operator-tenants.controller';
import { OperatorTenantsService } from './operator-tenants.service';
import { TenantCredentialService } from './tenant-credential.service';
import { TenantsController } from './tenants.controller';
import { TenantsService } from './tenants.service';

@Module({
  imports: [AuthModule],
  controllers: [OperatorTenantsController, TenantsController],
  providers: [OperatorTenantsService, TenantsService, TenantCredentialService, OperatorAuthGuard, TenantAuthGuard],
})
export class TenantsModule {}
