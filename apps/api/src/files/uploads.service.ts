import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { rm, writeFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type UploadKind = 'avatars' | 'documents';

/** Stored file names: a UUID and a short extension, so a name from a URL can't escape the folder. */
const STORED_NAME = /^[0-9a-f-]{36}(\.[a-z0-9]{1,8})?$/;

/**
 * Uploaded files on the API's disk (UPLOADS_DIR, ./uploads by default). Fine for the demo;
 * production would use object storage in Albania.
 */
@Injectable()
export class UploadsService {
  private readonly root: string;

  constructor(config: ConfigService) {
    this.root = resolve(config.get<string>('UPLOADS_DIR') ?? 'uploads');
    for (const kind of ['avatars', 'documents'] satisfies UploadKind[]) {
      mkdirSync(join(this.root, kind), { recursive: true });
    }
  }

  /** Saves a file under a new random name and returns that name. */
  async save(kind: UploadKind, data: Buffer, originalName: string): Promise<string> {
    const extension = extname(originalName).toLowerCase();
    const name = randomUUID() + (/^\.[a-z0-9]{1,8}$/.test(extension) ? extension : '');
    await writeFile(join(this.root, kind, name), data);
    return name;
  }

  /** The absolute path of a stored file, or null for a name that can't be one of ours. */
  path(kind: UploadKind, name: string): string | null {
    return STORED_NAME.test(name) ? join(this.root, kind, name) : null;
  }

  async remove(kind: UploadKind, name: string): Promise<void> {
    const path = this.path(kind, name);
    if (path) await rm(path, { force: true });
  }
}
