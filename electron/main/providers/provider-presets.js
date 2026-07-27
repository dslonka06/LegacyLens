/**
 * Provider preset registry — single source of truth for every AI service
 * SystemLens can connect to.
 *
 * Presets are pure data. They tell the UI what to show and the ProviderRegistry
 * which protocol implementation to instantiate. Adding a new service only
 * requires a new entry here — no new provider class needed unless the wire
 * protocol differs from the three existing implementations.
 *
 * @typedef {Object} ProviderPreset
 * @property {string}   id                  - Unique preset identifier
 * @property {string}   displayName         - Human-readable service name
 * @property {'cloud'|'local'} category     - Grouping in the UI
 * @property {'anthropic'|'ollama'|'openai-compat'} protocol - Which provider class handles this
 * @property {string|null} defaultBaseUrl   - Pre-filled base URL (null for Anthropic/Ollama — they manage their own)
 * @property {boolean}  requiresApiKey      - Whether to show the API key input
 * @property {boolean}  requiresHostInput   - Whether to show a host/base URL input (editable)
 * @property {boolean}  supportsModelDiscovery - Whether the provider can list installed models
 * @property {string[]} suggestedModels     - Model names to show as quick-select chips
 * @property {string|null} apiKeyUrl        - URL to the service's API key dashboard
 * @property {string|null} downloadUrl      - URL to download page (local providers only)
 * @property {string|null} description      - One-line description shown in the preset picker
 */

const PRESETS = [
  // ── Cloud ─────────────────────────────────────────────────────────────────

  {
    id: 'anthropic',
    displayName: 'Anthropic',
    category: 'cloud',
    protocol: 'anthropic',
    defaultBaseUrl: null,
    requiresApiKey: true,
    requiresHostInput: false,
    supportsModelDiscovery: false,
    suggestedModels: [
      'claude-sonnet-5-20251101',
      'claude-opus-4-8-20251101',
      'claude-haiku-4-5-20251001',
    ],
    apiKeyUrl: 'https://console.anthropic.com/account/keys',
    downloadUrl: null,
    description: 'Claude Sonnet, Opus, and Haiku',
  },

  {
    id: 'openai',
    displayName: 'OpenAI',
    category: 'cloud',
    protocol: 'openai-compat',
    defaultBaseUrl: 'https://api.openai.com/v1',
    requiresApiKey: true,
    requiresHostInput: false,
    supportsModelDiscovery: false,
    suggestedModels: ['gpt-4o', 'gpt-4o-mini', 'o1', 'o3-mini'],
    apiKeyUrl: 'https://platform.openai.com/api-keys',
    downloadUrl: null,
    description: 'GPT-4o, o1, and more',
  },

  {
    id: 'groq',
    displayName: 'Groq',
    category: 'cloud',
    protocol: 'openai-compat',
    defaultBaseUrl: 'https://api.groq.com/openai/v1',
    requiresApiKey: true,
    requiresHostInput: false,
    supportsModelDiscovery: false,
    suggestedModels: [
      'llama-3.3-70b-versatile',
      'llama-3.1-8b-instant',
      'mixtral-8x7b-32768',
      'gemma2-9b-it',
    ],
    apiKeyUrl: 'https://console.groq.com/keys',
    downloadUrl: null,
    description: 'Fast inference — Llama, Mixtral, Gemma',
  },

  {
    id: 'together',
    displayName: 'Together AI',
    category: 'cloud',
    protocol: 'openai-compat',
    defaultBaseUrl: 'https://api.together.xyz/v1',
    requiresApiKey: true,
    requiresHostInput: false,
    supportsModelDiscovery: false,
    suggestedModels: [
      'meta-llama/Llama-3.3-70B-Instruct-Turbo',
      'Qwen/Qwen2.5-72B-Instruct-Turbo',
      'deepseek-ai/DeepSeek-R1',
    ],
    apiKeyUrl: 'https://api.together.xyz/settings/api-keys',
    downloadUrl: null,
    description: 'Llama, Qwen, DeepSeek, and 100+ models',
  },

  {
    id: 'mistral',
    displayName: 'Mistral',
    category: 'cloud',
    protocol: 'openai-compat',
    defaultBaseUrl: 'https://api.mistral.ai/v1',
    requiresApiKey: true,
    requiresHostInput: false,
    supportsModelDiscovery: false,
    suggestedModels: [
      'mistral-large-latest',
      'mistral-small-latest',
      'codestral-latest',
    ],
    apiKeyUrl: 'https://console.mistral.ai/api-keys',
    downloadUrl: null,
    description: 'Mistral Large, Small, and Codestral',
  },

  {
    id: 'openai-compat-custom',
    displayName: 'Custom Endpoint',
    category: 'cloud',
    protocol: 'openai-compat',
    defaultBaseUrl: null,
    requiresApiKey: false,
    requiresHostInput: true,
    supportsModelDiscovery: false,
    suggestedModels: [],
    apiKeyUrl: null,
    downloadUrl: null,
    description: 'Any OpenAI-compatible API endpoint',
  },

  // ── Local ─────────────────────────────────────────────────────────────────

  {
    id: 'ollama',
    displayName: 'Ollama',
    category: 'local',
    protocol: 'ollama',
    defaultBaseUrl: null,
    requiresApiKey: false,
    requiresHostInput: true,
    supportsModelDiscovery: true,
    suggestedModels: ['qwen3:8b', 'qwen3:4b', 'llama3.1:8b', 'deepseek-r1:8b'],
    apiKeyUrl: null,
    downloadUrl: 'https://ollama.com/download',
    description: 'Run open-source models locally — free, private',
  },

  {
    id: 'lmstudio',
    displayName: 'LM Studio',
    category: 'local',
    protocol: 'openai-compat',
    defaultBaseUrl: 'http://localhost:1234/v1',
    requiresApiKey: false,
    requiresHostInput: true,
    supportsModelDiscovery: false,
    suggestedModels: [],
    apiKeyUrl: null,
    downloadUrl: 'https://lmstudio.ai',
    description: 'Run models via LM Studio\'s local server',
  },

  {
    id: 'jan',
    displayName: 'Jan',
    category: 'local',
    protocol: 'openai-compat',
    defaultBaseUrl: 'http://localhost:1337/v1',
    requiresApiKey: false,
    requiresHostInput: true,
    supportsModelDiscovery: false,
    suggestedModels: [],
    apiKeyUrl: null,
    downloadUrl: 'https://jan.ai',
    description: 'Run models via Jan\'s local API server',
  },
];

/**
 * Returns the full preset list.
 * @returns {ProviderPreset[]}
 */
function getPresets() {
  return PRESETS;
}

/**
 * Finds a single preset by id. Returns null if not found.
 * @param {string} id
 * @returns {ProviderPreset|null}
 */
function getPresetById(id) {
  return PRESETS.find(p => p.id === id) ?? null;
}

module.exports = { getPresets, getPresetById };
