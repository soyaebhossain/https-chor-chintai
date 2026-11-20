# Architecture

The repository uses a modular-monolith path: one public/user web application, one protected moderation surface and its API route handlers, all in one Next.js app. PostgreSQL is authoritative; S3-compatible object storage holds quarantined evidence.

## Identifier lookup

1. Normalize by type (trim, uppercase, remove permitted separators).
2. Validate checksum/format when the identifier standard supports it.
3. Compute `HMAC-SHA-256(server_secret, type + ':' + normalized_value)`.
4. Query the unique indexed HMAC value.
5. Return only status, product category, jurisdiction, report date and last four characters.

The public search box has one input, so `planSearch` looks the value up under every type it could be (a valid 15-digit IMEI is checked as `IMEI` and `SERIAL`). A 15-digit number that fails Luhn is rejected as a typo. Only products in `REPORTED` (approved) or `DISPUTED` (under appeal) are visible; every other state answers exactly like "no record". Implemented in `lib/server/registry.ts`.

Never log raw identifiers. Encrypt the recoverable value with a KMS-managed data key. A “not found” response is not proof of lawful ownership.

## Claim state machine

`DRAFT → UNDER_REVIEW → REPORTED → RECOVERED`

Moderators may also move a claim to `NEEDS_INFO`, `REJECTED` or `DISPUTED`. Publication requires human approval. Every transition writes an immutable audit event.

## Upload pipeline

Implemented: browser → server action (≤5 files, ≤10 MB each) → magic-byte type check (PDF/JPEG/PNG only) → SHA-256 → AES-256-GCM encryption in the app → private S3 bucket → heuristic risk score → human review → decrypted only through the authenticated, audited `/admin/documents/:id` route.

Still to add: malware scan and OCR (status columns exist on `claim_documents`; the console warns while files are unscanned).

## Repository layout

One Next.js app (modular monolith). Background work moves to a separate worker only once scanning/OCR volume justifies it.

- `app/`: pages and the `/api/v1/*` route handlers
- `components/`: UI
- `lib/identifiers.ts`: normalization and format checks (client and server)
- `lib/server/`: env validation, HMAC/encryption and registry queries (server-only)
- `db/`: Drizzle PostgreSQL schema; `drizzle/` holds the committed migrations
- `lib/server/auth.ts`: DB sessions, `requireUser` / `requireStaff` (role + TOTP)
- `lib/server/claims.ts`: report submission, review decisions, read models
- `scripts/`: `set-role.ts` (grant reviewer/admin), `storage-init.ts` (create private bucket)
- `docs/`: security and integration contracts

`updated_at` is set by Drizzle on update. Raw SQL updates must set it themselves.
