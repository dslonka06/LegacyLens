/**
 * BaseAiProvider — interface contract for all AI providers.
 *
 * Providers own exactly one concern: translating generic AI requests into
 * provider-specific API calls. SystemLens domain concepts (prompts, analysis
 * types, workspace context) belong to the engine layer above this.
 *
 * All subclasses must implement: generate(), chat(), testConnection(), getCapabilities().
 */
class BaseAiProvider {

  /**
   * Generate a completion from a list of messages.
   *
   * @param {object} request
   * @param {Array<{role: 'user'|'assistant'|'system', content: string}>} request.messages
   * @param {string}  [request.systemPrompt]
   * @param {number}  [request.maxTokens]
   * @param {number}  [request.temperature]
   * @returns {Promise<string>} The assistant's response text
   */
  async generate(request) {
    throw new Error(`${this.constructor.name} must implement generate()`);
  }

  /**
   * Send a multi-turn chat exchange.
   *
   * @param {Array<{role: 'user'|'assistant', content: string}>} messages Full conversation history
   * @param {object} [options]
   * @param {string} [options.systemPrompt]
   * @param {number} [options.maxTokens]
   * @returns {Promise<string>} The assistant's response text
   */
  async chat(messages, options = {}) {
    throw new Error(`${this.constructor.name} must implement chat()`);
  }

  /**
   * Validate that the provider is reachable and credentials are accepted.
   * @returns {Promise<{ok: boolean, reason?: string}>}
   */
  async testConnection() {
    throw new Error(`${this.constructor.name} must implement testConnection()`);
  }

  /**
   * Return static capability metadata for this provider.
   * @returns {{
   *   supportsModelDiscovery: boolean,
   *   supportedModels: string[],
   *   requiresApiKey: boolean,
   *   requiresHost: boolean
   * }}
   */
  getCapabilities() {
    return {
      supportsModelDiscovery: false,
      supportedModels: [],
      requiresApiKey: false,
      requiresHost: false,
    };
  }
}

module.exports = { BaseAiProvider };
