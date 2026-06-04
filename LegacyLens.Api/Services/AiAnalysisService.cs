using LegacyLens.Api.Configuration;
using LegacyLens.Api.Models;
using LegacyLens.Api.Providers;
using Microsoft.Extensions.Options;

namespace LegacyLens.Api.Services;

public sealed class AiAnalysisService : IAiAnalysisService
{
    private readonly IAiProvider _provider;
    private readonly OpenAiOptions _options;
    private readonly ILogger<AiAnalysisService> _logger;

    public AiAnalysisService(
        IAiProvider provider,
        IOptions<OpenAiOptions> options,
        ILogger<AiAnalysisService> logger)
    {
        _provider = provider;
        _options = options.Value;
        _logger = logger;
    }

    public async Task<AiAnalysisResponse> AnalyzeAsync(
        AiAnalysisRequest request,
        CancellationToken cancellationToken = default)
    {
        ValidateRequest(request);

        try
        {
            return await _provider.AnalyzeCodeAsync(
                request.FileName,
                request.SourceCode,
                cancellationToken);
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "AI analysis failed for {FileName}", request.FileName);
            throw;
        }
    }

    private void ValidateRequest(AiAnalysisRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.SourceCode))
            throw new ArgumentException("Source code cannot be empty.", nameof(request));

        if (request.SourceCode.Length > _options.MaxSourceCodeLength)
            throw new ArgumentException(
                $"Source code exceeds the maximum allowed length of {_options.MaxSourceCodeLength:N0} characters. " +
                "Please upload a smaller file.",
                nameof(request));
    }
}
