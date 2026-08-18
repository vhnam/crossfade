import { All, Controller, Req, Res } from '@nestjs/common';
import { toNodeHandler } from 'better-auth/node';
import type { Request, Response } from 'express';

import { BetterAuthService } from './better-auth.service';

@Controller('api/auth')
export class AuthController {
  constructor(private readonly betterAuthService: BetterAuthService) {}

  @All('*splat')
  async handle(@Req() req: Request, @Res() res: Response): Promise<void> {
    await toNodeHandler(this.betterAuthService.auth.handler)(req, res);
  }
}
