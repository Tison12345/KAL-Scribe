import { Inject, Injectable } from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';
import type { ApiEnv } from '@kal-scribe/config';
import { API_ENV } from '../../../infrastructure/env/env.module';

// Not `SupabaseClient` from '@supabase/supabase-js' — its default
// generic instantiation doesn't structurally match what `createClient`
// itself infers (a known supabase-js typing quirk), which trips
// `@typescript-eslint/no-unsafe-assignment`. Inferring from
// `createClient`'s own return type sidesteps the mismatch entirely.
type SupabaseClient = ReturnType<typeof createClient>;
import type {
  CreateReadUrlParams,
  CreateUploadTargetParams,
  ReadTarget,
  StorageAdapter,
  UploadTarget,
} from './storage.adapter';
import { StorageObjectNotFoundError } from './storage.adapter';

const SIGNED_URL_EXPIRY_SECONDS = 15 * 60;

/**
 * Real Supabase Storage (docs/adr/0014 — supersedes docs/adr/0007's
 * local-disk stand-in). Implements the exact same `StorageAdapter`
 * contract `LocalDiskStorageAdapter` did, so no caller (use-cases,
 * controllers) changed. Uses the secret key (`sb_secret_...`) server-side
 * — signing upload/read URLs for arbitrary paths needs it, the
 * publishable key can't.
 *
 * `createSignedUploadUrl`'s response already embeds its one-time token
 * as a query param on `signedUrl` (confirmed against storage-js's own
 * implementation — `uploadToSignedUrl` just does a PUT to that URL with
 * the token appended), so the browser's existing bare
 * `fetch(uploadUrl, { method: 'PUT', body })` call
 * (`apps/web`'s `uploadChunkBytes`) works unchanged against a real
 * Supabase-issued URL — no JS SDK required client-side, no `UploadTarget`
 * shape change needed.
 */
@Injectable()
export class SupabaseStorageAdapter implements StorageAdapter {
  private readonly client: SupabaseClient;
  private readonly bucket: string;

  constructor(@Inject(API_ENV) env: ApiEnv) {
    this.client = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY);
    this.bucket = env.SUPABASE_STORAGE_BUCKET;
  }

  async createUploadTarget({
    storageKey,
  }: CreateUploadTargetParams): Promise<UploadTarget> {
    const { data, error } = await this.client.storage
      .from(this.bucket)
      .createSignedUploadUrl(storageKey);

    if (error || !data) {
      throw new Error(
        `Supabase createSignedUploadUrl failed: ${error?.message}`,
      );
    }

    return {
      uploadUrl: data.signedUrl,
      method: 'PUT',
      expiresAt: this.expiryIso(),
    };
  }

  async createReadUrl({
    storageKey,
  }: CreateReadUrlParams): Promise<ReadTarget> {
    const { data, error } = await this.client.storage
      .from(this.bucket)
      .createSignedUrl(storageKey, SIGNED_URL_EXPIRY_SECONDS);

    if (error || !data) {
      // Supabase wraps a missing object in an HTTP 400 envelope with
      // statusCode "404" inside it (confirmed directly against a real
      // bucket) — `error.status` alone would misreport this as a
      // generic 400.
      if (error && 'statusCode' in error && error.statusCode === '404') {
        throw new StorageObjectNotFoundError(storageKey);
      }
      throw new Error(`Supabase createSignedUrl failed: ${error?.message}`);
    }

    return {
      readUrl: data.signedUrl,
      expiresAt: this.expiryIso(),
    };
  }

  // Supabase doesn't return an expiry timestamp directly — this is
  // informational for the response DTO only; actual expiry is enforced
  // server-side by Supabase against SIGNED_URL_EXPIRY_SECONDS.
  private expiryIso(): string {
    return new Date(
      Date.now() + SIGNED_URL_EXPIRY_SECONDS * 1000,
    ).toISOString();
  }
}
