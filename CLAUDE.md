# Moose Movie Next

Movie/TV browsing app built with Next.js 16 on TMDB data (portfolio project).

## Language

Vietnamese is allowed only in `src/messages/vi.json` and in test data that deliberately
exercises Vietnamese input. Everything else follows the global English rule.

## Key documents

- Design spec: `docs/specs/2026-10-04-moose-movie-next-design.md`
- Implementation plan: `docs/plans/2026-10-04-moose-movie-next.md` — its Global
  Constraints apply to every task.

## Workflow

- Task N in the plan = GitHub issue #N in `MooseNguyen/ui-moose-movie-web-2`, tracked on
  the "Moose Movie Next" project board.
- Review gate: before each task, post its full step list and wait for approval.
  Approval covers only that task.
- **Git override:** once a task's step list is approved, committing, pushing that task's
  branch and opening its PR are allowed without asking again. Merging to `main` still
  requires my explicit request.
- One branch (`task/<N>-<slug>`) and one PR per task; the PR body contains `Closes #N`.
- Commits follow Conventional Commits.
- Package manager is **pnpm** (pinned via `packageManager`). Use `pnpm install`, `pnpm add`, `pnpm <script>`, `pnpm dlx`; never npm or yarn. New dependencies with install scripts must be approved explicitly in `pnpm-workspace.yaml` (`allowBuilds`).
