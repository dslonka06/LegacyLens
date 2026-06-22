# Shared Contracts

Type definitions shared between Angular (renderer) and Electron (main process).

These are the canonical source of truth for all cross-boundary data shapes.
Angular models should import from here rather than defining their own duplicates.

Files:
- `repository.contract.ts` — repository structure, files, dependency graph
- `workspace.contract.ts` — workspace entity, profile, metadata
- `analysis.contract.ts` — all analysis result types
- `knowledge.contract.ts` — repository knowledge aggregate, knowledge state
- `ipc-channels.ts` — IPC channel name string constants (prevents typos)

Future:
- `sqlite.contract.ts` — database row shapes (Phase 2)
- `ai.contract.ts` — AI request/response shapes (Phase 3)
