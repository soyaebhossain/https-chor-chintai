# Architecture

One Next.js application (App Router, server actions) and one PostgreSQL database. No separate API or worker service until load requires one.

```
browser ──server actions──▶ app/actions.ts ──▶ lib/reports.ts ──▶ Drizzle ──▶ PostgreSQL (or PGlite in dev/tests)
```

## Identifier lookup

1. Normalize (NFKC, uppercase, strip spaces/dashes/dots/slashes).
2. Detect the type: 15 digits = IMEI with Luhn check, 14/16 digits = IMEI without check digit / IMEISV, 17 chars without I/O/Q = VIN, otherwise serial.
3. `HMAC-SHA-256(IDENTIFIER_HMAC_SECRET, type:value)`; IMEIs are keyed on their first 14 digits.
4. Query the indexed hash, only for `APPROVED` reports.
5. Return category, model, area, date and the last four characters. Nothing else.

The raw identifier and the reporter's phone are stored AES-256-GCM encrypted and are decrypted only in the moderator console.

## Report states

```
PENDING ──approve──▶ APPROVED ──owner: recovered──▶ RECOVERED
   │  ▲                 │
   │  └──needs info─────┤ (NEEDS_INFO)
   └──reject──▶ REJECTED ◀── unpublish
```

Every transition writes an `audit_logs` row.

## Identity

- Reporters are anonymous: a signed `cc_reporter` cookie links the browser to its reports. Tracking ID + phone number re-links a report on a new device.
- Moderators sign in with `ADMIN_PASSWORD`; a signed, 8-hour `cc_admin` cookie (SameSite=Strict).

## Evidence

PDF/JPG/PNG/WEBP only, detected from file bytes; 5 files, 5MB each, 10MB total. Stored in the `evidence` table (bytea) and served only to signed-in moderators with `no-store` and a sandboxing CSP.

## When to grow

- Many moderators → per-person accounts with MFA (Auth.js / Supabase Auth) instead of one shared password.
- Several app instances → move `lib/rate-limit.ts` to Redis/Upstash.
- Large evidence volume → move files to S3/R2 with presigned URLs.
