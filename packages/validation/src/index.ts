export {
  startRecordingSchema,
  requestChunkUploadSchema,
  completeUploadSchema,
} from "./consultation-recording.schema.js";

export { createTranscriptSchema } from "./consultation-transcript.schema.js";

export {
  clinicalExtractionSchema,
  createExtractionResultSchema,
  enqueueExtractionJobSchema,
  updateReviewDraftSchema,
  acceptReviewDraftSchema,
} from "./clinical-extraction.schema.js";
