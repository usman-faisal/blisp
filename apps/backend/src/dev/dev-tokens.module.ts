import { Module } from '@nestjs/common';
import { PrismaService } from 'src/common/services/prisma.service';
import { DevTokensController } from './dev-tokens.controller';

/**
 * Registered conditionally from app.module.ts — see the guard there. The
 * controller re-checks NODE_ENV and ENABLE_DEV_TOKENS on every request, so this
 * module being present is never sufficient to serve a token.
 */
@Module({
  controllers: [DevTokensController],
  providers: [PrismaService],
})
export class DevTokensModule {}
