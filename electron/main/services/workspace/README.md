# Workspace Service

Manages workspace lifecycle on the Electron side.

Responsibilities:
- Create / activate / delete workspaces
- Persist workspace state (Phase 2: SQLite)
- Enforce MAX_WORKSPACES limit
- Own workspace metadata (name, type, created-at, last-opened)

Phase 2: this service will persist workspaces to SQLite and become
the authoritative source of workspace state across app restarts.
