import { Controller, Delete, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { User } from '@repo/db';
import {
  AcceptInviteResponse,
  CreateInviteResponse,
  GetInvitePreviewResponse,
  GetProjectMembersResponse,
  RemoveMemberResponse,
} from '@repo/types';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { AuthGuard } from 'src/common/guards/auth.guard';
import { InvitesService } from './invites.service';

@ApiTags('collaboration')
@ApiBearerAuth('JWT-auth')
@UseGuards(AuthGuard)
@Controller()
export class InvitesController {
  constructor(private readonly invitesService: InvitesService) {}

  @Post('projects/:id/invites')
  @ApiOperation({
    summary: 'Create an invite code for a project',
    description:
      'Any member can invite. Returns a short code valid for 7 days, plus a blisp:// deep link for sharing.',
  })
  @ApiParam({ name: 'id', description: 'Project UUID', type: String })
  @ApiResponse({ status: 201, description: 'Invite created.' })
  @ApiResponse({ status: 403, description: 'Project already has the maximum members.' })
  @ApiResponse({ status: 404, description: 'Project not found or you are not a member.' })
  async createInvite(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) projectId: string,
  ): Promise<CreateInviteResponse> {
    return this.invitesService.createInvite(user.id, projectId);
  }

  @Get('invites/:code')
  @ApiOperation({
    summary: 'Preview an invite before joining',
    description:
      'Shows the project title, member count and inviter so the user knows what they are accepting. Does not join.',
  })
  @ApiParam({ name: 'code', description: 'Invite code', type: String })
  @ApiResponse({ status: 200, description: 'Invite details.' })
  @ApiResponse({ status: 404, description: 'Invite code is not valid.' })
  @ApiResponse({ status: 410, description: 'Invite has expired or was already used.' })
  async getInvitePreview(
    @CurrentUser() user: User,
    @Param('code') code: string,
  ): Promise<GetInvitePreviewResponse> {
    return this.invitesService.getInvitePreview(user.id, code);
  }

  @Post('invites/:code/accept')
  @ApiOperation({
    summary: 'Join a project with an invite code',
    description:
      'Adds the current user as a MEMBER. Accepting an invite you already hold is a no-op success.',
  })
  @ApiParam({ name: 'code', description: 'Invite code', type: String })
  @ApiResponse({ status: 201, description: 'Joined the project.' })
  @ApiResponse({ status: 403, description: 'Project is full.' })
  @ApiResponse({ status: 404, description: 'Invite code is not valid.' })
  @ApiResponse({ status: 410, description: 'Invite has expired or was already used.' })
  async acceptInvite(
    @CurrentUser() user: User,
    @Param('code') code: string,
  ): Promise<AcceptInviteResponse> {
    return this.invitesService.acceptInvite(user.id, code);
  }

  @Get('projects/:id/members')
  @ApiOperation({
    summary: 'List a project\'s members',
    description: 'Owner first, then by join date. Flags the requesting user with isSelf.',
  })
  @ApiParam({ name: 'id', description: 'Project UUID', type: String })
  @ApiResponse({ status: 200, description: 'Members retrieved.' })
  @ApiResponse({ status: 404, description: 'Project not found or you are not a member.' })
  async getMembers(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) projectId: string,
  ): Promise<GetProjectMembersResponse> {
    return this.invitesService.getMembers(user.id, projectId);
  }

  @Delete('projects/:id/members/:userId')
  @ApiOperation({
    summary: 'Remove a member from a project',
    description: 'Owner only. The owner cannot remove themselves.',
  })
  @ApiParam({ name: 'id', description: 'Project UUID', type: String })
  @ApiParam({ name: 'userId', description: 'Clerk user id of the member to remove', type: String })
  @ApiResponse({ status: 200, description: 'Member removed.' })
  @ApiResponse({ status: 403, description: 'Only the owner can remove members.' })
  @ApiResponse({ status: 404, description: 'That user is not a member.' })
  async removeMember(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) projectId: string,
    @Param('userId') targetUserId: string,
  ): Promise<RemoveMemberResponse> {
    return this.invitesService.removeMember(user.id, projectId, targetUserId);
  }
}
