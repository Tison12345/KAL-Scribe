export interface CreateUploadTargetParams {
  storageKey: string;
}

export type UploadTargetMethod = 'PUT';

export interface UploadTarget {
  uploadUrl: string;
  method: UploadTargetMethod;
  expiresAt: string;
}

export interface CreateReadUrlParams {
  storageKey: string;
}

export interface ReadTarget {
  readUrl: string;
  expiresAt: string;
}

/**
 * Thrown by `createReadUrl` when the requested object doesn't exist —
 * vendor-agnostic, so callers (e.g. `RequestChunkReadUseCase`) can
 * translate it into a 404 without knowing which storage vendor is
 * behind the interface. Distinct from any other failure (auth,
 * network, bucket misconfigured), which should still surface as a
 * genuine 500 — workers/clinical-ai-worker's chunk-fetch loop
 * specifically relies on a 404 (not any other error) to mean "no more
 * chunks, stop" (internal-api-client.ts's `fetchChunkAudio`).
 */
export class StorageObjectNotFoundError extends Error {
  constructor(storageKey: string) {
    super(`Storage object not found: "${storageKey}".`);
    this.name = 'StorageObjectNotFoundError';
  }
}

/**
 * The one seam this repo's storage concern is built around
 * (architecture.md §14, §20 principle 3). Every caller — use-cases,
 * controllers — depends on this interface, never on a concrete
 * vendor SDK. Swapping the local-disk stand-in for real Supabase
 * Storage later means writing one new class and changing one DI
 * registration, nothing else.
 */
export interface StorageAdapter {
  createUploadTarget(params: CreateUploadTargetParams): Promise<UploadTarget>;
  createReadUrl(params: CreateReadUrlParams): Promise<ReadTarget>;
}

export const STORAGE_ADAPTER = Symbol('STORAGE_ADAPTER');
