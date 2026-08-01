import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { User } from '@repo/db';
import {
  CreateTaskCommentResponse,
  DeleteTaskCommentResponse,
  GetTaskCommentsResponse,
  UpdateTaskCommentResponse,
} from '@repo/types';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { AuthGuard } from 'src/common/guards/auth.guard';
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';

@ApiTags('collaboration')
@ApiBearerAuth('JWT-auth')
@UseGuards(AuthGuard)
@Controller()
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Get('tasks/:id/comments')
  @ApiOperation({
    summary: 'List a task\'s comments',
    description: 'Oldest first. Includes the author byline and any resolved @mentions.',
  })
  @ApiParam({ name: 'id', description: 'Task UUID', type: String })
  @ApiResponse({ status: 200, description: 'Comments retrieved.' })
  @ApiResponse({ status: 404, description: 'Task not found or you are not a member.' })
  async getComments(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) taskId: string,
  ): Promise<GetTaskCommentsResponse> {
    return this.commentsService.getComments(user.id, taskId);
  }

  @Post('tasks/:id/comments')
  @ApiOperation({
    summary: 'Comment on a task',
    description:
      'Any member may comment. Mention someone with @their name to notify them; the project owner is notified of every comment.',
  })
  @ApiParam({ name: 'id', description: 'Task UUID', type: String })
  @ApiResponse({ status: 201, description: 'Comment added.' })
  @ApiResponse({ status: 400, description: 'Body is empty or too long.' })
  @ApiResponse({ status: 404, description: 'Task not found or you are not a member.' })
  async createComment(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) taskId: string,
    @Body() dto: CreateCommentDto,
  ): Promise<CreateTaskCommentResponse> {
    return this.commentsService.createComment(user.id, taskId, dto);
  }

  @Patch('comments/:id')
  @ApiOperation({
    summary: 'Edit your own comment',
    description: 'Author only. Editing does not re-notify mentioned members.',
  })
  @ApiParam({ name: 'id', description: 'Comment UUID', type: String })
  @ApiResponse({ status: 200, description: 'Comment updated.' })
  @ApiResponse({ status: 403, description: 'You can only edit your own comments.' })
  @ApiResponse({ status: 404, description: 'Comment not found.' })
  async updateComment(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) commentId: string,
    @Body() dto: UpdateCommentDto,
  ): Promise<UpdateTaskCommentResponse> {
    return this.commentsService.updateComment(user.id, commentId, dto);
  }

  @Delete('comments/:id')
  @ApiOperation({
    summary: 'Delete a comment',
    description: 'The author, or the project owner moderating.',
  })
  @ApiParam({ name: 'id', description: 'Comment UUID', type: String })
  @ApiResponse({ status: 200, description: 'Comment deleted.' })
  @ApiResponse({ status: 403, description: 'Not your comment, and you do not own the project.' })
  @ApiResponse({ status: 404, description: 'Comment not found.' })
  async deleteComment(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) commentId: string,
  ): Promise<DeleteTaskCommentResponse> {
    return this.commentsService.deleteComment(user.id, commentId);
  }
}
