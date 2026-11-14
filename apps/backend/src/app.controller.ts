import { Controller, Get } from '@nestjs/common';
import { ApiExcludeEndpoint, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from './common/decorators/public.decorator';
import { AppService } from './app.service';

/**
 * Root route, reachable without a token.
 *
 * The @Public() is explicit rather than incidental. Authentication in this app
 * is applied per controller via @UseGuards(AuthGuard), so a controller with no
 * decorator is open by default — this route was previously unauthenticated
 * because nothing had been written, which reads identically to an oversight.
 * Marking it deliberately means a reviewer can tell the difference, and the
 * audit question becomes "is this @Public() justified?" rather than "did
 * someone forget?".
 *
 * It returns a fixed string and touches no user data, so there is nothing here
 * to protect; a liveness probe needs to work without credentials.
 */
@ApiTags('health')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @Public()
  @ApiExcludeEndpoint()
  @ApiOperation({ summary: 'Liveness check' })
  getHello(): string {
    return this.appService.getHello();
  }
}
