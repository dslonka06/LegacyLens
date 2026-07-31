const SYSTEM_PROMPT =
  'You are an expert software analyst. Provide clear, accurate, and actionable explanations. ' +
  'Be concise but thorough. Focus on practical insights that help developers understand and improve the codebase.';

/**
 * AiKnowledgeEngine — handles knowledge pipeline explanation calls.
 *
 * Receives fully-assembled prompts from the Angular prompt builders.
 * Delegates all provider concerns to the ProviderRegistry.
 */
class AiKnowledgeEngine {

  constructor(providerRegistry) {
    this.registry = providerRegistry;
  }

  /**
   * @param {string} prompt Fully assembled prompt from Angular
   * @param {number} [maxTokens=2048] Override for callers needing larger output (e.g. JSON security response)
   * @returns {Promise<string>}
   */
  async explain(prompt, maxTokens = 2048) {
    const provider = this.registry.getActiveProvider();
    return provider.generate({
      messages: [{ role: 'user', content: prompt }],
      systemPrompt: SYSTEM_PROMPT,
      maxTokens,
    });
  }
}

module.exports = { AiKnowledgeEngine };
