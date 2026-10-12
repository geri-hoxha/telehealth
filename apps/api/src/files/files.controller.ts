import { Controller, Get, NotFoundException, Param, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { UploadsService } from './uploads.service';

@ApiTags('files')
@Controller('files')
export class FilesController {
  constructor(private readonly uploads: UploadsService) {}

  /** Profile photos. Public: the names are random UUIDs that only the API hands out. */
  @Get('avatars/:name')
  avatar(@Param('name') name: string, @Res() response: Response): void {
    const path = this.uploads.path('avatars', name);
    if (!path) throw new NotFoundException();
    response.sendFile(path, { maxAge: '7d' }, (error) => {
      if (error && !response.headersSent) response.status(404).end();
    });
  }
}
