import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUserId } from '../auth/current-user-id.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  ActivateInsuranceDto,
  ClaimDto,
  RedeemPrepaidDto,
  SubscriptionDto,
  SubscriptionOverviewDto,
} from './subscription.dto';
import { SubscriptionsService } from './subscriptions.service';

@ApiTags('subscription')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class SubscriptionsController {
  constructor(private readonly subscriptions: SubscriptionsService) {}

  /** Patient: the active subscription (shown as the digital health card) and past ones. */
  @Get('subscription')
  @ApiOkResponse({ type: SubscriptionOverviewDto })
  overview(@CurrentUserId() userId: string): Promise<SubscriptionOverviewDto> {
    return this.subscriptions.overview(userId);
  }

  /** 404 POLICY_NOT_FOUND, 409 POLICY_EXPIRED / POLICY_IN_USE / POLICY_ALREADY_ACTIVE. */
  @Post('subscription/insurance')
  @ApiCreatedResponse({ type: SubscriptionDto })
  activateInsurance(@CurrentUserId() userId: string, @Body() dto: ActivateInsuranceDto): Promise<SubscriptionDto> {
    return this.subscriptions.activateInsurance(userId, dto);
  }

  /** 404 CODE_NOT_FOUND, 409 CODE_ALREADY_USED. */
  @Post('subscription/prepaid')
  @ApiCreatedResponse({ type: SubscriptionDto })
  redeemPrepaid(@CurrentUserId() userId: string, @Body() dto: RedeemPrepaidDto): Promise<SubscriptionDto> {
    return this.subscriptions.redeemPrepaid(userId, dto.code);
  }

  /** 409 DEMO_ALREADY_USED. */
  @Post('subscription/demo')
  @ApiCreatedResponse({ type: SubscriptionDto })
  requestDemo(@CurrentUserId() userId: string): Promise<SubscriptionDto> {
    return this.subscriptions.requestDemo(userId);
  }

  /** Patient: insurance claims and their status, newest first. */
  @Get('claims')
  @ApiOkResponse({ type: ClaimDto, isArray: true })
  claims(@CurrentUserId() userId: string): Promise<ClaimDto[]> {
    return this.subscriptions.claims(userId);
  }
}
