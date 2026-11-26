# HSEQ USA Career Agent

An AI-assisted job search platform for an Australian Senior HSEQ Advisor targeting
US employers in mining, construction, energy, manufacturing and infrastructure.
Six agents research, draft and track. **The user approves every outbound
message and every binding decision**, and the database enforces that.

> Self-contained project. It shares nothing with the Decmil Take 5 code in the
> rest of this repository (see `docs/DECISIONS.md`, ADR-001).

## Status

**Milestone 0 — architecture and schema.** No application code yet; nothing can
send email.

| Document | Contents |
|---|---|
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | System design, roles, agents, Claude API usage, email, privacy |
| [`docs/SAFEGUARDS.md`](docs/SAFEGUARDS.md) | Each mandatory safeguard → where it is enforced → test |
| [`docs/DECISIONS.md`](docs/DECISIONS.md) | Architecture decision records |
| [`docs/ROADMAP.md`](docs/ROADMAP.md) | Milestones M0–M10 with gates |
| [`supabase/migrations/0001_initial_schema.sql`](supabase/migrations/0001_initial_schema.sql) | Database schema with safeguards |
| [`supabase/tests/`](supabase/tests) | SQL safeguard test suite |

## Running the database tests

Needs `psql` and a local PostgreSQL 15+ superuser for the current OS user.

```bash
bash supabase/tests/run.sh
```

The runner creates a throwaway database, loads a minimal Supabase `auth` stub,
applies the migration and runs the safeguard checks. It ends with
`ALL SAFEGUARD TESTS PASSED`.
