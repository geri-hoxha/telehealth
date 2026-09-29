import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUserId } from '../auth/current-user-id.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CallDto, CallWithJoinDto, CreateCallDto, IncomingCallDto } from './call.dto';
import { CallsService } from './calls.service';

@ApiTags('calls')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('calls')
export class CallsController {
  constructor(private readonly calls: CallsService) {}

  /** Patient: call a doctor. Returns what the app needs to join the room while the doctor's phone rings. */
  @Post()
  @ApiCreatedResponse({ type: CallWithJoinDto })
  create(@CurrentUserId() userId: string, @Body() dto: CreateCallDto): Promise<CallWithJoinDto> {
    return this.calls.create(userId, dto.media);
  }

  /** Doctor: the call ringing for me right now, if any. */
  @Get('incoming')
  @ApiOkResponse({ type: IncomingCallDto })
  async incoming(@CurrentUserId() userId: string): Promise<IncomingCallDto> {
    return { call: await this.calls.incoming(userId) };
  }

  @Get(':id')
  @ApiOkResponse({ type: CallDto })
  get(@CurrentUserId() userId: string, @Param('id', ParseUUIDPipe) id: string): Promise<CallDto> {
    return this.calls.get(userId, id);
  }

  /** Doctor: answer. 409 if the call is no longer ringing. */
  @Post(':id/accept')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: CallWithJoinDto })
  accept(@CurrentUserId() userId: string, @Param('id', ParseUUIDPipe) id: string): Promise<CallWithJoinDto> {
    return this.calls.accept(userId, id);
  }

  /** Doctor: reject while ringing. */
  @Post(':id/decline')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: CallDto })
  decline(@CurrentUserId() userId: string, @Param('id', ParseUUIDPipe) id: string): Promise<CallDto> {
    return this.calls.decline(userId, id);
  }

  /** Patient: stop calling before the doctor answers. */
  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: CallDto })
  cancel(@CurrentUserId() userId: string, @Param('id', ParseUUIDPipe) id: string): Promise<CallDto> {
    return this.calls.cancel(userId, id);
  }

  /** Either side: hang up. Safe to repeat. */
  @Post(':id/end')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: CallDto })
  end(@CurrentUserId() userId: string, @Param('id', ParseUUIDPipe) id: string): Promise<CallDto> {
    return this.calls.end(userId, id);
  }
}
