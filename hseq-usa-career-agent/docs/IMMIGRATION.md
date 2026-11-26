# Immigration pathway assessment

**Indicative research only, not legal advice.** The assessment never states
that you will qualify. Where judgement is needed it says so and recommends
attorney review. Code: `src/lib/immigration/pathways.ts`.

## How each pathway is reported

| Part | Meaning |
|---|---|
| **Eligibility** | `currently_ineligible`, `not_applicable`, `potentially_eligible`, `requires_employer_sponsorship`, `insufficient_information` or `needs_attorney_review` |
| **Requirements and evidence** | Each requirement marked *met*, *not met*, *unknown* or *depends on employer*, with the fact it relied on |
| **Uncertainty** | What is not known or may have changed |
| **Sources** | Official USCIS / DOL / DOS pages, with their verification status |
| **Reconsider when** | What would change the result |

## Current classifications for the owner's profile

| Pathway | Result | Why |
|---|---|---|
| **E-3** | **Currently ineligible — Australian citizenship required** | E-3 is for Australian citizens only. An Australian 485 visa or permanent residency does not qualify. Reconsider if you acquire Australian citizenship. |
| H-1B | Requires employer sponsorship | Employer petition for a specialty occupation; bachelor's degree recorded; cap lottery unless the employer is cap-exempt; fees and selection rules changed recently, so check current USCIS guidance |
| EB-2 | Insufficient information → requires employer sponsorship once post-degree experience is recorded | Bachelor's + 5 years *post-degree* progressive experience, PERM and an I-140 by the employer |
| EB-2 NIW | Needs attorney review | Self-petition, but whether HSEQ work meets the national-importance test is fact-specific |
| EB-3 | Requires employer sponsorship | Professional (bachelor's) or skilled worker; PERM and an I-140 by the employer |
| L-1 | Insufficient information | Needs a year with a company related to the US employer. Nothing suggests any change to your current employment. |
| O-1 | Insufficient information | Very high evidentiary standard |
| TN | Not applicable | Canadian and Mexican citizens only |

**Chargeability:** green-card waiting times depend on **country of birth**, not
passport. Country of birth is not recorded, so EB-2 and EB-3 carry that
uncertainty flag. If born in India, historically long EB-2/EB-3 waits apply;
always check the current Visa Bulletin.

## Recording and audit

- Saving the immigration profile re-runs the assessment. **Re-run assessment**
  records a new run.
- Each pathway row stores `algorithm_version`, `inputs_hash`, `assessed_at`
  and `run_id`. Changes appear in the audit log.
- The immigration profile is private to you (RLS) and is never sent anywhere.
- Nothing in Milestone 2 makes an immigration representation to anyone.
