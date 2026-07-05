import { createHmac, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { ApiEnv } from '@kal-scribe/config';
import { API_ENV } from '../../../infrastructure/env/env.module';
import type {
  CreateReadUrlParams,
  CreateUploadTargetParams,
  ReadTarget,
  StorageAdapter,
  UploadTarget,
} from './storage.adapter';

const SIGNED_URL_EXPIRY_SECONDS = 15 * 60;

type SignedOperation = 'upload' | 'read';

interface SignedTokenPayload {
  storageKey: string;
  operation: SignedOperation;
  exp: number;
}

/**
 * Local-disk stand-in for Supabase Storage (docs/adr/0007). Implements
 * the exact same `StorageAdapter` contract a real Supabase-backed
 * adapter will, using genuinely short-lived, HMAC-signed URLs, so the
 * later swap is one new class + one DI registration, not a redesign.
 *
 * The extra methods here (`verifyToken`, `read/writeObject`) exist only
 * because this implementation must also serve as its own tiny object
 * store over HTTP (see `LocalStorageController`) — a real Supabase
 * adapter wouldn't need them, since Supabase Storage serves the signed
 * URL itself.
 */
@Injectable()
export class LocalDiskStorageAdapter implements StorageAdapter {
  constructor(@Inject(API_ENV) private readonly env: ApiEnv) {}

  // Not `async` — this stand-in has nothing to await (no real network
  // call to a storage provider), but still returns a Promise since a
  // real Supabase-backed implementation genuinely will.
  createUploadTarget({
    storageKey,
  }: CreateUploadTargetParams): Promise<UploadTarget> {
    return Promise.resolve({
      uploadUrl: `/clinical-ai/storage/objects?token=${encodeURIComponent(this.sign(storageKey, 'upload'))}`,
      method: 'PUT',
      expiresAt: this.expiryIso(),
    });
  }

  createReadUrl({ storageKey }: CreateReadUrlParams): Promise<ReadTarget> {
    return Promise.resolve({
      readUrl: `/clinical-ai/storage/objects?token=${encodeURIComponent(this.sign(storageKey, 'read'))}`,
      expiresAt: this.expiryIso(),
    });
  }

  /** Verifies signature, operation, and expiry; returns the storage
   * key the token was signed for. */
  verifyToken(token: string, expectedOperation: SignedOperation): string {
    const [encoded, signature] = token.split('.');
    if (!encoded || !signature) {
      throw new BadRequestException('Malformed storage token.');
    }

    const expectedSignature = createHmac(
      'sha256',
      this.env.STORAGE_SIGNED_URL_SECRET,
    )
      .update(encoded)
      .digest('base64url');

    const provided = Buffer.from(signature);
    const expected = Buffer.from(expectedSignature);
    if (
      provided.length !== expected.length ||
      !timingSafeEqual(provided, expected)
    ) {
      throw new BadRequestException('Invalid storage token signature.');
    }

    const payload = JSON.parse(
      Buffer.from(encoded, 'base64url').toString('utf8'),
    ) as SignedTokenPayload;

    if (payload.operation !== expectedOperation) {
      throw new BadRequestException(
        `Storage token is not valid for "${expectedOperation}".`,
      );
    }
    if (payload.exp * 1000 < Date.now()) {
      throw new BadRequestException('Storage token has expired.');
    }

    return payload.storageKey;
  }

  async writeObject(storageKey: string, data: Buffer): Promise<void> {
    const filePath = this.resolvePath(storageKey);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, data);
  }

  async readObject(storageKey: string): Promise<Buffer> {
    try {
      return await readFile(this.resolvePath(storageKey));
    } catch {
      throw new NotFoundException(`No stored object for key "${storageKey}".`);
    }
  }

  /** Rejects any key that would escape STORAGE_LOCAL_DIR. */
  private resolvePath(storageKey: string): string {
    const normalized = path.normalize(storageKey);
    if (normalized.startsWith('..') || path.isAbsolute(normalized)) {
      throw new BadRequestException('Invalid storage key.');
    }
    return path.join(this.env.STORAGE_LOCAL_DIR, normalized);
  }

  private expiryIso(): string {
    return new Date(
      Date.now() + SIGNED_URL_EXPIRY_SECONDS * 1000,
    ).toISOString();
  }

  private sign(storageKey: string, operation: SignedOperation): string {
    const payload: SignedTokenPayload = {
      storageKey,
      operation,
      exp: Math.floor(Date.now() / 1000) + SIGNED_URL_EXPIRY_SECONDS,
    };
    const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString(
      'base64url',
    );
    const signature = createHmac('sha256', this.env.STORAGE_SIGNED_URL_SECRET)
      .update(encoded)
      .digest('base64url');
    return `${encoded}.${signature}`;
  }
}
