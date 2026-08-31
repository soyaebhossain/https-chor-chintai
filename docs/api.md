# API contract (v1)

| Method | Route | Purpose | Access |
|---|---|---|---|
| POST | `/v1/search` | Exact identifier lookup | Public, rate-limited |
| POST | `/v1/uploads/presign` | Quarantine upload URL | Authenticated |
| POST | `/v1/claims` | Create claim | Authenticated |
| GET | `/v1/claims/me` | User claim list | Authenticated |
| GET | `/v1/claims/:id` | Claim detail | Owner/reviewer |
| POST | `/v1/claims/:id/submit` | Submit for review | Owner |
| GET | `/v1/admin/review-queue` | Moderation queue | Reviewer |
| POST | `/v1/admin/claims/:id/decision` | Approve/reject/request info | Reviewer |
| POST | `/v1/recoveries` | Report recovered product | Owner/reviewer |
| POST | `/v1/disputes` | Challenge a public report | Authenticated |

All mutations accept an idempotency key. Errors use RFC 9457 Problem Details. Responses never expose full identifiers or evidence URLs.
