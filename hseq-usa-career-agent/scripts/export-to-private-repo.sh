#!/usr/bin/env bash
# Extract hseq-usa-career-agent/ (with its history) from the Decmil-Schedule
# repository into a standalone repository, ready to push to a NEW PRIVATE repo.
#
#   Dry run (default): bash hseq-usa-career-agent/scripts/export-to-private-repo.sh
#   Push:              bash hseq-usa-career-agent/scripts/export-to-private-repo.sh --push git@github.com:<you>/hseq-usa-career-agent.git
#
# Run from the Decmil-Schedule repository root. Needs git-filter-repo
# (pip install git-filter-repo). The source repository is never modified:
# everything happens in a fresh clone in a temporary directory.
set -euo pipefail

BRANCH="${BRANCH:-claude/vigilant-faraday-8wt1yx}"
PUSH_URL=""
if [[ "${1:-}" == "--push" ]]; then PUSH_URL="${2:?usage: --push <new-private-repo-url>}"; fi

command -v git-filter-repo >/dev/null || { echo "Install git-filter-repo first: pip install git-filter-repo"; exit 1; }
SRC="$(git rev-parse --show-toplevel)"
WORK="$(mktemp -d)"
trap 'echo "Work directory kept for inspection: $WORK"' EXIT

echo "1/5 Fresh clone of $BRANCH"
git clone -q --no-local --single-branch --branch "$BRANCH" "$SRC" "$WORK/repo"
cd "$WORK/repo"

echo "2/5 Keep only the project folder (both of its historical names) and move it to the root"
git filter-repo --force --quiet \
  --path hseq-career-agent/ --path hseq-usa-career-agent/ \
  --path-rename hseq-career-agent/: --path-rename hseq-usa-career-agent/:
git branch -m main

echo "3/5 Check nothing from the Decmil Take 5 application came along"
FORBIDDEN='(^|/)(take5(\.js)?|current-system/|index\.html$|Automated compliance tracking system\.zip|test/harness\.html|test/mock-api\.js|test/fixture\.js|test/run-browser-tests\.js|src/take5)'
if git log --all --name-only --format= | grep -E "$FORBIDDEN" | sort -u | grep . ; then
  echo "ABORT: Decmil application files found in history (listed above)."; exit 1
fi

echo "4/5 Check no secrets or env files are in any commit"
if git log --all --name-only --format= | grep -E '(^|/)\.env($|\.local|\.production)' ; then
  echo "ABORT: an env file is in history."; exit 1
fi
if git grep -I -nE '(sb_secret_|service_role.{0,40}eyJ|-----BEGIN (RSA |EC )?PRIVATE KEY)' $(git rev-list --all) -- . 2>/dev/null | head -5 | grep . ; then
  echo "ABORT: possible secret found (above)."; exit 1
fi

echo "5/5 Summary"
echo "  commits: $(git rev-list --count main)"
echo "  files:   $(git ls-files | wc -l)"
git log --oneline | sed 's/^/  /'

if [[ -n "$PUSH_URL" ]]; then
  echo "Pushing to $PUSH_URL (branch main). Make sure this repository is PRIVATE."
  git remote add origin "$PUSH_URL"
  git push -u origin main
  echo "Done. Verify the new repository before closing PR #4."
else
  echo "Dry run only. Re-run with --push <url> to publish to your new private repository."
fi
