import { Controller, Get, NotFoundException, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { localize, RequestLanguage } from '../common/language';
import type { Article, Benefit, Story } from '../generated/prisma/client';
import type { Language } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';

/** Shared look of content cards: an Ionicons name and a colour key from the app's palette. */
class ContentLookDto {
  @ApiProperty({ example: 'heart' })
  icon: string;

  @ApiProperty({ example: 'teal', description: 'teal, coral, indigo, amber, sky or violet' })
  color: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  imageUrl: string | null;
}

export class StoryDto extends ContentLookDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  body: string;

  @ApiProperty()
  publishedAt: Date;
}

export class BenefitDto extends ContentLookDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  subtitle: string;

  @ApiProperty()
  body: string;

  @ApiPropertyOptional({ type: String, nullable: true, description: 'A page with more about the offer' })
  url: string | null;
}

export class ArticleDto extends ContentLookDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  summary: string;

  @ApiProperty()
  body: string;

  @ApiProperty()
  readMinutes: number;

  @ApiProperty()
  publishedAt: Date;
}

/** The patient home screen's stories, "My benefits" and articles, in the request's language. */
@ApiTags('content')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class ContentController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('stories')
  @ApiOkResponse({ type: StoryDto, isArray: true })
  async stories(@RequestLanguage() language: Language): Promise<StoryDto[]> {
    const stories = await this.prisma.story.findMany({ orderBy: [{ position: 'asc' }, { publishedAt: 'desc' }] });
    return stories.map((story) => toStoryDto(story, language));
  }

  @Get('benefits')
  @ApiOkResponse({ type: BenefitDto, isArray: true })
  async benefits(@RequestLanguage() language: Language): Promise<BenefitDto[]> {
    const benefits = await this.prisma.benefit.findMany({ orderBy: { position: 'asc' } });
    return benefits.map((benefit) => toBenefitDto(benefit, language));
  }

  @Get('benefits/:id')
  @ApiOkResponse({ type: BenefitDto })
  async benefit(@Param('id', ParseUUIDPipe) id: string, @RequestLanguage() language: Language): Promise<BenefitDto> {
    const benefit = await this.prisma.benefit.findUnique({ where: { id } });
    if (!benefit) throw new NotFoundException('Benefit not found');
    return toBenefitDto(benefit, language);
  }

  @Get('articles')
  @ApiOkResponse({ type: ArticleDto, isArray: true })
  async articles(@RequestLanguage() language: Language): Promise<ArticleDto[]> {
    const articles = await this.prisma.article.findMany({ orderBy: { publishedAt: 'desc' }, take: 50 });
    return articles.map((article) => toArticleDto(article, language));
  }

  @Get('articles/:id')
  @ApiOkResponse({ type: ArticleDto })
  async article(@Param('id', ParseUUIDPipe) id: string, @RequestLanguage() language: Language): Promise<ArticleDto> {
    const article = await this.prisma.article.findUnique({ where: { id } });
    if (!article) throw new NotFoundException('Article not found');
    return toArticleDto(article, language);
  }
}

function toStoryDto(story: Story, language: Language): StoryDto {
  return {
    id: story.id,
    title: localize(story.title, language),
    body: localize(story.body, language),
    icon: story.icon,
    color: story.color,
    imageUrl: story.imageUrl,
    publishedAt: story.publishedAt,
  };
}

function toBenefitDto(benefit: Benefit, language: Language): BenefitDto {
  return {
    id: benefit.id,
    title: localize(benefit.title, language),
    subtitle: localize(benefit.subtitle, language),
    body: localize(benefit.body, language),
    icon: benefit.icon,
    color: benefit.color,
    imageUrl: benefit.imageUrl,
    url: benefit.url,
  };
}

function toArticleDto(article: Article, language: Language): ArticleDto {
  return {
    id: article.id,
    title: localize(article.title, language),
    summary: localize(article.summary, language),
    body: localize(article.body, language),
    icon: article.icon,
    color: article.color,
    imageUrl: article.imageUrl,
    readMinutes: article.readMinutes,
    publishedAt: article.publishedAt,
  };
}
