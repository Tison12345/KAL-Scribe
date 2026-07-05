CREATE TYPE "public"."consultation_recording_status" AS ENUM('recording', 'uploading', 'uploaded', 'processing_failed', 'processed');--> statement-breakpoint
CREATE TABLE "consultation_recordings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consultation_session_ref" text NOT NULL,
	"doctor_id_ref" text NOT NULL,
	"status" "consultation_recording_status" DEFAULT 'recording' NOT NULL,
	"storage_key" text,
	"duration_seconds" integer,
	"consent_confirmed" boolean DEFAULT false NOT NULL,
	"consent_confirmed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
