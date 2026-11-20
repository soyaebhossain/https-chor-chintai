# চুরি-ছিন্তাই — Trusted Product Registry

চুরি/ছিনতাই হওয়া পণ্যের Serial, IMEI, VIN বা Service Tag রিপোর্ট ও যাচাইয়ের প্ল্যাটফর্ম। Next.js + PostgreSQL (Drizzle) + S3-সামঞ্জস্যপূর্ণ স্টোরেজ দিয়ে একটি modular monolith। কোনো ডেমো বা নমুনা ডেটা নেই—সবকিছু আসল ডেটাবেজ থেকে আসে।

## যা কাজ করে

| অংশ | বিবরণ |
|---|---|
| পাবলিক সার্চ | `POST /api/v1/search` — normalize (বাংলা অঙ্কসহ) → IMEI-তে Luhn, VIN-এ ১৭ অক্ষর → HMAC → DB lookup। শুধু অনুমোদিত (`REPORTED`) বা আপিলাধীন (`DISPUTED`) রিপোর্ট দেখা যায়। IP-ভিত্তিক রেট লিমিট (৩০/মিনিট, ১০০০/দিন — মোবাইল অপারেটরের শেয়ার্ড IP মাথায় রেখে)। |
| লগইন | ইমেইলে ৬ অঙ্কের এককালীন কোড (১০ মিনিট, ৫ বার চেষ্টা), ডেটাবেজে সেশন (`__Host-` httpOnly কুকি, শুধু hash সংরক্ষিত)। ইমেইল ও IP-ভিত্তিক রেট লিমিট। |
| রিপোর্ট ফর্ম | তিন ধাপের সহজ ফর্ম: পণ্যের ধরন বেছে নিলেই নম্বরের নাম ও কোথায় পাবেন তা দেখায়—IMEI/VIN/Serial নিজে বাছতে হয় না; ডুয়াল সিমের দ্বিতীয় IMEI; লগইন বাধ্যতামূলক; সার্ভারে zod যাচাই; প্রমাণ ফাইলের আসল ধরন (magic bytes) যাচাই, ১০MB/ফাইল, সর্বোচ্চ ৫টি; ফাইল **AES-256-GCM দিয়ে এনক্রিপ্ট করে** প্রাইভেট বাকেটে; আসল Tracking ID; একই নম্বরে অন্য কারও রিপোর্ট আটকানো। |
| ড্যাশবোর্ড | নিজের রিপোর্টের অবস্থা, পরের করণীয় ও যাচাইকারীর মন্তব্য; "আরও তথ্য প্রয়োজন" হলে উত্তর ও নতুন ফাইল; **"পণ্যটি ফেরত পেয়েছি"** চাপলে সঙ্গে সঙ্গে সতর্কতা সরে যায়; নিজের আপত্তির অবস্থা। |
| আপত্তি (`/dispute`) | ভুল রিপোর্টের বিরুদ্ধে প্রমাণসহ আপিল। জমা দিলেই পাবলিক ফলাফল বদলায় না; যাচাইকারী "পর্যালোচনাধীন" দেখাতে, রিপোর্ট সরাতে বা খারিজ করতে পারেন—কারণসহ উভয় পক্ষকে ইমেইল। আপত্তিকারীর পরিচয় রিপোর্টকারী জানেন না। |
| যাচাই কনসোল (`/admin`) | শুধু REVIEWER/ADMIN, এবং **TOTP দুই-ধাপ যাচাই বাধ্যতামূলক**। আসল সারি, পূর্ণ নম্বর ও প্রমাণ ফাইল দেখা, Approve / Reject / Needs info। নিজের রিপোর্ট নিজে অনুমোদন করা যায় না। প্রতিটি দেখা ও সিদ্ধান্ত `audit_logs`-এ। অন্যদের কাছে 404। |
| নোটিফিকেশন | রিপোর্ট জমা ও প্রতিটি সিদ্ধান্তে রিপোর্টকারীকে ইমেইল। |
| নিরাপত্তা | সিক্রেট/ইমেইল/স্টোরেজ সেটিং না থাকলে সার্ভার চালুই হয় না; CSP, HSTS, X-Frame-Options ইত্যাদি হেডার; প্রাইভেট পেজ noindex। |

## লোকালি চালানো

```bash
npm install
docker compose up -d                 # PostgreSQL + S3 (SeaweedFS)
cp .env.example .env                 # দুটো সিক্রেট তৈরি করে বসান (.env.example-এ কমান্ড আছে)
npm run db:migrate
npm run storage:init                 # প্রাইভেট evidence বাকেট তৈরি
npm run user:role -- you@example.com ADMIN   # নিজেকে অ্যাডমিন করুন
npm run dev
```

