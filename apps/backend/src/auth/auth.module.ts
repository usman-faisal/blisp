import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { ClerkStrategy } from './strategies/clerk.strategy';
import { PassportModule } from '@nestjs/passport';
import { UserModule } from 'src/user/user.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  controllers: [AuthController],
  imports: [PassportModule, UserModule, ConfigModule],
  providers: [ClerkStrategy],
  exports: [PassportModule],
})
export class AuthModule {}
