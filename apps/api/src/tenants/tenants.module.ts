import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { OperatorTenantsController } from './operator-tenants.controller';
import { OperatorTenantsService } from './operator-tenants.service';
import { TenantCredentialService } from './tenant-credential.service';
import { TenantsController } from './tenants.controller';
import { TenantsService } from './tenants.service';

@Module({
  imports: [AuthModule],
  controllers: [OperatorTenantsController, TenantsController],
  providers: [OperatorTenantsService, TenantsService, TenantCredentialService],
})
export class TenantsModule {}
