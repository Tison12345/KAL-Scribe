CREATE TABLE "consultation_transcripts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recording_id" uuid NOT NULL,
	"segments" jsonb NOT NULL,
	"stt_provider" text NOT NULL,
	"diarization_provider" text,
	"language_detected" text[],
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "consultation_transcripts" ADD CONSTRAINT "consultation_transcripts_recording_id_consultation_recordings_id_fk" FOREIGN KEY ("recording_id") REFERENCES "public"."consultation_recordings"("id") ON DELETE no action ON UPDATE no action;