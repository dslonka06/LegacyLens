const { AnthropicProvider } = require('./anthropic.provider');
const { OllamaProvider } = require('./ollama.provider');
const { OpenAICompatibleProvider } = require('./openai-compat.provider');
const { getPresets, getPresetById } = require('./provider-presets');

const SUPPORTED_PROTOCOLS = ['anthropic', 'ollama', 'openai-compat'];

/**
 * ProviderRegistry — single source of truth for the active AI provider.
 *
 * The active provider is determined by the saved preset id. Each preset maps
 * to a protocol implementation (AnthropicProvider, OllamaProvider, or
 * OpenAICompatibleProvider). Provider instances are created on demand — no
 * caching — so settings changes are picked up on the next call.
 *
 * Stores the result of the last explicit testConnection() call per preset so
 * the settings UI can display availability without re-testing on every open.
 */
class ProviderRegistry {

  constructor(settingsService) {
    this.settings = settingsService;
    // { [presetId]: { ok: boolean, reason?: string, testedAt: string } }
    this._lastTestResults = {};
  }

  /**
   * Returns true if a preset is selected and its required settings are present.
   * Does NOT make a network call.
   */
  isConfigured() {
    const presetId = this.settings.get('activePresetId');
    if (!presetId) return false;
    return this._isPresetConfigured(presetId);
  }

  /**
   * Returns the active provider instance.
   * Throws if no preset is configured.
   */
  getActiveProvider() {
    const presetId = this.settings.get('activePresetId');
    if (!presetId) throw new Error('No AI provider configured. Open Settings to select a provider.');
    const preset = getPresetById(presetId);
    if (!preset) throw new Error(`Unknown preset: "${presetId}"`);
    return this._instantiate(preset.protocol);
  }

  /**
   * Returns status info for all presets without making network calls.
   */
  getProviderStatuses() {
    const activePresetId = this.settings.get('activePresetId');
    return getPresets().map(preset => {
      const lastTest = this._lastTestResults[preset.id] ?? null;
      return {
        id: preset.id,
        displayName: preset.displayName,
        category: preset.category,
        configured: this._isPresetConfigured(preset.id),
        active: preset.id === activePresetId,
        available: lastTest ? lastTest.ok : null,
        lastTestedAt: lastTest ? lastTest.testedAt : null,
        reason: lastTest?.reason,
      };
    });
  }

  /**
   * Run testConnection() on the active provider and record the result.
   * @returns {Promise<{ok: boolean, reason?: string}>}
   */
  async testActiveProvider() {
    const presetId = this.settings.get('activePresetId');
    if (!presetId) return { ok: false, reason: 'No provider selected' };

    const preset = getPresetById(presetId);
    if (!preset) return { ok: false, reason: `Unknown preset: "${presetId}"` };

    const provider = this._instantiate(preset.protocol);
    const result = await provider.testConnection();
    this._lastTestResults[presetId] = { ...result, testedAt: new Date().toISOString() };
    return result;
  }

  /**
   * Returns capabilities of the active provider (or a specific preset by id).
   */
  getCapabilities(presetId) {
    const id = presetId ?? this.settings.get('activePresetId');
    if (!id) return null;
    const preset = getPresetById(id);
    if (!preset) return null;
    return this._instantiate(preset.protocol).getCapabilities();
  }

  /**
   * Returns all presets from the preset registry.
   */
  getPresets() {
    return getPresets();
  }

  /**
   * For Ollama: returns the list of installed models via /api/tags.
   * Returns [] if the active preset doesn't support discovery or the call fails.
   */
  async discoverModels(presetId) {
    const id = presetId ?? this.settings.get('activePresetId');
    if (!id) return [];
    const preset = getPresetById(id);
    if (!preset || preset.protocol !== 'ollama') return [];
    const provider = this._instantiate('ollama');
    if (typeof provider.getModels === 'function') return provider.getModels();
    return [];
  }

  // ── Private ───────────────────────────────────────────────────────────────

  _instantiate(protocol) {
    switch (protocol) {
      case 'anthropic':     return new AnthropicProvider(this.settings);
      case 'ollama':        return new OllamaProvider(this.settings);
      case 'openai-compat': return new OpenAICompatibleProvider(this.settings);
      default:              throw new Error(`Unknown AI protocol: "${protocol}"`);
    }
  }

  _isPresetConfigured(presetId) {
    const preset = getPresetById(presetId);
    if (!preset) return false;

    switch (preset.protocol) {
      case 'anthropic':
        return !!this.settings.get('anthropicApiKeyEncrypted');
      case 'ollama':
        // Ollama has a default host so it's always considered configured
        return true;
      case 'openai-compat': {
        // Needs a base URL — either from the preset default or a saved override
        const savedUrl = this.settings.get('openaiCompatBaseUrl');
        return !!(savedUrl || preset.defaultBaseUrl);
      }
      default:
        return false;
    }
  }
}

module.exports = { ProviderRegistry };
