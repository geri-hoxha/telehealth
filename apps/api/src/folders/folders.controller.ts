import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiCreatedResponse, ApiOkResponse, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUserId } from '../auth/current-user-id.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateCommentDto, CreateFolderDto, FolderCommentDto, FolderDocumentDto, FolderDto } from './folder.dto';
import { FoldersService, type UploadedDocument } from './folders.service';

const MAX_DOCUMENT_BYTES = 15 * 1024 * 1024;

@ApiTags('medical folders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class FoldersController {
  constructor(private readonly folders: FoldersService) {}

  /** Patients: their own folders. Doctors: pass `patientId`. */
  @Get('folders')
  @ApiQuery({ name: 'patientId', required: false })
  @ApiOkResponse({ type: FolderDto, isArray: true })
  list(@CurrentUserId() userId: string, @Query('patientId') patientId?: string): Promise<FolderDto[]> {
    return this.folders.list(userId, patientId);
  }

  /** Doctor: write a visit record for one of their patients. */
  @Post('folders')
  @ApiCreatedResponse({ type: FolderDto })
  create(@CurrentUserId() userId: string, @Body() dto: CreateFolderDto): Promise<FolderDto> {
    return this.folders.create(userId, dto);
  }

  @Get('folders/:id')
  @ApiOkResponse({ type: FolderDto })
  get(@CurrentUserId() userId: string, @Param('id', ParseUUIDPipe) id: string): Promise<FolderDto> {
    return this.folders.get(userId, id);
  }

  @Get('folders/:id/comments')
  @ApiOkResponse({ type: FolderCommentDto, isArray: true })
  comments(@CurrentUserId() userId: string, @Param('id', ParseUUIDPipe) id: string): Promise<FolderCommentDto[]> {
    return this.folders.comments(userId, id);
  }

  /** 403 SUBSCRIPTION_REQUIRED for a patient without an active subscription. */
  @Post('folders/:id/comments')
  @ApiCreatedResponse({ type: FolderCommentDto })
  addComment(
    @CurrentUserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateCommentDto,
  ): Promise<FolderCommentDto> {
    return this.folders.addComment(userId, id, dto);
  }

  @Get('folders/:id/documents')
  @ApiOkResponse({ type: FolderDocumentDto, isArray: true })
  documents(@CurrentUserId() userId: string, @Param('id', ParseUUIDPipe) id: string): Promise<FolderDocumentDto[]> {
    return this.folders.documents(userId, id);
  }

  /** Multipart upload of one `file` (photo, PDF, text or Office document, up to 15 MB). */
  @Post('folders/:id/documents')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_DOCUMENT_BYTES, files: 1 } }))
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @ApiCreatedResponse({ type: FolderDocumentDto })
  addDocument(
    @CurrentUserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: UploadedDocument | undefined,
  ): Promise<FolderDocumentDto> {
    return this.folders.addDocument(userId, id, file);
  }

  @Get('documents/:id/file')
  async documentFile(
    @CurrentUserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Res() response: Response,
  ): Promise<void> {
    const { path, document } = await this.folders.documentFile(userId, id);
    response.sendFile(
      path,
      {
        headers: {
          'content-type': document.mimeType,
          'content-disposition': `inline; filename*=UTF-8''${encodeURIComponent(document.fileName)}`,
        },
      },
      (error) => {
        if (error && !response.headersSent) response.status(404).end();
      },
    );
  }
}
