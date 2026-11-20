# API and server actions (v1)

Public JSON API:

| Method | Route | Purpose | Access |
|---|---|---|---|
| POST | `/api/v1/search` | Exact identifier lookup `{ "query": string }` | Public, 10/min and 200/day per IP |

Everything else is a Next.js server action or route handler behind a session. Mutations are protected by Next.js's built-in Origin check for server actions and by SameSite=Lax session cookies.

| Surface | Implementation | Access |
|---|---|---|
| Email code login / logout | `app/login/actions.ts`, `app/actions.ts` | Public, rate-limited per IP and email |
| TOTP enrol / verify | `app/account/mfa/actions.ts` | Logged in, 10 tries / 15 min |
| Submit report + evidence | `app/report/actions.ts` | Logged in, 5 / day |
| Answer "needs info" / mark recovered | `app/dashboard/actions.ts` | Claim owner |
| File an appeal | `app/dispute/actions.ts` | Logged in, 3 / day; not against own report |
| Appeal decision | `app/admin/actions.ts` (`decideDisputeAction`) | REVIEWER/ADMIN with MFA; not a party to it |
| Review decision | `app/admin/actions.ts` | REVIEWER/ADMIN with MFA verified in this session |
| Evidence download | `GET /admin/documents/:id` | REVIEWER/ADMIN with MFA; every view audited |

Not built yet: partner bulk-verification API (API keys).

Responses never expose full identifiers to the public. Search returns only status, category, brand/model, identifier type, last four characters, incident type, date and location.
