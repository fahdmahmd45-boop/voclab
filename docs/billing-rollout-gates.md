# VOC LAB — Billing & Credits rollout gate (not active)

Date: 2026-11-03

## Existing production invariants

- `profiles.plan='pro'` is the **existing lifetime** account; preserve 300 AI Credits renewed monthly. Do not auto-convert this plan or change the owner's account.
- `profiles.plan='free'` remains 30 Credits renewed monthly.
- `/api/ai` charges one Credit per new AI Search using the authenticated Supabase quota Edge Function.
- No subscription checkout or credit purchase endpoint is active. Never display a payment button until a verified provider webhook exists.

## Target plan catalog (display only in current app)

| Plan / package | Customer price | Allowance |
|---|---:|---:|
| Free | SAR 0 | 30 AI Credits monthly |
| Legacy Pro Lifetime | previous agreement | 300 AI Credits monthly |
| Pro Monthly | SAR 15 / month | 750 AI Credits monthly while active |
| Extra Small | SAR 10 one time | 350 purchased Credits |
| Extra Large | SAR 20 one time | 800 purchased Credits |

Customer-facing Credits are separate from OpenAI provider tokens. Purchased Credits do not reset with the monthly allowance. The monthly allowance is consumed first.

## Security and billing rules

1. Merchant onboarding must be completed before enabling sales. **No service-role key, payment secret, or OpenAI key belongs in HTML/client JS or commit history.**
2. Use a Saudi-compatible merchant provider and verify official signed webhook payloads **plus server-to-server payment status/amount/currency check**. Do not trust redirect success pages, browser-supplied prices, account IDs, or plan values.
3. A successful SAR 15.00 payment grants one monthly period. Idempotent payment identifiers ensure duplicate webhook deliveries never grant twice.
4. A successful SAR 10.00 paid top-up grants exactly 350 Credits; SAR 20.00 grants 800. Only verified paid events call the service-role-only functions in the staged migration.
5. Never overwrite a pre-existing `plan='pro'` lifetime account.
6. Expired `pro_monthly` returns Free quota at runtime. The billing UI should also retrieve and display expiry status (not yet done).
7. The quota RPC has a 5-requests/minute user limit; network limits remain in place. Do not turn these off to make billing work.
8. **Blocking before commercial launch:** implement request-id reservation/finalization/refund so AI provider failures, timeouts and invalid responses don't consume paid Credits. Protect against duplicate retries and refunds. The SQL staged here DOES NOT provide the refund flow.
9. Run database migration in an isolated staging project; verify RLS, role grants, repeat webhooks, concurrent top-ups, minute/month limits, expiry, malicious client writes, and SQL advisors. Production schema has NOT been changed by this PR.
10. Avoid storing raw uploaded study files permanently by default; verify file and data retention with the user before enabling Import & Learn.

## Development sequence

1. **Implemented live:** Arabic/English quiz mode, GPT-6 Luna in AI Search, read-only monthly/extra pack prices, preserved legacy PRO.
2. **Staged SQL only:** `20261103180000_staged_monthly_pro_purchased_credits.sql` adds pro_monthly, expiry, purchased wallet, payment ledgers and service-role-only idempotent grant functions.
3. Next: test SQL on staging and fix any findings before applying production. Confirm client plan/expiry rendering, monthly quota 750 and purchased credit balances with a signed-in test account.
4. Next: implement chosen payment provider's secure checkout + verified webhook, recurring renewal and subscription cancellation. Test duplicate/late/reversed payment events.
5. Next: add credit reservation/finalization/refund, API retries and usage ledger reconciliation; then charge/restore credit only on real success.
6. Launch behind a server-side feature flag only after payment + security + iPhone Safari end-to-end tests.

## Launch acceptance checklist

- [ ] Test real signed-in GPT-6 Luna search and strict JSON parsing, including Arabic/English/IPA on iPhone.
- [ ] Staging migration applies cleanly; all public RLS/security advisors checked.
- [ ] Existing lifetime plan stays at 300 monthly with no expiry.
- [ ] Monthly plan correctly grants 750, expires at its purchased renewal date, never grants 750 when expired.
- [ ] Purchased Credits are charged **after monthly**; balance never negative; persist across month reset.
- [ ] Two concurrent identical webhooks grant only once; mismatched reused payment ID fails.
- [ ] AI provider error or timeout refunds reserved credit exactly once.
- [ ] Browser cannot set its own plan, remaining credits or credit purchase state.
- [ ] Subscription renewal/cancellation/invoice customer flow works.
- [ ] Mobile account layout, Arabic/English quiz, free/paid account paths verified.
- [ ] Vercel preview, GitHub PR mergeability and Vercel production checks all green.

Do not apply this migration or accept money until all unchecked security/billing gates are complete.
