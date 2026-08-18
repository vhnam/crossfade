import { ExecutionContext } from '@nestjs/common';

import { InvalidCredentialException } from '../../common/exceptions/business.exception';
import { OperatorAuthGuard } from './operator-auth.guard';

jest.mock('../../auth/better-auth.service', () => ({
  BetterAuthService: class BetterAuthService {},
}));

function httpContext(headers: Record<string, string | string[] | undefined> = {}): ExecutionContext {
  const request = { headers, operatorContext: undefined };
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}

describe('OperatorAuthGuard', () => {
  const betterAuthService = { getSession: jest.fn() };
  let guard: OperatorAuthGuard;

  beforeEach(() => {
    jest.clearAllMocks();
    guard = new OperatorAuthGuard(betterAuthService as never);
  });

  it('rejects a missing session with the same credential message as tenant auth', async () => {
    betterAuthService.getSession.mockResolvedValue(null);

    await expect(guard.canActivate(httpContext())).rejects.toBeInstanceOf(InvalidCredentialException);
    await expect(guard.canActivate(httpContext())).rejects.toMatchObject({
      message: 'Invalid or missing API credential',
    });
  });

  it('attaches operatorUserId from a resolved session', async () => {
    betterAuthService.getSession.mockResolvedValue({ operatorUserId: 'op-1' });
    const context = httpContext({ cookie: 'better-auth.session_token=abc' });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(context.switchToHttp().getRequest().operatorContext).toEqual({ operatorUserId: 'op-1' });
  });
});
