const SYSTEM_PROMPT =
  'You are an expert software analyst specializing in code review and architecture assessment. ' +
  'Analyze the provided source code and return a JSON object with the following fields: ' +
  'summary (string), businessPurpose (string), risks (array of strings), ' +
  'architecture (string), modernizations (array of strings), documentation (string). ' +
  'Respond with valid JSON only — no markdown fences, no prose outside the JSON object.';

/**
 * AiAnalysisEngine — handles single-file AI analysis calls.
 *
 * Builds the analysis prompt and delegates to the provider.
 * The structured JSON response is parsed here before returning to Angular.
 */
class AiAnalysisEngine {

  constructor(providerRegistry) {
    this.registry = providerRegistry;
  }

  /**
   * @param {string} fileName
   * @param {string} sourceCode
   * @returns {Promise<object>} AiAnalysisResult
   */
  async analyze(fileName, sourceCode) {
    const provider = this.registry.getActiveProvider();
    const prompt = `Analyze the following file:\n\nFile: ${fileName}\n\n\`\`\`\n${sourceCode}\n\`\`\``;

    const text = await provider.generate({
      messages: [{ role: 'user', content: prompt }],
      systemPrompt: SYSTEM_PROMPT,
      maxTokens: 2048,
    });

    try {
      return JSON.parse(text);
    } catch {
      // Provider didn't return clean JSON — wrap the prose in the expected shape
      return { summary: text, businessPurpose: '', risks: [], architecture: '', modernizations: [], documentation: '' };
    }
  }
}

module.exports = { AiAnalysisEngine };
