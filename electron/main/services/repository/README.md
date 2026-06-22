# Repository Library Service

Manages the user's known repository library.

Responsibilities:
- Add repositories to the library (by path)
- List all known repositories
- Remove repositories
- Store last-opened timestamp

Phase 2: backed by SQLite. Phase 1: in-memory array.

This is the Phase 1 IPC proof-of-concept target.
IPC channels: repositories:getAll, repositories:add
