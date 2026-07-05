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
