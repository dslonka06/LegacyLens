using LegacyLens.Api.Models;

namespace LegacyLens.Api.Providers;

/// <summary>
/// Swap point for AI backends: OpenAI, Anthropic, Ollama, Odysseus, etc.
/// No provider-specific types cross this boundary.
/// </summary>
public interface IAiProvider
{
    Task<AiAnalysisResponse> AnalyzeCodeAsync(
        string fileName,
        string sourceCode,
        CancellationToken cancellationToken = default);
}
