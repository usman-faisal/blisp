import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { User } from '@repo/db';
import {
  AcceptInviteResponse,
  AcceptTargetedInviteResponse,
  CreateInviteResponse,
  DeclineInviteResponse,
  GetInvitePreviewResponse,
  GetPendingInvitesResponse,
  GetProjectInvitesResponse,
  GetProjectMembersResponse,
  RemoveMemberResponse,
  RevokeInviteResponse,
  SendUserInviteResponse,
} from '@repo/types';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { AuthGuard } from 'src/common/guards/auth.guard';
import { InvitesService } from './invites.service';
import { SendUserInviteDto } from './dto/send-user-invite.dto';

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

  @Post('projects/:id/invites/user')
  @ApiOperation({
    summary: 'Invite a specific person to a project',
    description:
      'Any member can invite. Identify the recipient by userId or email. The ' +
      'recipient gets an in-app notification carrying accept and decline; no ' +
      'code is minted, so this creates no shareable way into the project.',
  })
  @ApiParam({ name: 'id', description: 'Project UUID', type: String })
  @ApiResponse({ status: 201, description: 'Invitation sent.' })
  @ApiResponse({ status: 403, description: 'Project already has the maximum members.' })
  @ApiResponse({ status: 404, description: 'Project or recipient not found.' })
  @ApiResponse({ status: 409, description: 'Already a member, or already invited.' })
  async sendUserInvite(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) projectId: string,
    @Body() dto: SendUserInviteDto,
  ): Promise<SendUserInviteResponse> {
    return this.invitesService.sendUserInvite(user.id, projectId, dto);
  }

  @Get('projects/:id/invites')
  @ApiOperation({
    summary: 'List outgoing invitations for a project',
    description: 'Pending targeted invites, so the UI can show "awaiting reply".',
  })
  @ApiParam({ name: 'id', description: 'Project UUID', type: String })
  @ApiResponse({ status: 200, description: 'Invitations retrieved.' })
  async getProjectInvites(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) projectId: string,
  ): Promise<GetProjectInvitesResponse> {
    return this.invitesService.getProjectInvites(user.id, projectId);
  }

  // Declared before `invites/:code` so `pending` is matched as a literal rather
  // than treated as an invite code.
  @Get('invites/pending')
  @ApiOperation({
    summary: 'List invitations addressed to me',
    description: 'Pending and unexpired only. Expired invites simply stop appearing.',
  })
  @ApiResponse({ status: 200, description: 'Pending invitations retrieved.' })
  async getPendingInvites(@CurrentUser() user: User): Promise<GetPendingInvitesResponse> {
    return this.invitesService.getPendingInvites(user.id);
  }

  /**
   * Keyed on invite id, unlike the code flow's `invites/:code/accept`. Two
   * distinct paths rather than one overloaded route: a targeted invite has no
   * code, and disambiguating by whether the parameter parses as a UUID would let
   * an invalid id fall through to the wrong handler.
   */
  @Post('invites/:inviteId/accept-invite')
  @ApiOperation({
    summary: 'Accept an invitation addressed to me',
    description: 'Recipient only. Accepting twice is a no-op success.',
  })
  @ApiParam({ name: 'inviteId', description: 'Invite UUID', type: String })
  @ApiResponse({ status: 201, description: 'Joined the project.' })
  @ApiResponse({ status: 403, description: 'Project is full.' })
  @ApiResponse({ status: 404, description: 'Invitation not found, or not addressed to you.' })
  @ApiResponse({ status: 410, description: 'Invitation expired, declined or withdrawn.' })
  async acceptTargetedInvite(
    @CurrentUser() user: User,
    @Param('inviteId', ParseUUIDPipe) inviteId: string,
  ): Promise<AcceptTargetedInviteResponse> {
    return this.invitesService.acceptTargetedInvite(user.id, inviteId);
  }

  @Post('invites/:inviteId/decline')
  @ApiOperation({
    summary: 'Decline an invitation addressed to me',
    description: 'Recipient only. The sender is notified; nobody else is.',
  })
  @ApiParam({ name: 'inviteId', description: 'Invite UUID', type: String })
  @ApiResponse({ status: 201, description: 'Invitation declined.' })
  @ApiResponse({ status: 404, description: 'Invitation not found, or not addressed to you.' })
  @ApiResponse({ status: 409, description: 'Already accepted — leave the project instead.' })
  async declineInvite(
    @CurrentUser() user: User,
    @Param('inviteId', ParseUUIDPipe) inviteId: string,
  ): Promise<DeclineInviteResponse> {
    return this.invitesService.declineInvite(user.id, inviteId);
  }

  @Delete('invites/:inviteId')
  @ApiOperation({
    summary: 'Withdraw a pending invitation',
    description:
      'The sender or the project owner. Deletes the row, so the notification ' +
      'carrying its accept/decline buttons cascades away with it.',
  })
  @ApiParam({ name: 'inviteId', description: 'Invite UUID', type: String })
  @ApiResponse({ status: 200, description: 'Invitation withdrawn.' })
  @ApiResponse({ status: 403, description: 'Only the sender or the project owner.' })
  @ApiResponse({ status: 409, description: 'Already accepted — remove the member instead.' })
  async revokeInvite(
    @CurrentUser() user: User,
    @Param('inviteId', ParseUUIDPipe) inviteId: string,
  ): Promise<RevokeInviteResponse> {
    return this.invitesService.revokeInvite(user.id, inviteId);
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
