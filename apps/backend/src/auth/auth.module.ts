import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { ClerkStrategy } from './strategies/clerk.strategy';
import { PassportModule } from '@nestjs/passport';
import { UsersModule } from 'src/users/users.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  controllers: [AuthController],
  imports: [PassportModule, UsersModule, ConfigModule],
  providers: [ClerkStrategy],
  exports: [PassportModule],
})
export class AuthModule { }
