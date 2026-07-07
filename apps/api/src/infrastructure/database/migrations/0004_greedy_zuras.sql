CREATE TYPE "public"."stt_device" AS ENUM('cpu', 'gpu');--> statement-breakpoint
ALTER TABLE "consultation_recordings" ADD COLUMN "stt_device" "stt_device";