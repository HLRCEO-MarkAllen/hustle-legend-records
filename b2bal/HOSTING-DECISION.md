# Confirmed hosting and release architecture — 2026-10-16

## Verified existing infrastructure
- The root README explicitly states that the official HLR website is published using **GitHub Pages** from `main` at the repository root, with a custom domain in `CNAME`.
- GitHub Pages is static hosting. It cannot issue first-party HttpOnly collector cookies or enforce protected media access without an additional backend.
- Supabase project `frkzkgmmcfexudikcdef` has existing active `hlr-hq`, `hlr-ai-context`, and `schwrtzma8d-paypal` functions. Do not modify them.
- No `legend_*` tables or Legend Access Edge Function were present at the time of inspection.

## Architecture choice
Phase 1: GitHub Pages serves the attractive public collector landing page only. Supabase Edge Functions handle key validation, session validation, media authorization and administrative actions. Private media resides in a private Supabase Storage bucket. No service-role key in browser code.

Phase 2: Decide how to deliver a reliable 4-hour browser session:
A. **Preferred**: configure a same-origin secure proxy or dedicated authenticated application hosting for collector pages and API. It can issue first-party Secure HttpOnly cookies and gate streaming, but requires an additional deployment/hosting setup, and possibly cost.
B. **Fallback**: static GitHub Pages UI with a Supabase Edge Function and short-lived opaque session tokens kept in browser memory. Browser refresh would require re-tapping; tokens are bearer credentials. Must implement and test CORS, XSS defense, rate limits, signed media URLs, and safe secret exchange. This is not equivalent to a first-party cookie solution.

Do not assume a cookie set by a `*.supabase.co` function is a first-party cookie for `hustlelegendrecords.com`. Never store NFC secrets or sessions in localStorage without explicit threat review. No public YouTube/Audiomack embed can be protected by the private vault.

## Buyer quality and security requirements
- One independently random, revocable credential per physical mini-CD.
- Each valid tap issues a new fixed 4-hour session; no automatic renewal.
- Invalid/revoked/expired session cannot fetch protected media bytes.
- Clear tap instructions, accessible player, manual fallback for devices without NFC, help contact and recovery process.
- Test case/sticker placement: apply NFC to the case or packaging, never a spinning mini-CD; verify actual phone reads through case.
- Static NFC tags can be cloned; do not market them as uncopyable or proof of purchase.
- CEO-approved per-artist management, audit trails, strict data isolation and no changes to rights ownership.
- Production migration, private bucket, key issuance, and launch require completed tests and explicit final release approval.

## Current deployment status
No production database changes; no Legend Access Edge Function deployed; no buyer key issued; no protected media uploaded. GitHub feature branch and pull request remain draft and unmerged.
