import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaClient } from '@repo/db';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  onModuleInit() {
    this.logger.log('Connecting to database...');
  }

  onModuleDestroy() {
    this.logger.log('Disconnecting from database...');
  }
}