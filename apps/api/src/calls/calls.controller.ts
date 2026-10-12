import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUserId } from '../auth/current-user-id.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PersonDto } from '../common/people';
import {
  CallDto,
  CallFeedbackDto,
  CallWithJoinDto,
  CreateCallDto,
  IncomingCallDto,
  InviteDoctorDto,
} from './call.dto';
import { CallsService } from './calls.service';

@ApiTags('calls')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('calls')
export class CallsController {
  constructor(private readonly calls: CallsService) {}

  /**
   * Patient: call a doctor. Returns what the app needs to join the room while the call waits in
   * the queue and doctors are rung. 403 SUBSCRIPTION_REQUIRED / PATIENT_BLOCKED,
   * 409 CALL_ALREADY_ACTIVE / NO_DOCTOR_AVAILABLE.
   */
  @Post()
  @ApiCreatedResponse({ type: CallWithJoinDto })
  create(@CurrentUserId() userId: string, @Body() dto: CreateCallDto): Promise<CallWithJoinDto> {
    return this.calls.create(userId, dto);
  }

  /** Call history, newest first; pass the last one's createdAt as `before` for more. */
  @Get()
  @ApiQuery({ name: 'before', required: false, type: String })
  @ApiOkResponse({ type: CallDto, isArray: true })
  history(@CurrentUserId() userId: string, @Query('before') before?: string): Promise<CallDto[]> {
    const date = before ? new Date(before) : undefined;
    return this.calls.history(userId, date && !Number.isNaN(date.getTime()) ? date : undefined);
  }

  /** Doctor: the call ringing for me right now, if any. */
  @Get('incoming')
  @ApiOkResponse({ type: IncomingCallDto })
  incoming(@CurrentUserId() userId: string): Promise<IncomingCallDto> {
    return this.calls.incoming(userId);
  }

  /** Doctor, during a call: free doctors to add, searched by name or specialty. */
  @Get('available-doctors')
  @ApiQuery({ name: 'q', required: false })
  @ApiOkResponse({ type: PersonDto, isArray: true })
  availableDoctors(@CurrentUserId() userId: string, @Query('q') query?: string): Promise<PersonDto[]> {
    return this.calls.availableDoctors(userId, query);
  }

  @Get(':id')
  @ApiOkResponse({ type: CallDto })
  get(@CurrentUserId() userId: string, @Param('id', ParseUUIDPipe) id: string): Promise<CallDto> {
    return this.calls.get(userId, id);
  }

  /** Doctor: answer the call, or an "Add doctor" invite. 409 if it is no longer ringing for me. */
  @Post(':id/accept')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: CallWithJoinDto })
  accept(@CurrentUserId() userId: string, @Param('id', ParseUUIDPipe) id: string): Promise<CallWithJoinDto> {
    return this.calls.accept(userId, id);
  }

  /** Doctor: reject while ringing; the call goes on to the next free doctor. */
  @Post(':id/decline')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: CallDto })
  decline(@CurrentUserId() userId: string, @Param('id', ParseUUIDPipe) id: string): Promise<CallDto> {
    return this.calls.decline(userId, id);
  }

  /** Anyone: hang up. Safe to repeat. */
  @Post(':id/end')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: CallDto })
  end(@CurrentUserId() userId: string, @Param('id', ParseUUIDPipe) id: string): Promise<CallDto> {
    return this.calls.end(userId, id);
  }

  /** Answering doctor: "Add doctor". 409 DOCTOR_BUSY when that doctor isn't free. */
  @Post(':id/invites')
  @ApiCreatedResponse({ type: CallDto })
  invite(
    @CurrentUserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: InviteDoctorDto,
  ): Promise<CallDto> {
    return this.calls.invite(userId, id, dto.doctorId);
  }

  /** Patient: rate a finished call. */
  @Post(':id/feedback')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: CallDto })
  feedback(
    @CurrentUserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CallFeedbackDto,
  ): Promise<CallDto> {
    return this.calls.feedback(userId, id, dto);
  }

  /** Doctor: "Free line" tells the patient they can call this doctor now. */
  @Post(':id/free-line')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  freeLine(@CurrentUserId() userId: string, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.calls.freeLine(userId, id);
  }
}
