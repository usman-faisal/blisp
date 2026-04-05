import { Controller, Param, ParseUUIDPipe, Post, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { User, ProjectStatus } from '@repo/db';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { AuthGuard } from 'src/common/guards/auth.guard';
import { ActivateProjectResponse, GetProjectsResponse, GetProjectStatsResponse } from '@repo/types';
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
  ): Promise<ActivateProjectResponse> {
    return this.projectsService.activateProject(user.id, id);
  }

  @Get('stats')
  @ApiOperation({
    summary: 'Get project statistics',
    description: 'Retrieves counts of projects by status for the current user.',
  })
  @ApiResponse({ status: 200, description: 'Stats retrieved successfully.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async getProjectStats(@CurrentUser() user: User): Promise<GetProjectStatsResponse> {
    return this.projectsService.getProjectStats(user.id);
  }

  @Get()
  @ApiOperation({
    summary: 'Get all projects',
    description: 'Retrieves projects for the current user, optionally filtered by status.',
  })
  @ApiQuery({ name: 'status', enum: ProjectStatus, required: false })
  @ApiResponse({ status: 200, description: 'Projects retrieved successfully.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async getProjects(
    @CurrentUser() user: User,
    @Query('status') status?: ProjectStatus,
  ): Promise<GetProjectsResponse> {
    return this.projectsService.getProjects(user.id, status);
  }
}
