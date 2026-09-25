import { Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUserId } from '../auth/current-user-id.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CallTokenDto } from './call-token.dto';
import { CallsService } from './calls.service';

@ApiTags('calls')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('calls')
export class CallsController {
  constructor(private readonly calls: CallsService) {}

  @Post('token')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: CallTokenDto })
  token(@CurrentUserId() userId: string): Promise<CallTokenDto> {
    return this.calls.createToken(userId);
  }
}
