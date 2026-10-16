# Legend Access launch acceptance checklist
Status: not launched. Every blocking test must pass before publishing or programming production tags.

## Buyer journey
- [ ] NFC tap works on representative Android and iPhone devices; QR/manual fallback verified.
- [ ] Valid key unlocks album within reasonable mobile loading time and begins a **fixed four-hour** session.
- [ ] Session expiry stops new protected-media requests; replay requires fresh tap.
- [ ] Re-tapping active key starts a new four-hour session; revoked key does not.
- [ ] Friendly failure screens for offline, expired, revoked, unsupported NFC and bad codes.
- [ ] Screen-reader labels, keyboard access, captions and high-contrast mobile layouts verified.
- [ ] Full 20-track metadata and order cross-checked against official album master.
- [ ] Artwork and video URLs approved; rights and AI/sync restrictions reviewed.
- [ ] Audio playback, pause, seek, next track, background playback behavior tested on devices.
- [ ] Audio/video bytes inaccessible without server-verified collector session.

## Security and privacy
- [ ] Each album copy has an independently generated, high-entropy NFC credential.
- [ ] Credential never appears in logs, referrers, third-party requests, analytics or repo.
- [ ] Collector session cookies are Secure, HttpOnly, SameSite and expire in four hours.
- [ ] All authorization enforced on the server; no client-side-only protection.
- [ ] Storage buckets are private; signed media links expire promptly.
- [ ] No artist can read or modify another artist's data.
- [ ] Only authorized CEO can grant managers and issue/revoke production keys.
- [ ] Revoking a key invalidates any associated sessions.
- [ ] Rate limiting, brute-force protection and audit logging tested.
- [ ] RLS, CORS, CSRF, key rotation, privacy policy and retention reviewed.
- [ ] Explicit warning: ordinary NFC stickers can be copied/shared; no claim of uncloneability.

## Production and packaging
- [ ] No deployment without owner review of pull request and final mobile walkthrough.
- [ ] No database migration without reviewed backup/rollback.
- [ ] NFC stickers programmed only after final URL and server unlock flow work.
- [ ] Test a sticker through actual mini-CD case and printed glossy inserts.
- [ ] QR/manual fallback included inside packaging; code is unique per copy.
- [ ] Never place NFC sticker on spinning disc.
- [ ] Provide customer support/replacement process for defective tags.
- [ ] Check streaming, storage and bandwidth costs before public launch.
