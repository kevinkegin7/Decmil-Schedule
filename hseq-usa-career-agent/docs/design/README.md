# Target design (Milestone 0)

The full multi-agent design agreed in Milestone 0. **Not deployed.** Later
milestones implement it piece by piece as new numbered migrations in
`supabase/migrations/`, adapted to the tables that now exist.

| File | Contents |
|---|---|
| `TARGET-ARCHITECTURE.md` | Six agents, request roles, Claude API usage, email, immigration evidence model |
| `TARGET-SAFEGUARDS.md` | Each mandatory safeguard → database and app enforcement → test |
| `target-schema/migrations/0001_initial_schema.sql` | Outreach, approvals, send gate, rate limits, sponsorship evidence |
| `target-schema/tests/` | 49 SQL safeguard checks on plain PostgreSQL: `bash docs/design/target-schema/tests/run.sh` |

Milestone 1 replaced the profile tables in this design with the field set from
the Milestone 1 brief (see `docs/DATABASE.md`). Where the two differ, Milestone 1 wins.
