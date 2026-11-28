# Lottery Intelligence Platform — Project Status

Shared status for the owner, ChatGPT (product architect / reviewer), Claude (research
analyst / challenger) and Claude Code (implementation engineer). Keep it factual: anything
not executed is NOT TESTED.

_Last updated: 2026-11-28 by Claude Code_

## Current state

| | |
|---|---|
| Repository | `kevinkegin7/Decmil-Schedule` (temporary — see decision D1) |
| Branch | `claude/lottery-platform-audit-odsni9` |
| Base commit | `8e0d3bf` (main) |
| Phase | **Audit complete — awaiting owner review** |
| Lottery code written | None |
| Lottery tests executed | None (NOT TESTED) |

## Architecture

Proposed, not built: Python `lotto-core` (rules, prize engine, statistics, experiments) +
FastAPI + PostgreSQL + React/TypeScript PWA. See `AUDIT.md` §7–§8.

## Completed milestones

| Milestone | Evidence |
|---|---|
| M0 Repository intelligence audit | `lottery-platform/AUDIT.md` |

## Tested functionality

Existing (non-lottery) repo suite: `npm ci && npm test` — PASS (unit + browser).
Without `npm ci` the browser suite FAILS with a misleading timeout.

## Open owner decisions (blocking)

D1 repository · D2 jurisdiction · D3 results data rights · D4 network allowlist for
official sources · D5 hosting/budget · D6 commercial positioning. Details in `AUDIT.md` §1.

## Unresolved defects / risks

- Rules for 5 of 7 games are UNVERIFIED against official documents (`AUDIT.md` §6).
- Existing app: LLM keys in browser `localStorage`; Firebase rules unverified (`AUDIT.md` §4).

## Disagreements on record

- Prediction-style features cannot change win probability; product must be positioned as
  analytics, tracking and experiments (`AUDIT.md` §10, §14). Open for challenge with evidence.

## Next proposed task (not yet approved)

Phase 1 — `lotto-core` rules registry and prize engine, gated on official rule documents.
