/** Kept local to apps/web (not packages/config) for now — only one
 * value is needed so far, and routing it through a workspace package
 * risks Next.js's NEXT_PUBLIC_* build-time inlining not applying to
 * pre-compiled dependency code. Revisit once apps/web needs enough env
 * vars that duplicating this pattern gets painful. */
export function getApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";
}
