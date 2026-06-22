# AI Engine — Phase 3 Placeholder

This engine is NOT implemented in Phase 1 or Phase 2.

Phase 3 target responsibilities:
- Local AI provider integration (Ollama, llama.cpp, etc.)
- Prompt construction and context assembly
- Single-file analysis via LLM
- Repository explanation generation
- Security overview narrative generation
- Workflow explanation generation

Current state (Phase 1): Angular calls http://localhost:5000 directly via
AiAnalysisService and AiKnowledgeService. Those services remain in Angular
until Phase 3 migrates them here.

When Phase 3 arrives:
- AiAnalysisService → ai/analysis.engine.ts
- AiKnowledgeService → ai/knowledge.engine.ts
- ai/prompts/* → ai/prompts/

The IPC channel for AI will be: ai:analyze, ai:explain
