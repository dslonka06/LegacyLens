# Workspace Service

Manages workspace persistence on the Electron side, backed by SQLite.

## Responsibilities

- Save and retrieve `PersistedWorkspace` records
- Delete workspaces by id
- Provide the authoritative source of workspace state across app restarts

## IPC channels served

`workspaces:getAll`, `workspaces:save`, `workspaces:delete`
