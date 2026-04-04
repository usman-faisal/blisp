import { Controller, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { User } from '@repo/db';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { AuthGuard } from 'src/common/guards/auth.guard';
import { ProjectsService } from './projects.service';

@ApiTags('projects')
@ApiBearerAuth('JWT-auth')
@UseGuards(AuthGuard)
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post(':id/activate')
  @ApiOperation({
    summary: 'Activate an incubator project',
    description:
      'Promotes a project from INCUBATOR to ACTIVE status. Its tasks will automatically appear in future daily plans.',
  })
  @ApiParam({ name: 'id', description: 'Project UUID', type: String })
  @ApiResponse({ status: 201, description: 'Project activated successfully.' })
  @ApiResponse({ status: 404, description: 'Project not found or not owned by the user.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async activateProject(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.projectsService.activateProject(user.id, id);
  }
}
