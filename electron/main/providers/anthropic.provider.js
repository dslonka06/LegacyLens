const https = require('https');
const { BaseAiProvider } = require('./base-provider');

const API_HOST = 'api.anthropic.com';
const API_VERSION = '2023-06-01';
const DEFAULT_MODEL = 'claude-sonnet-5-20251101';
const DEFAULT_MAX_TOKENS = 4096;

class AnthropicProvider extends BaseAiProvider {

  constructor(settingsService) {
    super();
    this.settings = settingsService;
  }

  // ── Public interface ──────────────────────────────────────────────────────

  async generate(request) {
    const { messages, systemPrompt, maxTokens = DEFAULT_MAX_TOKENS } = request;
    const apiKey = await this._getApiKey();
    const model = await this._getModel();
    return this._request(apiKey, model, messages, systemPrompt, maxTokens);
  }

  async chat(messages, options = {}) {
    const { systemPrompt, maxTokens = DEFAULT_MAX_TOKENS } = options;
    const apiKey = await this._getApiKey();
    const model = await this._getModel();
    return this._request(apiKey, model, messages, systemPrompt, maxTokens);
  }

  async testConnection() {
    let apiKey;
    try {
      apiKey = await this._getApiKey();
    } catch {
      return { ok: false, reason: 'API key not configured' };
    }

    const model = await this._getModel();

    try {
      await this._request(
        apiKey,
        model,
        [{ role: 'user', content: 'Hi' }],
        undefined,
        16,
        15_000,
      );
      return { ok: true };
    } catch (err) {
      return { ok: false, reason: this._sanitizeError(err) };
    }
  }

  getCapabilities() {
    return {
      supportsModelDiscovery: false,
      supportedModels: [
        'claude-sonnet-5-20251101',
        'claude-opus-4-8-20251101',
        'claude-haiku-4-5-20251001',
      ],
      requiresApiKey: true,
      requiresHost: false,
    };
  }

  // ── Private ───────────────────────────────────────────────────────────────

  async _getApiKey() {
    const { safeStorage } = require('electron');
    const raw = this.settings.get('anthropicApiKeyEncrypted');
    if (!raw) throw new Error('Anthropic API key is not configured');
    const cipher = Buffer.from(raw, 'base64');
    return safeStorage.decryptString(cipher);
  }

  async _getModel() {
    return this.settings.get('aiModel') ?? DEFAULT_MODEL;
  }

  _request(apiKey, model, messages, systemPrompt, maxTokens, timeoutMs = 300_000) {
    return new Promise((resolve, reject) => {
      const body = JSON.stringify({
        model,
        max_tokens: maxTokens,
        ...(systemPrompt ? { system: systemPrompt } : {}),
        messages: messages.filter(m => m.role !== 'system'),
      });

      const options = {
        hostname: API_HOST,
        port: 443,
        path: '/v1/messages',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
          'x-api-key': apiKey,
          'anthropic-version': API_VERSION,
        },
        timeout: timeoutMs,
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
          if (res.statusCode < 200 || res.statusCode >= 300) {
            let detail = data.slice(0, 300);
            try { detail = JSON.parse(data)?.error?.message ?? detail; } catch {}
            reject(new Error(`Anthropic API error ${res.statusCode}: ${detail}`));
            return;
          }
          try {
            const json = JSON.parse(data);
            const text = json?.content?.[0]?.text ?? '';
            resolve(text);
          } catch {
            reject(new Error('Anthropic returned non-JSON response'));
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Anthropic request timed out'));
      });

      req.write(body);
      req.end();
    });
  }

  // Ensure API keys never leak into error messages surfaced to the renderer
  _sanitizeError(err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Strip anything that looks like an API key (long alphanumeric strings)
    return msg.replace(/sk-[a-zA-Z0-9\-_]{10,}/g, '[redacted]');
  }
}

module.exports = { AnthropicProvider };
