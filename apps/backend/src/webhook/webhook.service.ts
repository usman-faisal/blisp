import { Injectable, Logger, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Webhook } from 'svix';
import { PrismaService } from 'src/common/services/prisma.service';

interface ClerkEmailAddress {
  email_address: string;
  id: string;
}

interface ClerkUserCreatedData {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email_addresses: ClerkEmailAddress[];
  primary_email_address_id: string;
}

interface ClerkWebhookEvent {
  type: string;
  data: ClerkUserCreatedData;
}

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly prismaService: PrismaService,
  ) {}

  async handleClerkWebhook(rawBody: Buffer, headers: Record<string, string>): Promise<void> {
    const secret = this.configService.get<string>('CLERK_WEBHOOK_SECRET');

    if (!secret) {
      throw new BadRequestException('Webhook secret is not configured');
    }

    const wh = new Webhook(secret);

    let event: ClerkWebhookEvent;
    try {
      event = wh.verify(rawBody, headers) as ClerkWebhookEvent;
    } catch {
      this.logger.warn('Invalid webhook signature');
      throw new UnauthorizedException('Invalid webhook signature');
    }

    if (event.type === 'user.created') {
      await this.handleUserCreated(event.data);
    }
  }

  private async handleUserCreated(data: ClerkUserCreatedData): Promise<void> {
    const primaryEmail = data.email_addresses.find(
      (e) => e.id === data.primary_email_address_id,
    );

    if (!primaryEmail) {
      this.logger.warn(`No primary email found for Clerk user ${data.id}`);
      return;
    }

    const name =
      [data.first_name, data.last_name].filter(Boolean).join(' ').trim() ||
      primaryEmail.email_address.split('@')[0];

    const existing = await this.prismaService.user.findUnique({
      where: { email: primaryEmail.email_address },
    });

    if (existing) {
      this.logger.log(`User with email ${primaryEmail.email_address} already exists, skipping`);
      return;
    }

    await this.prismaService.user.create({
      data: {
        name,
        email: primaryEmail.email_address,
      },
    });

    this.logger.log(`User created from Clerk webhook: ${primaryEmail.email_address}`);
  }
}
