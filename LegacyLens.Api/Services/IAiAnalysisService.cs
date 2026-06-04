using LegacyLens.Api.Models;

namespace LegacyLens.Api.Services;

public interface IAiAnalysisService
{
    Task<AiAnalysisResponse> AnalyzeAsync(
        AiAnalysisRequest request,
        CancellationToken cancellationToken = default);
}
