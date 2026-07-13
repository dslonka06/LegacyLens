using SystemLens.Api.Models;
using SystemLens.Api.Providers;

namespace SystemLens.Api.Services;

public sealed class AiExplainService : IAiExplainService
{
    private readonly IAiProvider _provider;
    private readonly ILogger<AiExplainService> _logger;

    public AiExplainService(
        IAiProvider provider,
        ILogger<AiExplainService> logger)
    {
        _provider = provider;
        _logger = logger;
    }

    public async Task<AiExplainResponse> ExplainAsync(
        AiExplainRequest request,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(request.Prompt))
            throw new ArgumentException("Prompt cannot be empty.", nameof(request));

        try
        {
            var explanation = await _provider.ExplainAsync(request.Prompt, cancellationToken);
            return new AiExplainResponse(explanation);
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "AI explain failed");
            throw;
        }
    }
}
