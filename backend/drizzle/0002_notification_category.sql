CREATE TYPE "public"."notification_category" AS ENUM('info', 'warning', 'emergency');
--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "category" "notification_category" NOT NULL DEFAULT 'info';
