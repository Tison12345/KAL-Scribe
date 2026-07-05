CREATE TYPE "public"."consultation_ai_result_status" AS ENUM('draft', 'edited', 'accepted', 'discarded');--> statement-breakpoint
CREATE TABLE "consultation_ai_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recording_id" uuid NOT NULL,
	"transcript_id" uuid NOT NULL,
	"schema_version" text NOT NULL,
	"llm_provider" text NOT NULL,
	"extraction" jsonb NOT NULL,
	"status" "consultation_ai_result_status" DEFAULT 'draft' NOT NULL,
	"edited_extraction" jsonb,
	"accepted_cms_prescription_ref" text,
	"reviewed_by_ref" text,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "consultation_ai_results" ADD CONSTRAINT "consultation_ai_results_recording_id_consultation_recordings_id_fk" FOREIGN KEY ("recording_id") REFERENCES "public"."consultation_recordings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultation_ai_results" ADD CONSTRAINT "consultation_ai_results_transcript_id_consultation_transcripts_id_fk" FOREIGN KEY ("transcript_id") REFERENCES "public"."consultation_transcripts"("id") ON DELETE no action ON UPDATE no action;