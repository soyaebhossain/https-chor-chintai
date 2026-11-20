import {
  customType,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

export const userRole = pgEnum("user_role", ["USER", "REVIEWER", "ADMIN"]);
export const productStatus = pgEnum("product_status", [
  "DRAFT",
  "UNDER_REVIEW",
  "REPORTED",
  "DISPUTED",
  "RECOVERED",
  "REJECTED",
]);
export const identifierType = pgEnum("identifier_type", ["IMEI", "SERIAL", "VIN", "SERVICE_TAG"]);
export const incidentType = pgEnum("incident_type", ["THEFT", "ROBBERY", "LOST"]);
export const reviewStatus = pgEnum("review_status", ["PENDING", "APPROVED", "REJECTED", "NEEDS_INFO"]);
export const scanStatus = pgEnum("scan_status", ["PENDING", "CLEAN", "INFECTED", "FAILED"]);
export const ocrStatus = pgEnum("ocr_status", ["PENDING", "DONE", "FAILED", "SKIPPED"]);
export const disputeStatus = pgEnum("dispute_status", ["OPEN", "UNDER_REVIEW", "UPHELD", "DISMISSED"]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").unique(),
  phone: text("phone").unique(),
  displayName: text("display_name"),
  role: userRole("role").notNull().default("USER"),
  countryCode: text("country_code").notNull().default("BD"),
  /** AES-GCM encrypted base32 TOTP secret. Present but mfaEnabledAt null = enrollment in progress. */
  mfaSecretEncrypted: text("mfa_secret_encrypted"),
  mfaEnabledAt: timestamp("mfa_enabled_at", { withTimezone: true }),
  /** Last accepted TOTP time step, so a code cannot be replayed. */
  mfaLastStep: integer("mfa_last_step"),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/** Server-side sessions. Only the SHA-256 of the cookie token is stored. */
export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tokenHash: text("token_hash").notNull().unique(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    mfaVerifiedAt: timestamp("mfa_verified_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

/** One-time email login codes (hashed, 10 minute expiry, 5 attempts). */
export const loginCodes = pgTable(
  "login_codes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    codeHash: text("code_hash").notNull(),
    attempts: integer("attempts").notNull().default(0),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("login_codes_email_idx").on(t.email, t.createdAt)],
);

/** Fixed-window counters shared by every app instance. Keys never contain raw IPs or emails. */
export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull().defaultNow(),
  count: integer("count").notNull().default(0),
});

export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id").notNull().references(() => users.id, { onDelete: "restrict" }),
    category: text("category").notNull(),
    brand: text("brand").notNull(),
    model: text("model").notNull(),
    status: productStatus("status").notNull().default("DRAFT"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("products_owner_idx").on(t.ownerId), index("products_status_idx").on(t.status)],
);

/**
 * Raw identifiers are never stored in plaintext. `valueHmac` is the lookup key
 * (HMAC-SHA256 over `${type}:${normalized}`), `valueEncrypted` is AES-256-GCM
 * ciphertext readable only by reviewers, `lastFour` is what the public sees.
 */
export const identifiers = pgTable(
  "product_identifiers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
    type: identifierType("type").notNull(),
    valueHmac: text("value_hmac").notNull(),
    valueEncrypted: text("value_encrypted").notNull(),
    lastFour: text("last_four").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("identifier_hmac_idx").on(t.type, t.valueHmac),
    index("identifier_product_idx").on(t.productId),
  ],
);

export const claims = pgTable(
  "claims",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    trackingId: text("tracking_id").notNull().unique(),
    productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "restrict" }),
    reporterId: uuid("reporter_id").notNull().references(() => users.id, { onDelete: "restrict" }),
    incidentType: incidentType("incident_type").notNull(),
    incidentAt: timestamp("incident_at", { withTimezone: true }).notNull(),
    location: text("location").notNull(),
    policeReference: text("police_reference"),
    description: text("description").notNull(),
    reviewStatus: reviewStatus("review_status").notNull().default("PENDING"),
    /** Shown to the reporter: why it was rejected or what extra information is needed. */
    reviewNote: text("review_note"),
    /** When the reporter confirmed the report is true and accepted liability for false reports. */
    attestedAt: timestamp("attested_at", { withTimezone: true }).notNull(),
    reviewedBy: uuid("reviewed_by").references(() => users.id, { onDelete: "set null" }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    riskScore: integer("risk_score").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("claims_reporter_idx").on(t.reporterId),
    index("claims_product_idx").on(t.productId),
    index("claims_review_status_idx").on(t.reviewStatus),
  ],
);

export const claimDocuments = pgTable(
  "claim_documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    claimId: uuid("claim_id").notNull().references(() => claims.id, { onDelete: "cascade" }),
    /** Set when the file was attached to an appeal against the claim rather than to the claim itself. */
    disputeId: uuid("dispute_id").references(() => disputes.id, { onDelete: "cascade" }),
    uploadedBy: uuid("uploaded_by").references(() => users.id, { onDelete: "set null" }),
    storageKey: text("storage_key").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    sha256: text("sha256"),
    scanStatus: scanStatus("scan_status").notNull().default("PENDING"),
    ocrStatus: ocrStatus("ocr_status").notNull().default("PENDING"),
    createdAt: createdAt(),
  },
  (t) => [index("claim_documents_claim_idx").on(t.claimId), index("claim_documents_dispute_idx").on(t.disputeId)],
);

/** A challenge to a public report, e.g. a buyer who says the phone was sold, not stolen. */
export const disputes = pgTable(
  "disputes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    claimId: uuid("claim_id").notNull().references(() => claims.id, { onDelete: "cascade" }),
    raisedBy: uuid("raised_by").notNull().references(() => users.id, { onDelete: "restrict" }),
    reason: text("reason").notNull(),
    status: disputeStatus("status").notNull().default("OPEN"),
    resolvedBy: uuid("resolved_by").references(() => users.id, { onDelete: "set null" }),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    resolutionNote: text("resolution_note"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("disputes_claim_idx").on(t.claimId), index("disputes_status_idx").on(t.status), index("disputes_raised_by_idx").on(t.raisedBy)],
);

export const recoveries = pgTable(
  "recoveries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
    claimId: uuid("claim_id").references(() => claims.id, { onDelete: "set null" }),
    reportedBy: uuid("reported_by").notNull().references(() => users.id, { onDelete: "restrict" }),
    recoveredAt: timestamp("recovered_at", { withTimezone: true }).notNull(),
    note: text("note"),
    verifiedBy: uuid("verified_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [index("recoveries_product_idx").on(t.productId)],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    metadata: jsonb("metadata"),
    createdAt: createdAt(),
  },
  (t) => [
    index("audit_logs_entity_idx").on(t.entityType, t.entityId),
    index("audit_logs_actor_idx").on(t.actorId),
  ],
);

const bytea = customType<{ data: Buffer; driverData: Buffer }>({ dataType: () => "bytea" });

/**
 * Encrypted evidence files when no S3 bucket is configured. Holds only
 * AES-256-GCM ciphertext (same format as the bucket), keyed like an object key.
 */
export const evidenceObjects = pgTable("evidence_objects", {
  key: text("key").primaryKey(),
  data: bytea("data").notNull(),
  createdAt: createdAt(),
});
