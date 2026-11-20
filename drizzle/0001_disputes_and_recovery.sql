ALTER TABLE "claim_documents" ADD COLUMN "dispute_id" uuid;--> statement-breakpoint
ALTER TABLE "claim_documents" ADD COLUMN "uploaded_by" uuid;--> statement-breakpoint
ALTER TABLE "claim_documents" ADD CONSTRAINT "claim_documents_dispute_id_disputes_id_fk" FOREIGN KEY ("dispute_id") REFERENCES "public"."disputes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claim_documents" ADD CONSTRAINT "claim_documents_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "claim_documents_dispute_idx" ON "claim_documents" USING btree ("dispute_id");--> statement-breakpoint
CREATE INDEX "disputes_raised_by_idx" ON "disputes" USING btree ("raised_by");