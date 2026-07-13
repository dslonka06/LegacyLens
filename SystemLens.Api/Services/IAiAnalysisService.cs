using SystemLens.Api.Models;

namespace SystemLens.Api.Services;

public interface IAiAnalysisService
{
    Task<AiAnalysisResponse> AnalyzeAsync(
        AiAnalysisRequest request,
        CancellationToken cancellationToken = default);
}
