# Access Control Foundation Execution Ledger

Plan: `docs/superpowers/plans/2026-07-15-access-control-foundation.md`

- Execution approach: subagent-driven development
- Git policy: do not commit or push without explicit user approval
- Branch at start: `safe-testing`
- Finance and Storage: protected roles, complete permission catalogues, and active teams are seeded in Release 1; no automatic user assignments

Task 1: complete (no commits by user policy; spec review approved; quality review approved; live PostgreSQL execution pending local configuration/backup gate)
Task 2: complete (no commits by user policy; 27/27 tests pass; production build passes; spec review approved; quality review approved)
Task 3: complete (no commits by user policy; 30/30 access-control tests pass; production build passes; independent SQL review approved; live PostgreSQL execution remains pending)
Task 4: complete (no commits by user policy; 31/31 access-control tests pass; production build passes; independent seed/security review approved; live PostgreSQL execution remains pending)
Task 5: complete (no commits by user policy; 32/32 access-control tests pass; production build passes; independent helper/security review approved; live PostgreSQL execution and query-plan inspection remain pending)
Task 6: complete (no commits by user policy; 33/33 access-control tests pass; production build passes; exact rerun fixtures added; independent backfill review approved; live PostgreSQL execution remains pending)
Task 7: complete (shadow access service attached to bootstrap; legacy authorization remains authoritative; 37/37 tests pass; build passes)
Task 8: complete (admin-only read-only migration comparison report added; independent review approved; authenticated visual checks require credentials)
Task 9: complete (operator, rollback, and developer security documentation added)
Task 10: repository checkpoint complete (build and access tests pass; bundle marker scan clean; database, backup, query-plan, and authenticated Playwright gates remain pending)

# Registration Import and Scouting-Year Backup Deletion Ledger

Plan: `docs/superpowers/plans/2026-09-24-registration-import-year-backup-deletion.md`

- Execution approach: subagent-driven development
- Branch: `safe-testing`
- Baseline: 245/247 access-control tests pass; known unrelated failures are `retiring an account revokes access without deleting contribution attribution` and `high-risk user Edge Functions require exact normalized permissions`
- Worktree: current dedicated branch used in place because Git ownership safety rejected linked-worktree inspection under the execution identity

Task 1: complete (commit c5e856c, focused test 1/1 pass, spec and quality review approved)
Task 2: complete (commit 2852abf, focused tests 6/6 pass, build passed, spec and quality review approved; live authenticated flow pending final verification)
Task 3: complete (commits bd5bb89..ce55b15, Node contracts 8/8 and PostgreSQL 16.15 rollback/security fixtures pass, spec/security review approved)
Task 4: complete (commits 966c5a4..a05dea8, focused tests 22/22 and build pass, service-role bucket isolation and deterministic ZIP review approved)
Task 5: complete (commits 5cf3582..5418e27, focused tests 36/36 and build pass, fail-safe storage retention and error normalization review approved)
Task 6: complete (commits 8e5b9c2..3c8599f, focused UI/import tests 22/22 and build pass, accessibility/state integration review approved; authenticated visual inspection unavailable)
