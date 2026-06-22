# Settings Service

Reads and writes application settings.

Responsibilities:
- Persist user preferences (theme, AI endpoint, etc.)
- Provide defaults on first run
- Storage: Phase 1 uses electron-store or JSON file; Phase 2 migrates to SQLite

Phase 1: stub only.
