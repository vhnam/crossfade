import { Test, TestingModule } from '@nestjs/testing';
import type { Request } from 'express';

import type { RequestTenantContext } from '../common/types/request-context';
import { TenantAuthGuard } from './guards/tenant-auth.guard';
import { TenantsController } from './tenants.controller';
import { TenantsService } from './tenants.service';

describe('TenantsController', () => {
  let controller: TenantsController;
  const getSelf = jest.fn();

  beforeEach(async () => {
    getSelf.mockReset();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TenantsController],
      providers: [{ provide: TenantsService, useValue: { getSelf } }],
    })
      .overrideGuard(TenantAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(TenantsController);
  });

  it('identifies the tenant from guard context, not from the request path', async () => {
    const request = {
      tenantContext: { tenantId: 'tenant-from-guard' },
      params: { id: 'should-not-be-used' },
    } as unknown as Request & { tenantContext: RequestTenantContext };

    getSelf.mockResolvedValue({ id: 'tenant-from-guard' });

    await controller.getSelf(request);

    expect(getSelf).toHaveBeenCalledWith('tenant-from-guard');
    expect(getSelf).not.toHaveBeenCalledWith('should-not-be-used');
  });
});
