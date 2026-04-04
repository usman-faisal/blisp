import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { User } from '@repo/db';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { AuthGuard } from 'src/common/guards/auth.guard';
import { BrainDumpsService } from './brain-dumps.service';
import { CreateBrainDumpDto } from './dto/create-brain-dump.dto';

@ApiTags('brain-dumps')
@ApiBearerAuth('JWT-auth')
@UseGuards(AuthGuard)
@Controller('brain-dumps')
export class BrainDumpsController {
  constructor(private readonly brainDumpsService: BrainDumpsService) {}

  @Post()
  @ApiOperation({ summary: 'Process a new brain dump' })
  @ApiResponse({ status: 201, description: 'Brain dump processed successfully.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async createBrainDump(
    @CurrentUser() user: User,
    @Body() createBrainDumpDto: CreateBrainDumpDto,
  ) {
    return this.brainDumpsService.createBrainDump(user, createBrainDumpDto);
  }
}
