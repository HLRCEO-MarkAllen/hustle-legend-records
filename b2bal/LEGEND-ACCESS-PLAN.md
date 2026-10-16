# HLR Legend Access — private collector album platform (draft)

Status: DESIGN / NOT DEPLOYED. No access keys issued, no fan data collected, no protected audio uploaded.

## Purpose
Each physical Born 2 Be A Legend mini-CD unlocks a private digital experience on hustlelegendrecords.com. HLR owns the service and content. The fan-facing entrance is /b2bal/; protected content is served only after server-side verification.

## Architecture
- Website: /b2bal/ public unlock screen; authenticated private player, videos, lyrics, credits and bonuses.
- Supabase: new isolated legend_* tables and a dedicated Edge Function. Do not reuse HQ, radio or store credentials or alter existing tables.
- Collectors: one randomly generated high-entropy secret per album; encode in NFC URL with unique identifier and secret. Store **only keyed hashes** of secrets, never plaintext; no secrets in source control or analytics.
- On tap: HTTPS request validates secret server-side, checks enabled/revoked state, and issues a four-hour HttpOnly Secure SameSite session cookie. The server enforces a fixed four-hour expiry, after which access to private media and APIs is denied until another authorized NFC tap. An authorized retap starts a fresh four-hour session. Strip credentials from browser URL via redirect before analytics, embeds or third-party scripts load. Set Referrer-Policy: no-referrer and Cache-Control: no-store on unlock routes.
- Authorization: protect the **media bytes** and APIs with short-lived signed URLs or server-gated streaming; hiding page sections is not protection. Keep Supabase Storage private and enforce RLS. Never expose service-role key to browser.
- Admin: require authenticated authorized HLR admin identity and explicit role checks for minting, activating, revoking, or viewing aggregate analytics. Rate-limit unlock attempts, audit administrative changes. Avoid collecting names/emails unless required.
- Media: upload only music/videos with suitable rights, or approved embeds; third-party embeds may expose public URLs or bypass private playback, so do not represent them as exclusive protected content.
- NFC limitations: commodity NTAG213/215 static URLs are cloneable and transferable. Unique keys support revocation and monitoring but do not prove physical possession or prevent forwarding. Consider tamper-resistant packaging and higher-security NFC chips for stronger physical verification.
- Rollout: first prepare staging and test keys, validate private media isolation, mobile NFC tap, revoked token denial, direct-URL denial, referrer leakage, session expiry and rate limits. No production release until owner approves.
- Keep /b2bal/ draft unpublished and gated; no fake 'unlock' action that only uses client-side logic.

## Collector dashboard
Authorized admins: album inventory, key issuance, activation/revocation, access counts (privacy-preserving), media library, album pages and video modules. No payments, ownership or distribution changes.

## Decisions required
- Quantity of mini-CDs to issue and whether each gets its own NFC tag.
- Which songs/video assets are licensed and intended to be exclusive.
- Whether each key permits multiple devices. Session duration is confirmed as four hours per authorized tap.
