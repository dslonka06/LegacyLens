using SystemLens.Api.Models;

namespace SystemLens.Api.Services;

public interface IAiExplainService
{
    Task<AiExplainResponse> ExplainAsync(
        AiExplainRequest request,
        CancellationToken cancellationToken = default);
}
