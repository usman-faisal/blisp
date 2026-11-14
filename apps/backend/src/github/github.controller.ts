import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { User } from '@repo/db';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { AuthGuard } from 'src/common/guards/auth.guard';
import { THROTTLE_GITHUB_SYNC } from 'src/common/lib/throttle';
import { AddEvidenceDto, LinkRepositoryDto } from './dto/github.dto';
import { GithubService } from './github.service';

/**
 * Repository linking and completion verification.
 *
 * Every route is project-scoped and goes through assertMember in the service.
 * Note the absence of any endpoint that sets a verdict: verdicts are derived
 * from evidence, and exposing a setter would defeat the point of having them.
 */
@ApiTags('github')
@ApiBearerAuth('JWT-auth')
@UseGuards(AuthGuard)
@Controller('projects/:projectId/github')
export class GithubController {
  constructor(private readonly githubService: GithubService) {}

  @Post('repositories')
  @ApiOperation({ summary: 'Link a GitHub repository to this project (read-only)' })
  @ApiResponse({ status: 201, description: 'Repository linked.' })
  @ApiResponse({ status: 400, description: 'Malformed reference, or private with no token.' })
  @ApiResponse({ status: 404, description: 'Repository not found or not visible.' })
  async linkRepository(
    @CurrentUser() user: User,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: LinkRepositoryDto,
  ) {
    const data = await this.githubService.linkRepository(user.id, projectId, dto.repository, dto.token);
    return { success: true, data };
  }

  @Get('repositories')
  @ApiOperation({ summary: 'List repositories linked to this project' })
  async listRepositories(@CurrentUser() user: User, @Param('projectId', ParseUUIDPipe) projectId: string) {
    const data = await this.githubService.listRepositories(user.id, projectId);
    return { success: true, data };
  }

  @Delete('repositories/:repositoryId')
  @ApiOperation({ summary: 'Unlink a repository and re-judge every task' })
  async unlinkRepository(
    @CurrentUser() user: User,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('repositoryId', ParseUUIDPipe) repositoryId: string,
  ) {
    const data = await this.githubService.unlinkRepository(user.id, projectId, repositoryId);
    return { success: true, data };
  }

  @Post('repositories/:repositoryId/sync')
  // GitHub's unauthenticated budget is 60/hour and shared across the whole
  // deployment, so this is capped well below it.
  @Throttle({ default: THROTTLE_GITHUB_SYNC })
  @ApiOperation({ summary: 'Fetch new commits and record evidence for referenced tasks' })
  @ApiResponse({ status: 201, description: 'Sync completed.' })
  @ApiResponse({ status: 400, description: 'GitHub unreachable or rate limited.' })
  async syncRepository(
    @CurrentUser() user: User,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('repositoryId', ParseUUIDPipe) repositoryId: string,
  ) {
    const data = await this.githubService.syncRepository(user.id, projectId, repositoryId);
    return { success: true, data };
  }

  @Get('verification')
  @ApiOperation({ summary: 'Project-wide verification totals for completed tasks' })
  async getProjectVerification(@CurrentUser() user: User, @Param('projectId', ParseUUIDPipe) projectId: string) {
    const data = await this.githubService.getProjectVerification(user.id, projectId);
    return { success: true, data };
  }

  @Get('tasks/:taskId/verification')
  @ApiOperation({ summary: "One task's verdict and the evidence behind it" })
  async getTaskVerification(
    @CurrentUser() user: User,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
  ) {
    const data = await this.githubService.getTaskVerification(user.id, projectId, taskId);
    return { success: true, data };
  }

  @Post('tasks/:taskId/evidence')
  @ApiOperation({ summary: 'Attach a GitHub link to a task as manual evidence' })
  async addEvidence(
    @CurrentUser() user: User,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() dto: AddEvidenceDto,
  ) {
    const data = await this.githubService.addManualEvidence(user.id, projectId, taskId, dto);
    return { success: true, data };
  }

  @Delete('evidence/:evidenceId')
  @ApiOperation({ summary: 'Remove a piece of evidence and re-judge its task' })
  async removeEvidence(
    @CurrentUser() user: User,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('evidenceId', ParseUUIDPipe) evidenceId: string,
  ) {
    const data = await this.githubService.removeEvidence(user.id, projectId, evidenceId);
    return { success: true, data };
  }
}
