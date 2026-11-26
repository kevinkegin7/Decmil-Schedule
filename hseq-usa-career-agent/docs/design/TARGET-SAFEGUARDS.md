# Safeguards Matrix

Each mandatory safeguard is enforced in at least two layers: **(1) the database**
(grants, RLS, triggers, so it holds even if app code is wrong) and **(2) the
application** (UI, agent runtime, so the user sees why). ✅ = implemented and
tested in Milestone 0. ⏳ = designed, implemented in the milestone shown.

Run the database tests with `supabase/tests/run.sh` (needs local Postgres 15+).

| # | Safeguard | Database enforcement | Application enforcement | Test |
|---|---|---|---|---|
| S1 | Never invent qualifications or employment history | ✅ Only `authenticated` can create or mark facts verified (`fn_guard_verification`). Editing a verified fact resets it to unverified. Agents cannot edit verified facts. ✅ Approval and sending are refused while any cited fact is unverified (`fn_unverified_citations`). | ⏳ M2: CV parser writes unverified facts only. ⏳ M6: `buildAgentContext` passes verified facts only; post-draft claim checker blocks uncited claims. | `10_safeguards.sql` §1, §5 |
| S2 | Never misrepresent US work authorisation | ✅ `us_work_authorization` defaults to `requires_sponsorship`; only the user can change it; any other value requires an evidence document (CHECK). | ⏳ M6: fixed, user-approved authorisation sentence; claim checker rejects drafts implying current authorisation. | §2 |
| S3 | Never send initial outreach without approval | ✅ **Every** outbound message needs an approval row whose `content_hash` matches the current content (`fn_assert_send_allowed`). Any edit after approval returns it to `pending_approval`. Only the user can insert approvals (role and `auth.uid()` checked); approvals are immutable. Only the dispatcher can move a message to `sending`. | ⏳ M6: approval screen shows the exact recipients, subject, body and cited facts. ⏳ M1: approvals require MFA (`aal2`). | §5, §9 |
| S4 | Never accept an offer or negotiate binding terms without approval | ✅ Only the user can set offers to `accepted`/`declined`/`countered` and applications to `submitted`/`accepted`/`declined`/`withdrawn`. ✅ Messages in `offer_negotiation`, `offer_response` and `withdrawal` need `binding_acknowledged = true` on the approval. | ⏳ M9: two-step confirmation dialog listing the terms being committed to. | §11, §12 |
| S5 | Never submit immigration representations without approval | ✅ Category `immigration_representation` needs `binding_acknowledged` approval. ✅ Pathway assessments must cite authoritative sources (CHECK). ✅ "Willing to sponsor" can come only from written confirmation linked to a stored email (CHECK + generated `strength`). | ⏳ M5: "Not legal advice — confirm with an immigration attorney" on every assessment; attorney-review fields. | §11, §13 |
| S6 | Protect personal information and employer confidentiality | ✅ RLS on every user table. ✅ OAuth token ciphertext unreadable by users and agents (column grants). ✅ Email bodies hashed in the audit log. ✅ `disclosure_level` on employer names and achievements. | ⏳ M1: private storage bucket, signed URLs. ⏳ M3/M6: `buildAgentContext` drops `private` facts. ⏳ M7: only job-related threads are synced. | §16 |
| S7 | Complete audit log | ✅ Row-level audit trigger on 27 tables with actor type and agent name. ✅ Append-only (trigger, plus no UPDATE/DELETE/TRUNCATE grants). ✅ Per-user SHA-256 hash chain; `fn_verify_audit_chain()` detects tampering. | ⏳ M10: Agent Activity page; nightly chain verification alert. | §17 |
| S8 | Global emergency pause | ✅ `emergency_pause()` (user scope, or platform scope for operator) pauses agents and outbound mail and cancels queued tasks. `claim_agent_task()` returns nothing while paused. The send gate refuses while paused. Only the user can resume. | ⏳ M1: always-visible pause button in the header; the worker also checks before each tool call. | §6, §15 |
| S9 | Email rate limits and anti-spam | ✅ Per-day, per-domain, per-employer and follow-up limits with CHECK ceilings. ✅ One cold email per recipient. ✅ Suppression list (address/domain) and do-not-contact. ✅ Unsubscribe/bounce replies auto-suppress. ✅ No "guessed" email source exists; published sources need a URL. | ⏳ M8: send-window scheduling in recipient timezone; opt-out line; rate-limit preview in the UI. | §7, §10, §14 |
| S10 | Approval before enabling external communications | ✅ Two independent switches: `platform_controls.external_comms_enabled` (operator, default **off**) and `user_controls.external_comms_enabled` (user only; operator cannot switch it on). | ⏳ M8 gate: the send scope is requested from Google/Microsoft only after sign-off. | §8, setup |

## Residual risks (accepted, documented)

- A Postgres **superuser** (database password) can disable triggers. Mitigation:
  the app never uses that credential; hash-chain verification detects audit edits
  afterwards (tested).
- The dispatcher's provider call happens after the `sending` commit. A crash
  between the provider call and `sent` can leave a message in `sending`.
  Mitigation (M8): reconcile by provider message ID before any retry; never
  auto-retry a `sending` message.
- An LLM may write a plausible but wrong sentence that the claim checker misses.
  Mitigation: human approval of every message (S3) is the final control.
