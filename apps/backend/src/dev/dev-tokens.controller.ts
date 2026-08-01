import { Controller, ForbiddenException, Get, Logger, NotFoundException, Param, Query } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiExcludeEndpoint, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Public } from 'src/common/decorators/public.decorator';
import { PrismaService } from 'src/common/services/prisma.service';

/**
 * Development-only helper for minting Clerk tokens to test against Swagger.
 *
 * SECURITY: these routes mint a valid token for ANY user without a password —
 * an impersonation bypass by design. They are gated three ways:
 *
 *   1. DevTokensModule is only registered when NODE_ENV !== 'production'
 *   2. Every handler re-checks NODE_ENV at request time, so a misconfigured
 *      registration still cannot serve a token in production
 *   3. ENABLE_DEV_TOKENS must be explicitly 'true' in the environment
 *
 * Never enable this on a deployed instance.
 */
@ApiTags('dev')
@Controller('dev')
export class DevTokensController {
  private readonly logger = new Logger(DevTokensController.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  private assertDevOnly(): string {
    const nodeEnv = this.config.get<string>('NODE_ENV');

    if (nodeEnv === 'production') {
      throw new NotFoundException();
    }

    if (this.config.get<string>('ENABLE_DEV_TOKENS') !== 'true') {
      throw new ForbiddenException(
        'Dev token endpoints are disabled. Set ENABLE_DEV_TOKENS=true in apps/backend/.env to use them.',
      );
    }

    const secretKey = this.config.get<string>('CLERK_SECRET_KEY');

    if (!secretKey) {
      throw new ForbiddenException('CLERK_SECRET_KEY is not configured.');
    }

    return secretKey;
  }

  @Get('users')
  @Public()
  @ApiOperation({
    summary: '[dev] List local users with their Clerk ids',
    description: 'Use these ids with /dev/token/:userId. Development only.',
  })
  async listUsers() {
    this.assertDevOnly();

    const users = await this.prisma.user.findMany({
      select: { id: true, name: true, email: true },
      orderBy: { createdAt: 'asc' },
    });

    return {
      data: users.map((user) => ({
        ...user,
        tokenUrl: `/api/v1/dev/token/${user.id}`,
      })),
      message: 'Users retrieved. Development only.',
      success: true,
    };
  }

  @Get('token/:userId')
  @Public()
  @ApiOperation({
    summary: '[dev] Mint a long-lived Clerk token for a user',
    description:
      'Returns a token valid for 12 hours (via the "dev-long" Clerk JWT template) instead of the default 60 seconds. Development only.',
  })
  @ApiQuery({
    name: 'template',
    required: false,
    description: 'Clerk JWT template name. Defaults to "dev-long" (12h). Pass "" for the 60s default.',
  })
  async mintToken(@Param('userId') userId: string, @Query('template') template = 'dev-long') {
    const secretKey = this.assertDevOnly();

    // Fail with a clear message rather than a confusing 401 later, when the
    // token verifies but the user is missing from the local database.
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException(`No local user ${userId}. Run "pnpm --filter backend sync:users" first.`);
    }

    const session = await this.clerkFetch(secretKey, '/sessions', {
      method: 'POST',
      body: JSON.stringify({ user_id: userId }),
    });

    const path = template ? `/sessions/${session.id}/tokens/${template}` : `/sessions/${session.id}/tokens`;

    const token = await this.clerkFetch(secretKey, path, {
      method: 'POST',
      body: JSON.stringify({}),
    });

    this.logger.warn(`[dev] Minted a token for ${user.email} — impersonation helper.`);

    return {
      data: {
        token: token.jwt,
        user: { id: user.id, name: user.name, email: user.email },
        template: template || 'default (60s)',
        usage: 'Paste into Swagger Authorize, or: Authorization: Bearer <token>',
      },
      message: 'Token minted. Development only.',
      success: true,
    };
  }

  private async clerkFetch(secretKey: string, path: string, init: { method: string; body: string }): Promise<any> {
    const response = await fetch(`https://api.clerk.com/v1${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
      },
    });

    const payload = await response.json();

    if (!response.ok) {
      const detail = payload?.errors?.[0]?.message ?? response.statusText;

      // A missing template is the likeliest failure, so name the fix.
      if (path.includes('/tokens/') && response.status === 404) {
        throw new NotFoundException(
          `Clerk JWT template not found. Create it in the Clerk dashboard (JWT Templates) or pass ?template= for the 60s default. Original: ${detail}`,
        );
      }

      throw new ForbiddenException(`Clerk API error: ${detail}`);
    }

    return payload;
  }
}
