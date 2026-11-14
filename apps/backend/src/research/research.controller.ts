import { Body, Controller, Get, Param, ParseIntPipe, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { User } from '@repo/db';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { AuthGuard } from 'src/common/guards/auth.guard';
import { THROTTLE_AI } from 'src/common/lib/throttle';
import { RejectReportDto } from './dto/reject-report.dto';
import { ResearchService } from './research.service';

/**
 * Discovery reports are addressed under their project, since that is what
 * authorises access to them: every handler goes through
 * ProjectAccessService.assertMember.
 */
@ApiTags('research')
@ApiBearerAuth('JWT-auth')
@UseGuards(AuthGuard)
@Controller('projects/:projectId/research-report')
export class ResearchController {
  constructor(private readonly researchService: ResearchService) {}

  @Post()
  // A full discovery report is the most expensive call in the system: model
  // time plus a batch of Tavily searches.
  @Throttle({ default: THROTTLE_AI })
  @ApiOperation({
    summary: 'Generate a new research report version',
    description:
      'Queues an evidence-informed product discovery report. Returns immediately with a PENDING ' +
      'report; poll the GET endpoint or the project pipeline for progress. Always creates a new ' +
      'version, so an approved report is never overwritten.',
  })
  @ApiParam({ name: 'projectId', description: 'Project UUID', type: String })
  @ApiResponse({ status: 201, description: 'Report generation queued.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Not a member of this project.' })
  @ApiResponse({ status: 404, description: 'Project not found.' })
  @ApiResponse({ status: 409, description: 'A report is already being generated.' })
  async requestReport(@CurrentUser() user: User, @Param('projectId', ParseUUIDPipe) projectId: string) {
    const report = await this.researchService.requestReport(user.id, projectId);

    return {
      data: {
        id: report.id,
        version: report.version,
        status: report.status,
      },
      message: 'Research report queued.',
      success: true,
    };
  }

  @Get()
  @ApiOperation({ summary: 'Get the latest research report for a project' })
  @ApiParam({ name: 'projectId', description: 'Project UUID', type: String })
  @ApiResponse({ status: 200, description: 'Latest report, or null if none exists yet.' })
  @ApiResponse({ status: 403, description: 'Not a member of this project.' })
  async getLatest(@CurrentUser() user: User, @Param('projectId', ParseUUIDPipe) projectId: string) {
    const report = await this.researchService.getLatestReport(user.id, projectId);

    return {
      data: report,
      message: report ? 'Research report retrieved.' : 'No research report yet.',
      success: true,
    };
  }

  @Get('versions')
  @ApiOperation({
    summary: 'List report versions',
    description: 'Metadata only, newest first — omits the section payloads.',
  })
  @ApiParam({ name: 'projectId', description: 'Project UUID', type: String })
  @ApiResponse({ status: 200, description: 'Versions listed.' })
  async listVersions(@CurrentUser() user: User, @Param('projectId', ParseUUIDPipe) projectId: string) {
    const versions = await this.researchService.listReportVersions(user.id, projectId);

    return {
      data: versions,
      message: 'Report versions retrieved.',
      success: true,
    };
  }

  @Get(':version')
  @ApiOperation({ summary: 'Get one report version' })
  @ApiParam({ name: 'projectId', description: 'Project UUID', type: String })
  @ApiParam({ name: 'version', description: '1-based version number', type: Number })
  @ApiResponse({ status: 200, description: 'Report version retrieved.' })
  @ApiResponse({ status: 404, description: 'That version does not exist.' })
  async getVersion(
    @CurrentUser() user: User,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('version', ParseIntPipe) version: number,
  ) {
    const report = await this.researchService.getReportVersion(user.id, projectId, version);

    return {
      data: report,
      message: 'Research report retrieved.',
      success: true,
    };
  }

  @Post(':version/approve')
  @ApiOperation({
    summary: 'Approve a report version',
    description:
      'Marks this version as the approved one. Any previously approved version is demoted to ' +
      'DRAFT but keeps its content.',
  })
  @ApiParam({ name: 'projectId', description: 'Project UUID', type: String })
  @ApiParam({ name: 'version', description: '1-based version number', type: Number })
  @ApiResponse({ status: 201, description: 'Report approved.' })
  @ApiResponse({ status: 404, description: 'That version does not exist.' })
  @ApiResponse({ status: 409, description: 'Report is pending or failed.' })
  async approve(
    @CurrentUser() user: User,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('version', ParseIntPipe) version: number,
  ) {
    const report = await this.researchService.approveReport(user.id, projectId, version);

    return {
      data: { id: report.id, version: report.version, status: report.status },
      message: 'Research report approved.',
      success: true,
    };
  }

  @Post(':version/cancel')
  @ApiOperation({
    summary: 'Cancel a report that is still generating',
    description:
      'Removes the queued job if it has not started. If generation is already running the result ' +
      'is discarded when it arrives, since an in-flight provider call cannot be recalled. Either ' +
      'way a new report can be requested immediately.',
  })
  @ApiParam({ name: 'projectId', description: 'Project UUID', type: String })
  @ApiParam({ name: 'version', description: '1-based version number', type: Number })
  @ApiResponse({ status: 201, description: 'Report cancelled.' })
  @ApiResponse({ status: 404, description: 'That version does not exist.' })
  @ApiResponse({ status: 409, description: 'That report is not generating.' })
  async cancel(
    @CurrentUser() user: User,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('version', ParseIntPipe) version: number,
  ) {
    const report = await this.researchService.cancelReport(user.id, projectId, version);

    return {
      data: { id: report.id, version: report.version, status: report.status },
      message: 'Research report cancelled.',
      success: true,
    };
  }

  @Post(':version/reject')
  @ApiOperation({
    summary: 'Reject a report version',
    description:
      'Marks this version as rejected. The version stays readable — the history is the record of ' +
      'what was produced and what was caught. An optional reason is fed into the next ' +
      'generation as stated feedback.',
  })
  @ApiParam({ name: 'projectId', description: 'Project UUID', type: String })
  @ApiParam({ name: 'version', description: '1-based version number', type: Number })
  @ApiResponse({ status: 201, description: 'Report rejected.' })
  @ApiResponse({ status: 404, description: 'That version does not exist.' })
  @ApiResponse({ status: 409, description: 'Report is still generating, or failed.' })
  async reject(
    @CurrentUser() user: User,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('version', ParseIntPipe) version: number,
    @Body() dto: RejectReportDto,
  ) {
    const report = await this.researchService.rejectReport(user.id, projectId, version, dto.reason);

    return {
      data: { id: report.id, version: report.version, status: report.status },
      message: 'Research report rejected.',
      success: true,
    };
  }
}
