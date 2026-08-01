import { Body, Controller, Param, ParseUUIDPipe, Patch, Post, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { User, ProjectStatus } from '@repo/db';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { AuthGuard } from 'src/common/guards/auth.guard';
import { ActivateProjectResponse, ArchiveProjectResponse, GetProjectsResponse, GetProjectDetailResponse, GetProjectStatsResponse, GetProjectPipelineResponse, GetProjectProgressResponse, UpdateProjectResponse } from '@repo/types';
import { ProjectsService } from './projects.service';
import { PipelineEventsService } from 'src/pipeline_events/pipeline-events.service';
import { UpdateProjectDto } from './dto/update-project.dto';

@ApiTags('projects')
@ApiBearerAuth('JWT-auth')
@UseGuards(AuthGuard)
@Controller('projects')
export class ProjectsController {
  constructor(
    private readonly projectsService: ProjectsService,
    private readonly pipelineEventsService: PipelineEventsService,
  ) {}

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

  @Patch(':id/archive')
  @ApiOperation({
    summary: 'Archive a project',
    description: 'Sets a project status to ARCHIVED. It will no longer appear in daily plans.',
  })
  @ApiParam({ name: 'id', description: 'Project UUID', type: String })
  @ApiResponse({ status: 200, description: 'Project archived successfully.' })
  @ApiResponse({ status: 404, description: 'Project not found or not owned by the user.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async archiveProject(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ArchiveProjectResponse> {
    return this.projectsService.archiveProject(user.id, id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update a project',
    description: 'Updates the title, description, or tech stack of a project.',
  })
  @ApiParam({ name: 'id', description: 'Project UUID', type: String })
  @ApiResponse({ status: 200, description: 'Project updated successfully.' })
  @ApiResponse({ status: 404, description: 'Project not found or not owned by the user.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async updateProject(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProjectDto,
  ): Promise<UpdateProjectResponse> {
    return this.projectsService.updateProject(user.id, id, dto);
  }

  @Get(':id/pipeline')
  @ApiOperation({
    summary: 'Get project pipeline events',
    description: 'Returns the processing pipeline status for a project (research, planning, etc.).',
  })
  @ApiParam({ name: 'id', description: 'Project UUID', type: String })
  @ApiResponse({ status: 200, description: 'Pipeline events retrieved.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async getProjectPipeline(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<GetProjectPipelineResponse> {
    return this.pipelineEventsService.getProjectPipeline(user.id, id);
  }

  @Get(':id/progress')
  @ApiOperation({
    summary: 'Get project progress',
    description:
      'Overall completion plus a per-member breakdown and the unassigned backlog count.',
  })
  @ApiParam({ name: 'id', description: 'Project UUID', type: String })
  @ApiResponse({ status: 200, description: 'Progress retrieved successfully.' })
  @ApiResponse({ status: 404, description: 'Project not found or you are not a member.' })
  async getProjectProgress(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<GetProjectProgressResponse> {
    return this.projectsService.getProjectProgress(user.id, id);
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

  @Get(':id')
  @ApiOperation({
    summary: 'Get a single project with tasks',
    description: 'Retrieves a project by ID including its tasks and resources.',
  })
  @ApiParam({ name: 'id', description: 'Project UUID', type: String })
  @ApiResponse({ status: 200, description: 'Project retrieved successfully.' })
  @ApiResponse({ status: 404, description: 'Project not found or not owned by the user.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async getProjectById(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<GetProjectDetailResponse> {
    return this.projectsService.getProjectById(user.id, id);
  }
}
