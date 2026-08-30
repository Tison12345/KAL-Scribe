// workers/clinical-ai-worker is a leaf app (deliberately not built with
// type declarations — architecture.md, docs/adr/0010: it gets deleted,
// not migrated, at CMS integration time, so it was never meant to be a
// typed library). The EMBEDDED_WORKER toggle (docs/adr/0018) only ever
// does a side-effect import of it — no named exports are used — so an
// ambient "the module exists" declaration is all that's needed here.
declare module '@kal-scribe/clinical-ai-worker';
