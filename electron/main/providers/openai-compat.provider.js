const http = require('http');
const https = require('https');
const { BaseAiProvider } = require('./base-provider');

const DEFAULT_MAX_TOKENS = 4096;

class OpenAICompatibleProvider extends BaseAiProvider {

  constructor(settingsService) {
    super();
    this.settings = settingsService;
  }

  // ── Public interface ──────────────────────────────────────────────────────

  async generate(request) {
    const { messages, systemPrompt, maxTokens = DEFAULT_MAX_TOKENS } = request;
    const fullMessages = systemPrompt
      ? [{ role: 'system', content: systemPrompt }, ...messages]
      : messages;
    return this._chat(fullMessages, maxTokens);
  }

  async chat(messages, options = {}) {
    const { systemPrompt, maxTokens = DEFAULT_MAX_TOKENS } = options;
    const fullMessages = systemPrompt
      ? [{ role: 'system', content: systemPrompt }, ...messages]
      : messages;
    return this._chat(fullMessages, maxTokens);
  }

  async testConnection() {
    try {
      await this._chat([{ role: 'user', content: 'Hi' }], 16, 15_000);
      return { ok: true };
    } catch (err) {
      return { ok: false, reason: this._sanitizeError(err) };
    }
  }

  getCapabilities() {
    return {
      supportsModelDiscovery: false,
      supportedModels: [],
      requiresApiKey: false,
      requiresHost: true,
    };
  }

  // ── Private ───────────────────────────────────────────────────────────────

  _getBaseUrl() {
    const url = this.settings.get('openaiCompatBaseUrl');
    if (!url) throw new Error('OpenAI-compatible base URL is not configured');
    return url.replace(/\/$/, '');
  }

  _getApiKey() {
    const { safeStorage } = require('electron');
    const raw = this.settings.get('openaiCompatApiKeyEncrypted');
    if (!raw) return null;
    const cipher = Buffer.from(raw, 'base64');
    return safeStorage.decryptString(cipher);
  }

  _getModel() {
    return this.settings.get('aiModel') ?? 'gpt-4o';
  }

  _chat(messages, maxTokens, timeoutMs = 300_000) {
    const baseUrl = this._getBaseUrl();
    const apiKey = this._getApiKey();
    const model = this._getModel();

    return new Promise((resolve, reject) => {
      const body = JSON.stringify({
        model,
        messages,
        max_tokens: maxTokens,
        stream: false,
      });

      const parsed = new URL(`${baseUrl}/chat/completions`);
      const lib = parsed.protocol === 'https:' ? https : http;

      const headers = {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      };
      if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

      const options = {
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
        path: parsed.pathname,
        method: 'POST',
        headers,
      };

      let settled = false;
      const done = (fn) => { if (!settled) { settled = true; fn(); } };

      const timer = setTimeout(() => {
        done(() => {
          req.destroy();
          reject(new Error('Request timed out'));
        });
      }, timeoutMs);

      const req = lib.request(options, (res) => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
          clearTimeout(timer);
          done(() => {
            if (res.statusCode < 200 || res.statusCode >= 300) {
              let detail = data.slice(0, 300);
              try { detail = JSON.parse(data)?.error?.message ?? detail; } catch {}
              reject(new Error(`OpenAI-compatible API error ${res.statusCode}: ${detail}`));
              return;
            }
            try {
              const json = JSON.parse(data);
              const text = json?.choices?.[0]?.message?.content ?? '';
              resolve(text);
            } catch {
              reject(new Error('Provider returned non-JSON response'));
            }
          });
        });
      });

      req.on('error', (err) => { clearTimeout(timer); done(() => reject(err)); });

      req.write(body);
      req.end();
    });
  }

  _sanitizeError(err) {
    const msg = err instanceof Error ? err.message : String(err);
    return msg.replace(/Bearer\s+[a-zA-Z0-9\-_]{10,}/g, 'Bearer [redacted]');
  }
}

module.exports = { OpenAICompatibleProvider };
