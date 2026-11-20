import { customType, date, index, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

const bytea = customType<{ data: Buffer; driverData: Buffer | Uint8Array }>({
  dataType: () => "bytea",
  fromDriver: (value) => Buffer.from(value),
});

export const categories = ["MOBILE", "LAPTOP", "MOTORBIKE", "CAR", "CAMERA", "OTHER"] as const;
export const incidentTypes = ["THEFT", "SNATCHING", "LOST"] as const;
export const reportStatuses = ["PENDING", "NEEDS_INFO", "APPROVED", "REJECTED", "RECOVERED"] as const;

export type Category = (typeof categories)[number];
export type IncidentType = (typeof incidentTypes)[number];
export type ReportStatus = (typeof reportStatuses)[number];

/** An anonymous browser identity. Reports are linked to it through a signed cookie. */
export const reporters = pgTable("reporters", {
  id: uuid("id").primaryKey().defaultRandom(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const reports = pgTable(
  "reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    trackingId: text("tracking_id").notNull().unique(),
    reporterId: uuid("reporter_id").notNull().references(() => reporters.id),
    category: text("category", { enum: categories }).notNull(),
    brandModel: text("brand_model").notNull(),
    identifierType: text("identifier_type", { enum: ["IMEI", "VIN", "SERIAL"] }).notNull(),
    identifierHash: text("identifier_hash").notNull(),
    identifierEncrypted: text("identifier_encrypted").notNull(),
    identifierLast4: text("identifier_last4").notNull(),
    incidentType: text("incident_type", { enum: incidentTypes }).notNull(),
    incidentDate: date("incident_date").notNull(),
    location: text("location").notNull(),
    policeReference: text("police_reference"),
    description: text("description").notNull(),
    phoneHash: text("phone_hash").notNull(),
    phoneEncrypted: text("phone_encrypted").notNull(),
    status: text("status", { enum: reportStatuses }).notNull().default("PENDING"),
    reviewNote: text("review_note"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    recoveredAt: timestamp("recovered_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("reports_identifier_hash_idx").on(t.identifierHash, t.status),
    index("reports_reporter_idx").on(t.reporterId, t.createdAt),
    index("reports_status_idx").on(t.status, t.createdAt),
  ],
);

export const evidence = pgTable(
  "evidence",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reportId: uuid("report_id").notNull().references(() => reports.id, { onDelete: "cascade" }),
    fileName: text("file_name").notNull(),
    mimeType: text("mime_type").notNull(),
    size: integer("size").notNull(),
    data: bytea("data").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("evidence_report_idx").on(t.reportId)],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actor: text("actor").notNull(),
    action: text("action").notNull(),
    reportId: uuid("report_id").references(() => reports.id, { onDelete: "set null" }),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audit_logs_report_idx").on(t.reportId)],
);
