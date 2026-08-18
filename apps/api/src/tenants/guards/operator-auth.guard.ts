import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';

import { BetterAuthService } from '../../auth/better-auth.service';
import { InvalidCredentialException } from '../../common/exceptions/business.exception';
import type { RequestOperatorContext } from '../../common/types/request-context';

@Injectable()
export class OperatorAuthGuard implements CanActivate {
  constructor(private readonly betterAuthService: BetterAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { operatorContext?: RequestOperatorContext }>();

    const headers = new Headers();
    for (const [key, value] of Object.entries(request.headers)) {
      if (typeof value === 'string') {
        headers.append(key, value);
      } else if (Array.isArray(value)) {
        for (const item of value) headers.append(key, item);
      }
    }

    const session = await this.betterAuthService.getSession(headers);
    if (!session) {
      throw new InvalidCredentialException();
    }

    request.operatorContext = session;
    return true;
  }
}
