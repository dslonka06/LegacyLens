# Settings Service

Reads and writes application settings persisted to SQLite.

## Responsibilities

- Persist user preferences with typed defaults
- Provide `get(key)` / `set(key, value)` / `getAll()` interface
- All values are JSON-encoded per row in the `settings` table

## Settings keys

| Key | Default | Purpose |
|-----|---------|---------|
| `theme` | `'dark'` | UI theme |
| `activePresetId` | `null` | Active preset id (e.g. `'anthropic'`, `'ollama'`, `'groq'`) — maps to a preset in `provider-presets.js` |
| `aiModel` | `null` | Selected model; falls back to provider default |
| `anthropicApiKeyEncrypted` | `null` | `safeStorage`-encrypted Anthropic API key (base64) |
| `openaiCompatApiKeyEncrypted` | `null` | `safeStorage`-encrypted API key for all OpenAI-compatible cloud presets (base64) |
| `ollamaHost` | `null` | Ollama server URL; defaults to `http://localhost:11434` |
| `openaiCompatBaseUrl` | `null` | Base URL for OpenAI-compatible presets; preset's `defaultBaseUrl` used if null |
| `defaultExportPath` | `null` | Default path for PDF exports |
