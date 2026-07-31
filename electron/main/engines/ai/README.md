# AI Engine

Handles all AI provider interactions and prompt execution.

## Files

- `analysis.engine.js` (`AiAnalysisEngine`) — builds the single-file code analysis prompt, calls the active provider, parses the structured JSON response
- `knowledge.engine.js` (`AiKnowledgeEngine`) — executes fully-assembled prompts from Angular's prompt builders via the active provider
- `chat-context-builder.js` — distils a `KnowledgeModel` into a compact context block injected into AI chat system prompts

## Provider abstraction

The engines delegate all provider concerns to `ProviderRegistry` (`electron/main/providers/`). Engines have no knowledge of which provider is active — they only call `provider.generate()` or `provider.chat()`.

## IPC channels served

- `ai:analyze` → `AiAnalysisEngine.analyze()`
- `ai:explain` → `AiKnowledgeEngine.explain()`
- `ai:chat` → chat handler in `ai.ipc.js` using `buildChatContext` + provider directly
