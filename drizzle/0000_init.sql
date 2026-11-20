CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor" text NOT NULL,
	"action" text NOT NULL,
	"report_id" uuid,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_id" uuid NOT NULL,
	"file_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"size" integer NOT NULL,
	"data" "bytea" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reporters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tracking_id" text NOT NULL,
	"reporter_id" uuid NOT NULL,
	"category" text NOT NULL,
	"brand_model" text NOT NULL,
	"identifier_type" text NOT NULL,
	"identifier_hash" text NOT NULL,
	"identifier_encrypted" text NOT NULL,
	"identifier_last4" text NOT NULL,
	"incident_type" text NOT NULL,
	"incident_date" date NOT NULL,
	"location" text NOT NULL,
	"police_reference" text,
	"description" text NOT NULL,
	"phone_hash" text NOT NULL,
	"phone_encrypted" text NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"review_note" text,
	"reviewed_at" timestamp with time zone,
	"recovered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reports_tracking_id_unique" UNIQUE("tracking_id")
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_report_id_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_report_id_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_id_reporters_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."reporters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_logs_report_idx" ON "audit_logs" USING btree ("report_id");--> statement-breakpoint
CREATE INDEX "evidence_report_idx" ON "evidence" USING btree ("report_id");--> statement-breakpoint
CREATE INDEX "reports_identifier_hash_idx" ON "reports" USING btree ("identifier_hash","status");--> statement-breakpoint
CREATE INDEX "reports_reporter_idx" ON "reports" USING btree ("reporter_id","created_at");--> statement-breakpoint
CREATE INDEX "reports_status_idx" ON "reports" USING btree ("status","created_at");