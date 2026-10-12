import { HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { ApiException } from '../common/api-exception';
import { fullName, personInclude, toPersonDto } from '../common/people';
import { CareService } from '../care/care.service';
import { UploadsService } from '../files/uploads.service';
import type { FolderDocument, MedicalFolder } from '../generated/prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import type { UserWithProfile } from '../users/user.dto';
import { UsersService } from '../users/users.service';
import type {
  CreateCommentDto,
  CreateFolderDto,
  FolderCommentDto,
  FolderDocumentDto,
  FolderDto,
} from './folder.dto';

/** Files a folder may hold: photos, PDFs, plain text and Office documents. */
const ALLOWED_TYPES = /^(image\/(jpeg|png|heic|heif|webp|gif)|application\/pdf|text\/plain|application\/(msword|vnd\.openxmlformats-officedocument\.[\w.]+))$/;

const folderInclude = {
  doctor: { include: personInclude },
  patient: { include: personInclude },
  _count: { select: { comments: true, documents: true } },
} as const;

type FolderWithParties = MedicalFolder & {
  doctor: UserWithProfile;
  patient: UserWithProfile;
  _count: { comments: number; documents: number };
};

export interface UploadedDocument {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

/**
 * Medical folders: a patient's visit records written by doctors, with comments and documents.
 * Patients see their own; doctors see those of their patients (see CareService).
 */
@Injectable()
export class FoldersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly care: CareService,
    private readonly subscriptions: SubscriptionsService,
    private readonly notifications: NotificationsService,
    private readonly uploads: UploadsService,
  ) {}

  /** Patients get their own folders; doctors pass the patient. Newest visit first. */
  async list(userId: string, patientId?: string): Promise<FolderDto[]> {
    const user = await this.users.require(userId);
    if (user.role === 'DOCTOR') {
      if (!patientId) throw new ApiException(HttpStatus.BAD_REQUEST, 'PATIENT_REQUIRED', 'Pass patientId');
      await this.care.requirePatientOf(userId, patientId);
    }
    const folders = await this.prisma.medicalFolder.findMany({
      where: { patientId: user.role === 'DOCTOR' ? patientId : userId },
      include: folderInclude,
      orderBy: [{ visitDate: 'desc' }, { createdAt: 'desc' }],
    });
    return folders.map((folder) => toFolderDto(folder, user.role === 'DOCTOR'));
  }

  async get(userId: string, folderId: string): Promise<FolderDto> {
    const { folder, user } = await this.requireAccess(userId, folderId);
    return toFolderDto(folder, user.role === 'DOCTOR');
  }

  async create(doctorId: string, dto: CreateFolderDto): Promise<FolderDto> {
    const doctor = await this.users.requireRole(doctorId, 'DOCTOR');
    await this.care.requirePatientOf(doctorId, dto.patientId);
    const folder = await this.prisma.medicalFolder.create({
      data: {
        patientId: dto.patientId,
        doctorId,
        visitDate: new Date(dto.visitDate),
        symptoms: dto.symptoms,
        diagnosis: dto.diagnosis,
        prescription: dto.prescription ?? null,
        recommendations: dto.recommendations ?? null,
        medicalComments: dto.medicalComments ?? null,
        concernCategory: dto.concernCategory,
      },
      include: folderInclude,
    });
    await this.notifications.notify(dto.patientId, {
      type: 'FOLDER_CREATED',
      params: { doctor: fullName(doctor) },
      folderId: folder.id,
    });
    return toFolderDto(folder, true);
  }

  async comments(userId: string, folderId: string): Promise<FolderCommentDto[]> {
    await this.requireAccess(userId, folderId);
    const comments = await this.prisma.folderComment.findMany({
      where: { folderId },
      include: { author: { include: personInclude } },
      orderBy: { createdAt: 'asc' },
    });
    return comments.map((comment) => ({
      id: comment.id,
      body: comment.body,
      author: { ...toPersonDto(comment.author), role: comment.author.role },
      mine: comment.authorId === userId,
      createdAt: comment.createdAt,
    }));
  }

  /** Patients need an active subscription to comment. The other side is notified. */
  async addComment(userId: string, folderId: string, dto: CreateCommentDto): Promise<FolderCommentDto> {
    const { folder, user } = await this.requireAccess(userId, folderId);
    if (user.role === 'PATIENT') await this.subscriptions.requireActive(userId);
    const comment = await this.prisma.folderComment.create({
      data: { folderId, authorId: userId, body: dto.body },
      include: { author: { include: personInclude } },
    });
    await this.notifications.notify(user.role === 'PATIENT' ? folder.doctorId : folder.patientId, {
      type: 'FOLDER_COMMENT',
      params: { author: fullName(user) },
      folderId,
    });
    return {
      id: comment.id,
      body: comment.body,
      author: { ...toPersonDto(comment.author), role: comment.author.role },
      mine: true,
      createdAt: comment.createdAt,
    };
  }

  async documents(userId: string, folderId: string): Promise<FolderDocumentDto[]> {
    await this.requireAccess(userId, folderId);
    const documents = await this.prisma.folderDocument.findMany({
      where: { folderId },
      include: { uploadedBy: { include: personInclude } },
      orderBy: { createdAt: 'desc' },
    });
    return documents.map(toDocumentDto);
  }

  async addDocument(userId: string, folderId: string, file: UploadedDocument | undefined): Promise<FolderDocumentDto> {
    const { folder, user } = await this.requireAccess(userId, folderId);
    if (!file) throw new ApiException(HttpStatus.BAD_REQUEST, 'FILE_REQUIRED', 'Send the file as "file"');
    const mimeType = file.mimetype.toLowerCase();
    if (!ALLOWED_TYPES.test(mimeType)) {
      throw new ApiException(HttpStatus.BAD_REQUEST, 'UNSUPPORTED_FILE', `Files of type ${mimeType} aren't allowed`);
    }
    const fileName = utf8FileName(file.originalname).slice(0, 200) || 'document';
    const storageKey = await this.uploads.save('documents', file.buffer, fileName);
    const document = await this.prisma.folderDocument.create({
      data: { folderId, uploadedById: userId, fileName, mimeType, size: file.size, storageKey },
      include: { uploadedBy: { include: personInclude } },
    });
    await this.notifications.notify(user.role === 'PATIENT' ? folder.doctorId : folder.patientId, {
      type: 'FOLDER_DOCUMENT',
      params: { author: fullName(user), file: fileName },
      folderId,
    });
    return toDocumentDto(document);
  }

  /** Where a document is on disk, for someone allowed to see its folder. */
  async documentFile(userId: string, documentId: string): Promise<{ path: string; document: FolderDocument }> {
    const document = await this.prisma.folderDocument.findUnique({ where: { id: documentId } });
    if (!document) throw new NotFoundException('Document not found');
    await this.requireAccess(userId, document.folderId);
    const path = this.uploads.path('documents', document.storageKey);
    if (!path) throw new NotFoundException('Document not found');
    return { path, document };
  }

  private async requireAccess(
    userId: string,
    folderId: string,
  ): Promise<{ folder: FolderWithParties; user: UserWithProfile }> {
    const [user, folder] = await Promise.all([
      this.users.require(userId),
      this.prisma.medicalFolder.findUnique({ where: { id: folderId }, include: folderInclude }),
    ]);
    const allowed =
      folder &&
      (user.role === 'PATIENT'
        ? folder.patientId === userId
        : folder.doctorId === userId || (await this.care.isPatientOf(userId, folder.patientId)));
    if (!folder || !allowed) throw new NotFoundException('Folder not found');
    return { folder, user };
  }
}

