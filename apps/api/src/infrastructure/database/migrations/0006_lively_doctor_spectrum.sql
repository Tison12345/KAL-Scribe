CREATE TABLE "consultation_recording_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recording_id" uuid NOT NULL,
	"sequence" integer NOT NULL,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "consultation_recording_chunks" ADD CONSTRAINT "consultation_recording_chunks_recording_id_consultation_recordings_id_fk" FOREIGN KEY ("recording_id") REFERENCES "public"."consultation_recordings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "consultation_recording_chunks_recording_sequence_idx" ON "consultation_recording_chunks" USING btree ("recording_id","sequence");