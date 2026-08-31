# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Context/token usage

This repo has the context-engineering skill collection installed under
`.claude/skills/` (from muratcankoylan/agent-skills-for-context-engineering).
Apply it proactively, not just when explicitly asked, to keep usage low:

- **filesystem-context**: offload large tool output, search results, or
  intermediate data to scratch files instead of keeping it in context; read
  back only the slice needed.
- **context-optimization**: prefer targeted `Grep`/`Glob`/partial `Read`
  (offset/limit) over reading whole files; avoid re-reading files already
  seen this session unless they may have changed.
- **context-compression**: on long sessions, summarize completed work
  (files touched, decisions made, next steps) instead of carrying full
  history forward.
- **tool-design** / **project-development**: batch independent read-only
  calls in parallel; avoid speculative exploration beyond what the task
  needs.

Route to the specific skill (`context-degradation`, `memory-systems`,
`multi-agent-patterns`, etc.) under `.claude/skills/` when its listed
trigger applies.
