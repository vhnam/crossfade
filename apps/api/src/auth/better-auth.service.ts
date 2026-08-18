import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';

import { parseCorsOrigins } from '../common/cors-origins';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BetterAuthService implements OnModuleInit {
  private readonly logger = new Logger(BetterAuthService.name);

  readonly auth: ReturnType<BetterAuthService['createAuth']>;

  constructor(private readonly prisma: PrismaService) {
    this.auth = this.createAuth();
  }

  onModuleInit() {
    if (!process.env.BETTER_AUTH_SECRET) {
      this.logger.error('BETTER_AUTH_SECRET is not set');
      throw new Error('BETTER_AUTH_SECRET environment variable is required');
    }
  }

  async getSession(headers: Headers): Promise<{ operatorUserId: string } | null> {
    const session = await this.auth.api.getSession({ headers });
    if (!session) {
      return null;
    }
    return { operatorUserId: session.user.id };
  }

  private createAuth() {
    return betterAuth({
      database: prismaAdapter(this.prisma, { provider: 'postgresql' }),
      baseURL: process.env.BETTER_AUTH_URL ?? 'http://localhost:4000',
      trustedOrigins: parseCorsOrigins(),
      emailAndPassword: {
        enabled: true,
        sendResetPassword: async ({ user, url }) => {
          this.logger.log(`Password reset for ${user.email}: ${url}`);
        },
      },
      secret: process.env.BETTER_AUTH_SECRET,
    });
  }
}
