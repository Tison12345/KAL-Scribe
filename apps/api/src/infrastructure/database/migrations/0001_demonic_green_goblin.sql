CREATE TYPE "public"."clinical_ai_job_status" AS ENUM('queued', 'active', 'completed', 'failed', 'dead_letter');--> statement-breakpoint
CREATE TYPE "public"."clinical_ai_job_type" AS ENUM('transcription', 'diarization', 'extraction');--> statement-breakpoint
CREATE TABLE "consultation_ai_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recording_id" uuid NOT NULL,
	"job_type" "clinical_ai_job_type" NOT NULL,
	"bullmq_job_id" text,
	"status" "clinical_ai_job_status" DEFAULT 'queued' NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"error_message" text,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "consultation_ai_jobs" ADD CONSTRAINT "consultation_ai_jobs_recording_id_consultation_recordings_id_fk" FOREIGN KEY ("recording_id") REFERENCES "public"."consultation_recordings"("id") ON DELETE no action ON UPDATE no action;