ডেভেলপমেন্টে SMTP না দিলে লগইন কোড সার্ভার লগে এবং `.dev-mail/<email>.txt` ফাইলে দেখা যাবে। প্রথম অ্যাডমিন লগইনে Authenticator অ্যাপ (Google/Microsoft Authenticator, 1Password) সেটআপ করতে বলা হবে।

## প্রোডাকশন চেকলিস্ট

- `IDENTIFIER_HMAC_SECRET` ও `FIELD_ENCRYPTION_KEY` secrets manager-এ রাখুন এবং আলাদাভাবে ব্যাকআপ নিন — হারালে সব IMEI অনুসন্ধান ও সব প্রমাণ ফাইল অপঠনযোগ্য হবে।
- `SMTP_URL` ও `MAIL_FROM` (যেমন Amazon SES, Postmark, Brevo)।
- S3 বাকেট (AWS S3 / Cloudflare R2 / Backblaze B2) — `npm run storage:init` চালিয়ে public access বন্ধ নিশ্চিত করুন।
- `CLIENT_IP_HEADER` আপনার রিভার্স প্রক্সির সাথে মিলিয়ে দিন (Cloudflare → `cf-connecting-ip`, nginx → `x-real-ip`)। প্রক্সি ছাড়া সরাসরি অ্যাপ খোলা রাখবেন না।
- `npm run db:migrate` প্রতিটি ডিপ্লয়ের আগে; `npm run user:role -- <email> ADMIN` দিয়ে প্রথম অ্যাডমিন।
- Cloudflare Turnstile widget বানিয়ে `NEXT_PUBLIC_TURNSTILE_SITE_KEY` ও `TURNSTILE_SECRET_KEY`, আর `NEXT_PUBLIC_CONTACT_EMAIL` দিন (প্রোডাকশনে বাধ্যতামূলক)।
- প্রতিদিন `npm run data:purge` ও `npm run db:backup` শিডিউল করুন; মাসে একবার `npm run db:restore-test` — বিস্তারিত [docs/operations.md](docs/operations.md)।

## স্ক্রিপ্ট

| কমান্ড | কাজ |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm test` | Vitest unit টেস্ট |
| `npm run test:e2e` | Playwright end-to-end (রিপোর্ট → MFA সহ অনুমোদন → সার্চ; Edge/Chrome লাগে, `docker compose up -d` চালু থাকতে হবে) |
| `npm run lint` / `typecheck` | ESLint / TypeScript |
| `npm run db:generate` / `db:migrate` | স্কিমা বদলের পর migration তৈরি / প্রয়োগ |
| `npm run user:role -- <email> <USER\|REVIEWER\|ADMIN>` | ভূমিকা দেওয়া/সরানো (আগের সেশন বাতিল হয়) |
| `npm run storage:init` | প্রাইভেট বাকেট তৈরি |
| `npm run db:backup` / `db:restore-test` | ব্যাকআপ নেওয়া / ব্যাকআপ আসলেই restore হয় কি না যাচাই (`-- --docker` দিলে docker-এর ভেতরে চলে) |
| `npm run data:purge` | গোপনীয়তা নীতির মেয়াদ অনুযায়ী পুরনো ডেটা মুছে ফেলা (`-- --dry-run` দিয়ে আগে দেখুন) |

## এখনো বাকি

- ফোন OTP (বাংলাদেশি SMS গেটওয়ে বেছে নিলে যোগ করা যাবে)।
- ম্যালওয়্যার স্ক্যান ও OCR (এখন ফাইলের ধরন যাচাই হয়, কিন্তু স্ক্যান হয় না — কনসোলে সতর্কতা দেখায়)।
- মনিটরিং (Sentry/uptime) ও ডিপ্লয় পাইপলাইন। CI (`.github/workflows/`) তৈরি — GitHub-এ push করলে চলবে।
- `/privacy`, `/terms`, `/takedown` পাতাগুলো খসড়া — আইনজ্ঞকে দিয়ে যাচাই করাতে হবে।

## গুরুত্বপূর্ণ

লঞ্চের আগে গোপনীয়তা, মানহানি, প্রমাণ সংরক্ষণ ও আইনশৃঙ্খলা বাহিনীর সাথে সহযোগিতা নিয়ে আইনি পরামর্শ নিন। কেন এভাবে বানানো (সুবিধা-অসুবিধা): [docs/product.md], নিরাপত্তা: [docs/security.md](docs/security.md), আর্কিটেকচার: [docs/architecture.md](docs/architecture.md), API: [docs/api.md](docs/api.md)।
