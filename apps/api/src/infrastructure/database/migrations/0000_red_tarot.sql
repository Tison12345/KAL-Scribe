CREATE TYPE "public"."clinical_ai_job_status" AS ENUM('queued', 'active', 'completed', 'failed', 'dead_letter');--> statement-breakpoint
CREATE TYPE "public"."clinical_ai_job_type" AS ENUM('transcription', 'diarization', 'extraction');--> statement-breakpoint
CREATE TYPE "public"."consultation_ai_session_status" AS ENUM('active', 'completed', 'abandoned');--> statement-breakpoint
CREATE TYPE "public"."consultation_recording_status" AS ENUM('recording', 'uploading', 'uploaded', 'processing_failed', 'processed');--> statement-breakpoint
CREATE TYPE "public"."stt_device" AS ENUM('cpu', 'gpu');--> statement-breakpoint
CREATE TYPE "public"."consultation_review_status" AS ENUM('draft', 'edited', 'accepted', 'discarded');--> statement-breakpoint
CREATE TABLE "consultation_ai_audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recording_id" uuid,
	"session_id" uuid,
	"event_type" text NOT NULL,
	"actor_ref" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "consultation_ai_audit_log_recording_or_session_check" CHECK ("consultation_ai_audit_log"."recording_id" is not null or "consultation_ai_audit_log"."session_id" is not null)
);
--> statement-breakpoint
CREATE TABLE "consultation_ai_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recording_id" uuid NOT NULL,
	"job_type" "clinical_ai_job_type" NOT NULL,
	"queue_job_id" text,
	"status" "clinical_ai_job_status" DEFAULT 'queued' NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"error_message" text,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consultation_ai_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recording_id" uuid NOT NULL,
	"transcript_id" uuid NOT NULL,
	"run_number" integer NOT NULL,
	"schema_version" text NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"prompt_version" text NOT NULL,
	"temperature" numeric(3, 2),
	"latency_ms" integer,
	"input_tokens" integer,
	"output_tokens" integer,
	"total_tokens" integer,
	"estimated_cost_usd" numeric(10, 6),
	"retry_count" integer DEFAULT 0 NOT NULL,
	"had_validation_retry" boolean DEFAULT false NOT NULL,
	"raw_response" jsonb NOT NULL,
	"extraction" jsonb NOT NULL,
	"confidence_overall" numeric(4, 3),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consultation_ai_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consultation_session_ref" text NOT NULL,
	"doctor_id_ref" text NOT NULL,
	"status" "consultation_ai_session_status" DEFAULT 'active' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consultation_recordings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"sequence_in_session" integer DEFAULT 0 NOT NULL,
	"status" "consultation_recording_status" DEFAULT 'recording' NOT NULL,
	"storage_key" text,
	"duration_seconds" integer,
	"sample_rate_hz" integer,
	"channels" integer,
	"codec" text,
	"file_size_bytes" bigint,
	"consent_confirmed" boolean DEFAULT false NOT NULL,
	"consent_confirmed_at" timestamp with time zone,
	"stt_device" "stt_device",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "consultation_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recording_id" uuid NOT NULL,
	"run_id" uuid NOT NULL,
	"status" "consultation_review_status" DEFAULT 'draft' NOT NULL,
	"edited_extraction" jsonb,
	"accepted_cms_prescription_ref" text,
	"reviewed_by_ref" text,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consultation_transcripts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recording_id" uuid NOT NULL,
	"segments" jsonb NOT NULL,
	"stt_provider" text NOT NULL,
	"diarization_provider" text,
	"language_detected" text[],
	"is_multilingual" boolean,
	"is_code_switched" boolean,
	"raw_response" jsonb,
	"transcription_latency_ms" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "consultation_ai_audit_log" ADD CONSTRAINT "consultation_ai_audit_log_recording_id_consultation_recordings_id_fk" FOREIGN KEY ("recording_id") REFERENCES "public"."consultation_recordings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultation_ai_audit_log" ADD CONSTRAINT "consultation_ai_audit_log_session_id_consultation_ai_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."consultation_ai_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultation_ai_jobs" ADD CONSTRAINT "consultation_ai_jobs_recording_id_consultation_recordings_id_fk" FOREIGN KEY ("recording_id") REFERENCES "public"."consultation_recordings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultation_ai_runs" ADD CONSTRAINT "consultation_ai_runs_recording_id_consultation_recordings_id_fk" FOREIGN KEY ("recording_id") REFERENCES "public"."consultation_recordings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultation_ai_runs" ADD CONSTRAINT "consultation_ai_runs_transcript_id_consultation_transcripts_id_fk" FOREIGN KEY ("transcript_id") REFERENCES "public"."consultation_transcripts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultation_recordings" ADD CONSTRAINT "consultation_recordings_session_id_consultation_ai_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."consultation_ai_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultation_reviews" ADD CONSTRAINT "consultation_reviews_recording_id_consultation_recordings_id_fk" FOREIGN KEY ("recording_id") REFERENCES "public"."consultation_recordings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultation_reviews" ADD CONSTRAINT "consultation_reviews_run_id_consultation_ai_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."consultation_ai_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultation_transcripts" ADD CONSTRAINT "consultation_transcripts_recording_id_consultation_recordings_id_fk" FOREIGN KEY ("recording_id") REFERENCES "public"."consultation_recordings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "consultation_ai_runs_recording_id_run_number_idx" ON "consultation_ai_runs" USING btree ("recording_id","run_number");