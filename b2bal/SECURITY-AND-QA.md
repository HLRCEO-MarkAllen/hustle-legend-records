# Legend Access implementation decisions and test matrix
Status: review-only. No production credentials, deployment, buyer unlock or database migration.

## Security gates
1. The NFC URL is a **bearer credential**. A static NTAG213/215 can be duplicated. A unique tag per mini-CD plus a four-hour session limits exposure but does not prove the physical item was tapped.
2. Never put credentials in URL query parameters, external analytics, referer headers or third-party embeds. Prefer URL fragment handling followed by immediate removal and a same-origin secure backend exchange. Confirm actual mobile NFC behavior before selecting this.
3. Website is hosted on hustlelegendrecords.com while Edge Functions use supabase.co. Decide between a same-origin proxy with HttpOnly cookies (preferred) or a token model with documented storage/reload limitations.
4. Each valid tap creates a **new session expiring at issued time + 4h**; no silent renewal. Server must validate every media request, key status and session expiry.
5. NFC unlock API must be rate-limited per IP and key id; use nonenumerating errors, constant-time secret verification, origin controls and abuse telemetry that never records secrets.
6. The Edge Function source is a draft. Do not deploy before server-side private media, secure session transport, admin authorization and integration tests are finished.
7. CEO role must be based on an authenticated immutable user ID with verified mapping, not an email string or front-end flag. Managers get scoped permissions per artist.
8. Keep music and videos in private storage and authorize bytes, not just the webpage. External YouTube/Audiomack embeds cannot be described as truly exclusive media.

## Buyer acceptance cases
| Case | Expected result |
| --- | --- |
| Fresh valid NFC key | Unlock matching album only; expiry exactly 4h |
| Same key retapped | Fresh four-hour session |
| No key / guessed key | No private media access |
| Revoked key | Unlock denied and existing sessions denied |
| Expired session | Protected media denied |
| Copy link without credential | Unlock denied |
| Stolen credential shared | Potential access; documented inherent limitation |
| Phone with NFC disabled | Accessible fallback with unique printed collector code |
| Refresh during session | Works if same-origin secure-cookie architecture is implemented |
| Wrong artist session | No access to other artist's album |
| Direct private media URL | Denied without valid session |
| Offline / bad network | Clear recovery message without claiming unlock |
| Mobile accessibility | Buttons labeled; keyboard and screen reader operable |
| Buyer support | Lost tag/replacement/revocation process documented |

## Launch blockers
- Confirm hosting platform can support same-origin authenticated backend or secure proxy.
- Verify legal ownership/clearance for audio and video to be served in private vault.
- Obtain original album artwork and final verified 20-song order.
- Prepare a real phone and NFC case test.
- Test with sample credentials before printing/programming any production stickers.
- Obtain owner signoff on privacy, retention, and collector support process.