/** Multer decodes multipart file names as Latin-1, which garbles "ë" and Cyrillic. */
function utf8FileName(name: string): string {
  const decoded = Buffer.from(name, 'latin1').toString('utf8');
  return decoded.includes('\uFFFD') ? name : decoded;
}

function toFolderDto(folder: FolderWithParties, forDoctor: boolean): FolderDto {
  return {
    id: folder.id,
    visitDate: folder.visitDate,
    symptoms: folder.symptoms,
    diagnosis: folder.diagnosis,
    prescription: folder.prescription,
    recommendations: folder.recommendations,
    medicalComments: forDoctor ? folder.medicalComments : null,
    concernCategory: folder.concernCategory,
    doctor: toPersonDto(folder.doctor),
    patient: { ...toPersonDto(folder.patient), email: folder.patient.email },
    commentCount: folder._count.comments,
    documentCount: folder._count.documents,
    createdAt: folder.createdAt,
  };
}

function toDocumentDto(document: FolderDocument & { uploadedBy: UserWithProfile }): FolderDocumentDto {
  return {
    id: document.id,
    fileName: document.fileName,
    mimeType: document.mimeType,
    size: document.size,
    uploadedBy: toPersonDto(document.uploadedBy),
    url: `/api/documents/${document.id}/file`,
    createdAt: document.createdAt,
  };
}
