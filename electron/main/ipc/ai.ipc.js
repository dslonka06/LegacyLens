const { ipcMain } = require('electron');
const { AiKnowledgeEngine } = require('../engines/ai/knowledge.engine');
const { AiAnalysisEngine } = require('../engines/ai/analysis.engine');
const { buildChatContext } = require('../engines/ai/chat-context-builder');
const { ProviderRegistry } = require('../providers/provider-registry');
const { SettingsService } = require('../services/settings/settings.service');
const { getPresetById } = require('../providers/provider-presets');
const { wrapHandler } = require('./ipc-utils');

// Maps a preset id to the settings key that holds its encrypted API key.
// Presets sharing a protocol share the same encrypted key storage.
function apiKeySettingsKey(presetId) {
  const preset = getPresetById(presetId);
  if (!preset) return null;
  switch (preset.protocol) {
    case 'anthropic':     return 'anthropicApiKeyEncrypted';
    case 'openai-compat': return 'openaiCompatApiKeyEncrypted';
    default:              return null;
  }
}

const settingsService = new SettingsService();
const registry = new ProviderRegistry(settingsService);
const knowledgeEngine = new AiKnowledgeEngine(registry);
const analysisEngine = new AiAnalysisEngine(registry);

const CHAT_SYSTEM_PROMPT =
  'You are an expert software analyst embedded inside SystemLens, a codebase intelligence tool. ' +
  'When workspace context is provided, ground every answer in that data — cite specific files, classes, patterns, ' +
  'findings, workflows, or recommendations by name rather than speaking in generalities. ' +
  'Never hedge by saying you cannot know something that the provided context already answers. ' +
  'Format responses with Markdown: bullet lists for enumerations, code blocks (with language hint) for ' +
  'code or file paths, bold for key terms, and headings only when the answer has clearly distinct sections. ' +
  'When no context is provided, be honest that analysis has not been run yet and suggest the user run one first.';

function registerAiHandlers() {

  // ── ai:explain — knowledge pipeline (single-turn) ─────────────────────────
  ipcMain.handle('ai:explain', wrapHandler(async (_event, prompt, maxTokens) => {
    if (!prompt || typeof prompt !== 'string') throw new Error('prompt is required');
    if (!registry.isConfigured()) throw new Error('No AI provider configured');
    return knowledgeEngine.explain(prompt, maxTokens ?? undefined);
  }));

  // ── ai:analyze — single-file code analysis ────────────────────────────────
  ipcMain.handle('ai:analyze', wrapHandler(async (_event, fileName, sourceCode) => {
    if (!fileName || typeof fileName !== 'string') throw new Error('fileName is required');
    if (!sourceCode || typeof sourceCode !== 'string') throw new Error('sourceCode is required');
    if (!registry.isConfigured()) throw new Error('No AI provider configured');
    return analysisEngine.analyze(fileName, sourceCode);
  }));

  // ── ai:chat — multi-turn chat with workspace context ──────────────────────
  ipcMain.handle('ai:chat', wrapHandler(async (_event, messages, knowledgeModel) => {
    if (!Array.isArray(messages) || messages.length === 0) throw new Error('messages array is required');
    if (!registry.isConfigured()) throw new Error('No AI provider configured');

    const contextBlock = knowledgeModel ? buildChatContext(knowledgeModel) : '';
    const systemPrompt = contextBlock
      ? `${CHAT_SYSTEM_PROMPT}\n\nWorkspace context:\n${contextBlock}`
      : CHAT_SYSTEM_PROMPT;

    const provider = registry.getActiveProvider();
    return provider.chat(messages, { systemPrompt, maxTokens: 4096 });
  }));

  // ── ai:getProviders — provider status list (no network calls) ────────────
  ipcMain.handle('ai:getProviders', wrapHandler(() => {
    return registry.getProviderStatuses();
  }));

  // ── ai:getPresets — full preset registry (no network calls) ──────────────
  ipcMain.handle('ai:getPresets', wrapHandler(() => {
    return registry.getPresets();
  }));

  // ── ai:getCapabilities — capabilities for a given provider id ────────────
  ipcMain.handle('ai:getCapabilities', wrapHandler((_event, providerId) => {
    return registry.getCapabilities(providerId ?? undefined);
  }));

  // ── ai:discoverModels — Ollama: fetch installed models from /api/tags ─────
  ipcMain.handle('ai:discoverModels', wrapHandler((_event, presetId) => {
    return registry.discoverModels(presetId ?? undefined);
  }));

  // ── ai:testConnection — test the active provider (makes a real API call) ─
  ipcMain.handle('ai:testConnection', wrapHandler(() => {
    return registry.testActiveProvider();
  }));

  // ── ai:setApiKey — encrypt and store an API key via safeStorage ──────────
  // presetId identifies which preset's key to store (determines the storage key).
  ipcMain.handle('ai:setApiKey', wrapHandler((_event, presetId, plainKey) => {
    if (!presetId || typeof presetId !== 'string') throw new Error('presetId is required');

    const storageKey = apiKeySettingsKey(presetId);
    if (!storageKey) throw new Error(`Preset "${presetId}" does not use an API key`);

    if (!plainKey) {
      settingsService.set(storageKey, null);
      return;
    }

    const { safeStorage } = require('electron');
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('Secure storage is not available on this system');
    }
    const cipher = safeStorage.encryptString(plainKey);
    settingsService.set(storageKey, cipher.toString('base64'));
  }));

  // ── ai:isKeyConfigured — returns true/false without decrypting ───────────
  ipcMain.handle('ai:isKeyConfigured', wrapHandler((_event, presetId) => {
    if (!presetId) return false;
    const storageKey = apiKeySettingsKey(presetId);
    if (!storageKey) return false;
    return !!settingsService.get(storageKey);
  }));
}

module.exports = { registerAiHandlers };
