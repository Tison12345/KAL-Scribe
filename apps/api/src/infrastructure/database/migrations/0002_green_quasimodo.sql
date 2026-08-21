ALTER TABLE "consultation_transcripts" ADD COLUMN "input_tokens" integer;--> statement-breakpoint
ALTER TABLE "consultation_transcripts" ADD COLUMN "output_tokens" integer;--> statement-breakpoint
ALTER TABLE "consultation_transcripts" ADD COLUMN "total_tokens" integer;