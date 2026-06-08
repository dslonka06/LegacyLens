using LegacyLens.Api.Models;

namespace LegacyLens.Api.Services;

public interface IAiExplainService
{
    Task<AiExplainResponse> ExplainAsync(
        AiExplainRequest request,
        CancellationToken cancellationToken = default);
}
