const http = require('http');
const https = require('https');
const { BaseAiProvider } = require('./base-provider');

const DEFAULT_HOST = 'http://localhost:11434';
const DEFAULT_MODEL = 'llama3.2';

class OllamaProvider extends BaseAiProvider {

  constructor(settingsService) {
    super();
    this.settings = settingsService;
  }

  // ── Public interface ──────────────────────────────────────────────────────

  async generate(request) {
    const { messages, systemPrompt, maxTokens } = request;
    const host = this._getHost();
    const model = this.settings.get('aiModel') ?? DEFAULT_MODEL;
    const fullMessages = systemPrompt
      ? [{ role: 'system', content: systemPrompt }, ...messages]
      : messages;
    return this._chat(host, model, fullMessages, maxTokens);
  }

  async chat(messages, options = {}) {
    const { systemPrompt, maxTokens } = options;
    const host = this._getHost();
    const model = this.settings.get('aiModel') ?? DEFAULT_MODEL;
    const fullMessages = systemPrompt
      ? [{ role: 'system', content: systemPrompt }, ...messages]
      : messages;
    return this._chat(host, model, fullMessages, maxTokens);
  }

  async testConnection() {
    const host = this._getHost();
    const model = this.settings.get('aiModel') ?? DEFAULT_MODEL;

    // First check the server is reachable
    try {
      const tags = await this._getTags(host);
      const modelExists = tags.models?.some(m => m.name === model || m.name.startsWith(model + ':'));
      if (!modelExists) {
        const available = (tags.models ?? []).map(m => m.name).join(', ') || 'none';
        return {
          ok: false,
          reason: `Model "${model}" not found. Installed models: ${available}`,
        };
      }
      return { ok: true };
    } catch (err) {
      return { ok: false, reason: `Could not connect to Ollama at ${host}: ${err.message}` };
    }
  }

  async getModels() {
    const host = this._getHost();
    try {
      const tags = await this._getTags(host);
      return (tags.models ?? []).map(m => m.name);
    } catch {
      return [];
    }
  }

  getCapabilities() {
    return {
      supportsModelDiscovery: true,
      supportedModels: [],
      requiresApiKey: false,
      requiresHost: true,
    };
  }

  // ── Private ───────────────────────────────────────────────────────────────

  _getHost() {
    return this.settings.get('ollamaHost') ?? DEFAULT_HOST;
  }

  _chat(host, model, messages, maxTokens) {
    return new Promise((resolve, reject) => {
      const bodyObj = {
        model,
        messages,
        stream: false,
        ...(maxTokens ? { options: { num_predict: maxTokens } } : {}),
      };
      const body = JSON.stringify(bodyObj);
      const parsed = new URL(`${host}/api/chat`);
      const lib = parsed.protocol === 'https:' ? https : http;

      const options = {
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
        path: parsed.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
        timeout: 300_000,
      };

      const req = lib.request(options, (res) => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
          if (res.statusCode < 200 || res.statusCode >= 300) {
            reject(new Error(`Ollama API error ${res.statusCode}: ${data.slice(0, 300)}`));
            return;
          }
          try {
            const json = JSON.parse(data);
            resolve(json?.message?.content ?? '');
          } catch {
            reject(new Error('Ollama returned non-JSON response'));
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Ollama request timed out'));
      });

      req.write(body);
      req.end();
    });
  }

  _getTags(host) {
    return new Promise((resolve, reject) => {
      const parsed = new URL(`${host}/api/tags`);
      const lib = parsed.protocol === 'https:' ? https : http;

      const options = {
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
        path: parsed.pathname,
        method: 'GET',
        timeout: 5_000,
      };

      const req = lib.request(options, (res) => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
          try { resolve(JSON.parse(data)); }
          catch { reject(new Error('Ollama /api/tags returned non-JSON')); }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('Connection timed out')); });
      req.end();
    });
  }
}

module.exports = { OllamaProvider };
