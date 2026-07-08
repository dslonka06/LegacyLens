const https = require('https');
const http = require('http');

/**
 * Handles AI-powered single-file analysis calls.
 * Accepts fileName and sourceCode from Angular and forwards them to the
 * configured AI provider. Returns the raw AiAnalysisResult JSON.
 */
class AiAnalysisEngine {

  constructor(settingsService) {
    this.settings = settingsService;
  }

  /**
   * Sends a file to the AI provider for analysis.
   * @param {string} fileName
   * @param {string} sourceCode
   * @returns {Promise<object>} AiAnalysisResult
   */
  async analyze(fileName, sourceCode) {
    const providerUrl = await this.resolveProviderUrl();
    return this.callProvider(providerUrl, fileName, sourceCode);
  }

  // ── Provider resolution ───────────────────────────────────────────────────

  async resolveProviderUrl() {
    const stored = await this.settings.get('aiProviderUrl');
    if (stored) return stored;
    return 'http://localhost:5000/api/ai/analyze';
  }

  // ── HTTP call ─────────────────────────────────────────────────────────────

  callProvider(url, fileName, sourceCode) {
    return new Promise((resolve, reject) => {
      const body = JSON.stringify({ fileName, sourceCode });
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
        timeout: 300_000,
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
            resolve(JSON.parse(data));
          } catch {
            reject(new Error(`AI provider returned non-JSON response: ${data.slice(0, 200)}`));
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

module.exports = { AiAnalysisEngine };
