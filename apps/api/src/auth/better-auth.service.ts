import { Injectable, Logger } from '@nestjs/common';
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';

import { parseCorsOrigins } from '../common/cors-origins';
import { env } from '../env';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BetterAuthService {
  private readonly logger = new Logger(BetterAuthService.name);

  readonly auth: ReturnType<BetterAuthService['createAuth']>;

  constructor(private readonly prisma: PrismaService) {
    this.auth = this.createAuth();
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
      baseURL: env.BETTER_AUTH_URL,
      trustedOrigins: parseCorsOrigins(),
      emailAndPassword: {
        enabled: true,
        sendResetPassword: async ({ user, url }) => {
          this.logger.log(`Password reset for ${user.email}: ${url}`);
        },
      },
      secret: env.BETTER_AUTH_SECRET,
    });
  }
}
