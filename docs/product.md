# Product notes — who uses this and why it works the way it does

## The four people the registry serves

| Who | What they need | Where |
|---|---|---|
| **Buyer** of a second-hand phone/bike | One box, an answer in seconds, and what to do next | Home page search |
| **Owner** whose item was stolen | Report with as little effort as possible; remove the alert when the item is back | `/report`, `/dashboard` |
| **Accused person** (bought it legitimately, or the report is wrong) | A fair way to challenge the alert | "আপত্তি জানান" on the result → `/dispute` |
| **Reviewer** | Evidence from both sides, a clear decision, accountability | `/admin` (TOTP required) |

The fourth row matters as much as the first: a public "stolen" flag on someone's phone is a serious accusation. Every design choice below tries to balance *protecting buyers* against *not harming innocent people*.

## Decisions and trade-offs

**Owners never choose an "identifier type".** The form asks "what product?" and then labels the field in plain words ("IMEI নম্বর — *#06# ডায়াল করুন", "চেসিস নম্বর"). The type is inferred (`classifyForReport`). *Pro:* most owners do not know what IMEI/VIN mean; fewer wrong reports. *Con:* a 15-digit number on a phone is always treated as an IMEI — a Wi-Fi-only tablet with a 15-digit serial would be rejected by the checksum; rare, and the error tells the user what to check.

**Dual-SIM phones have two IMEIs.** The form takes a second number and both are searchable. *Pro:* a thief cannot dodge the check by showing the buyer the other IMEI. *Con:* one more field — it is optional and explained.

**A 15-digit search that fails the IMEI checksum** is still looked up as a serial; if nothing matches, the user is told the IMEI looks mistyped. *Pro:* catches typos without making 15-digit camera/laptop serials unsearchable. *Con:* one extra lookup.

**Filing an appeal does not change the public result.** A reviewer must first mark it "প্রাথমিকভাবে যুক্তিসঙ্গত" before the search shows "আপত্তি পর্যালোচনাধীন". *Pro:* a thief cannot neutralise every genuine alert by complaining. *Con:* a wrongly accused person waits for a reviewer — so appeals are listed first in the console.

**The appellant's identity is never shown to the reporter**, and final appeal decisions require a written reason that is emailed to both sides. *Pro:* safety and fairness; decisions are explainable. *Con:* more reviewer effort.

**Owners can remove their own alert instantly ("ফেরত পেয়েছি")** without review. *Pro:* stale alerts would hurt the next legitimate buyer; removing an alert can only ever reduce harm. *Con:* a hijacked account could remove an alert — the action is audited and re-reporting is one form away.

**Search results say what to do**, not just "reported": don't pay, stay safe, keep the seller's details, call 999 — and a "clear" result explains that it is not proof of ownership.

**Real numbers on the home page** (active reports, items returned to owners) replace marketing copy that the data could not back up.

## Lessons from real use (Nov 2026)

A tester reported "01716573526" and then found "no record" when searching it. Two separate causes, and the fixes they led to:

- **Unreviewed reports are invisible by design**, but the reporter had no way to know that. Now a signed-in owner searching their own number sees "your report is under review / needs info / was rejected" — visible only to them, never to the public.
- **It wasn't an IMEI at all** — it was the owner's SIM number. Phone serials are alphanumeric, so for phones any digits-only value that isn't an IMEI is now refused with an explanation (a BD mobile number is named as such), and searching a SIM number warns instead of saying "no record".

The same review turned up related input problems, all fixed:

| Input | Before | Now |
|---|---|---|
| 14-digit IMEI (check digit left off) | rejected | check digit added |
| 16-digit IMEISV (some phones show this) | rejected | first 14 digits + check digit |
| letter O for zero / I or L for one in an IMEI | rejected | corrected when that yields a valid IMEI |
| "IMEI: …", "IMEI1 …", "+880…" | rejected / not matched | label and leading + ignored |
| Bengali number plate ("ঢাকা মেট্রো-ল …") | "use English letters" | explains plates can't be searched; use the chassis number |
| wrong IMEI on the report form | shown only after every other field was valid | shown immediately |
| email typo at sign-up (gmial.com) | accepted silently | "did you mean gmail.com?" one-tap fix |
| per-IP limits (search 10/min, sign-up 5/h) | would block whole mobile networks: GP, Robi and Banglalink put many users behind one IP (carrier-grade NAT) | search 30/min and 1000/day, sign-up 20/h, login 60/15 min per IP; per-email limits unchanged |

## Known gaps (next steps, in priority order)

1. Phone-number OTP login — most Bangladeshi users are more comfortable with SMS than email. Needs an SMS gateway (e.g. SSL Wireless, Alpha SMS, BulkSMSBD) and a cost decision.
2. Malware scanning of evidence files (ClamAV in a worker); the console warns until then.
3. Cloudflare Turnstile on search and login.
4. Report expiry / re-confirmation (e.g. ask owners yearly whether the alert is still valid).
5. Partner API for marketplaces and shops (bulk checks with API keys).
6. English translation.
