# Architecture

The repository uses a modular-monolith path: one public/user web application, one protected moderation surface, one API boundary and one asynchronous worker. PostgreSQL remains authoritative; Redis is disposable queue/cache state; object storage holds quarantined evidence.

## Identifier lookup

1. Normalize by type (trim, uppercase, remove permitted separators).
2. Validate checksum/format when the identifier standard supports it.
3. Compute `HMAC-SHA-256(server_secret, type + ':' + normalized_value)`.
4. Query the unique indexed HMAC value.
5. Return only status, product category, jurisdiction, report date and last four characters.

Never log raw identifiers. Encrypt the recoverable value with a KMS-managed data key. A “not found” response is not proof of lawful ownership.

## Claim state machine

`DRAFT → UNDER_REVIEW → REPORTED → RECOVERED`

Moderators may also move a claim to `NEEDS_INFO`, `REJECTED` or `DISPUTED`. Publication requires human approval. Every transition writes an immutable audit event.

## Upload pipeline

Browser → presigned quarantine upload → MIME verification → malware scan → OCR → redaction → risk scoring → human review → encrypted evidence bucket.

## Target repository split

- `app/`, `components/`: runnable Next/Vinext web experience
- `db/`: deployable D1/Drizzle MVP schema
- `services/api`: NestJS production API reference
- `services/worker`: BullMQ automation reference
- `docs/`: security and integration contracts
