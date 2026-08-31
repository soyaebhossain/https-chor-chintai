import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  displayName: text("display_name"),
  role: text("role", { enum: ["USER", "REVIEWER", "ADMIN"] }).notNull().default("USER"),
  countryCode: text("country_code").notNull().default("BD"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const products = sqliteTable("products", {
  id: text("id").primaryKey(), ownerId: text("owner_id").notNull(),
  category: text("category").notNull(), brand: text("brand").notNull(), model: text("model").notNull(),
  status: text("status", { enum: ["DRAFT", "UNDER_REVIEW", "REPORTED", "RECOVERED", "REJECTED"] }).notNull().default("DRAFT"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const identifiers = sqliteTable("product_identifiers", {
  id: text("id").primaryKey(), productId: text("product_id").notNull(), type: text("type").notNull(),
  valueHmac: text("value_hmac").notNull(), valueEncrypted: text("value_encrypted").notNull(), lastFour: text("last_four").notNull(),
}, table => ({ identifierHmacIdx: uniqueIndex("identifier_hmac_idx").on(table.type, table.valueHmac) }));

export const claims = sqliteTable("claims", {
  id: text("id").primaryKey(), productId: text("product_id").notNull(), reporterId: text("reporter_id").notNull(),
  incidentAt: integer("incident_at", { mode: "timestamp" }).notNull(), location: text("location").notNull(),
  policeReference: text("police_reference"), description: text("description").notNull(),
  reviewStatus: text("review_status", { enum: ["PENDING", "APPROVED", "REJECTED", "NEEDS_INFO"] }).notNull().default("PENDING"),
  riskScore: integer("risk_score").notNull().default(0), createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const claimDocuments = sqliteTable("claim_documents", {
  id: text("id").primaryKey(), claimId: text("claim_id").notNull(), storageKey: text("storage_key").notNull(),
  mimeType: text("mime_type").notNull(), scanStatus: text("scan_status").notNull().default("PENDING"), ocrStatus: text("ocr_status").notNull().default("PENDING"),
});

export const auditLogs = sqliteTable("audit_logs", {
  id: text("id").primaryKey(), actorId: text("actor_id"), action: text("action").notNull(), entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(), metadata: text("metadata", { mode: "json" }), createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});
