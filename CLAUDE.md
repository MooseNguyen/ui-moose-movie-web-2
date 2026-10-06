# Moose Movie Next

Movie/TV browsing app built with Next.js 16 on TMDB data (portfolio project).

## Language

- Everything in this repository is written in **English**: code, comments, docs, commit messages, GitHub issues, PR titles/descriptions, review comments.
- Vietnamese is allowed only in `src/messages/vi.json` and in test data that deliberately exercises Vietnamese input.
- Conversation with the user (chat) is in Vietnamese.

## Key documents

- Design spec: `docs/specs/2026-10-04-moose-movie-next-design.md`
- Implementation plan: `docs/plans/2026-10-04-moose-movie-next.md` — its Global Constraints apply to every task.

## Workflow

- **Review gate before every task:** before implementing any task, list every step you will take for that task (branch, files, commands, tests, commit/PR) and wait for the user's explicit approval. Do not start implementation, create branches, install packages or open PRs until the user approves that task's step list. Approval covers only that one task.
- Task N in the plan = GitHub issue #N in `MooseNguyen/ui-moose-movie-web-2`, tracked on the "Moose Movie Next" project board.
- One branch and one PR per task; the PR body contains `Closes #N`.
- Commits follow Conventional Commits.
