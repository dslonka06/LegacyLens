# Repository Library Service

Manages the user's known repository library, backed by SQLite.

## Responsibilities

- Add repositories to the library by path
- List all known repositories
- Remove repositories
- Track last-opened timestamp (`touch`)

## IPC channels served

`repositories:getAll`, `repositories:add`, `repositories:update`, `repositories:remove`, `repositories:touch`
