import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsDateString, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { PersonDto } from '../common/people';
import { ConcernCategory, Role } from '../generated/prisma/enums';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const trimOrUndefined = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || undefined : value;

export class CreateFolderDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  patientId: string;

  @ApiProperty({ example: '2026-10-08', description: 'Date of the visit' })
  @IsDateString()
  visitDate: string;

  @ApiProperty()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  symptoms: string;

  @ApiProperty()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  diagnosis: string;

  @ApiPropertyOptional()
  @Transform(trimOrUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  prescription?: string;

  @ApiPropertyOptional()
  @Transform(trimOrUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  recommendations?: string;

  @ApiPropertyOptional({ description: "Doctors' notes; the patient doesn't see them" })
  @Transform(trimOrUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  medicalComments?: string;

  @ApiProperty({ enum: ConcernCategory })
  @IsEnum(ConcernCategory)
  concernCategory: ConcernCategory;
}

export class CreateCommentDto {
  @ApiProperty({ maxLength: 2000 })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  body: string;
}

export class FolderPatientDto extends PersonDto {
  @ApiProperty()
  email: string;
}

export class FolderDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  visitDate: Date;

  @ApiProperty()
  symptoms: string;

  @ApiProperty()
  diagnosis: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  prescription: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  recommendations: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, description: 'Always null for patients' })
  medicalComments: string | null;

  @ApiProperty({ enum: ConcernCategory })
  concernCategory: ConcernCategory;

  @ApiProperty({ type: PersonDto })
  doctor: PersonDto;

  @ApiProperty({ type: FolderPatientDto })
  patient: FolderPatientDto;

  @ApiProperty()
  commentCount: number;

  @ApiProperty()
  documentCount: number;

  @ApiProperty()
  createdAt: Date;
}

export class CommentAuthorDto extends PersonDto {
  @ApiProperty({ enum: Role })
  role: Role;
}

export class FolderCommentDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  body: string;

  @ApiProperty({ type: CommentAuthorDto })
  author: CommentAuthorDto;

  @ApiProperty({ description: 'Written by the signed-in user' })
  mine: boolean;

  @ApiProperty()
  createdAt: Date;
}

export class FolderDocumentDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'analiza.pdf' })
  fileName: string;

  @ApiProperty({ example: 'application/pdf' })
  mimeType: string;

  @ApiProperty({ description: 'Bytes' })
  size: number;

  @ApiProperty({ type: PersonDto })
  uploadedBy: PersonDto;

  @ApiProperty({ example: '/api/documents/0199…/file', description: 'Needs the bearer token' })
  url: string;

  @ApiProperty()
  createdAt: Date;
}
