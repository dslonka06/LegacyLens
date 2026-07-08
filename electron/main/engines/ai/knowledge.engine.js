const https = require('https');
const http = require('http');

/**
 * Handles all AI explanation calls for the knowledge pipeline.
 * Accepts a pre-built prompt string from Angular and forwards it to the
 * configured AI provider. Angular owns context assembly and prompt building;
 * this engine owns the provider endpoint, auth, and retry logic.
 */
class AiKnowledgeEngine {

  constructor(settingsService) {
    this.settings = settingsService;
  }

  /**
   * Sends a prompt to the AI provider and returns the explanation string.
   * @param {string} prompt  Fully assembled prompt from Angular
   * @returns {Promise<string>} The AI-generated explanation
   */
  async explain(prompt) {
    const providerUrl = await this.resolveProviderUrl();
    return this.callProvider(providerUrl, prompt);
  }

  // ── Provider resolution ───────────────────────────────────────────────────

  async resolveProviderUrl() {
    const stored = await this.settings.get('aiProviderUrl');
    if (stored) return stored;
    // Default: local backend used during development
    return 'http://localhost:5000/api/ai/explain';
  }

  // ── HTTP call ─────────────────────────────────────────────────────────────

  callProvider(url, prompt) {
    return new Promise((resolve, reject) => {
      const body = JSON.stringify({ prompt });
      const parsed = new URL(url);
      const isHttps = parsed.protocol === 'https:';
      const lib = isHttps ? https : http;

      const options = {
        hostname: parsed.hostname,
        port: parsed.port || (isHttps ? 443 : 80),
        path: parsed.pathname + parsed.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
        timeout: 300_000, // 5 min — matches Angular timeout
      };

      const req = lib.request(options, (res) => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
          if (res.statusCode < 200 || res.statusCode >= 300) {
            reject(new Error(`AI provider returned ${res.statusCode}: ${data}`));
            return;
          }
          try {
            const json = JSON.parse(data);
            resolve(json.explanation ?? data);
          } catch {
            resolve(data);
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('AI provider request timed out after 5 minutes'));
      });

      req.write(body);
      req.end();
    });
  }
}

module.exports = { AiKnowledgeEngine };
