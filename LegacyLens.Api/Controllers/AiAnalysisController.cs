using LegacyLens.Api.Models;
using LegacyLens.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace LegacyLens.Api.Controllers;

[ApiController]
[Route("api/ai")]
public sealed class AiAnalysisController : ControllerBase
{
    private readonly IAiAnalysisService _analysisService;
    private readonly IAiExplainService _explainService;
    private readonly ILogger<AiAnalysisController> _logger;

    public AiAnalysisController(
        IAiAnalysisService analysisService,
        IAiExplainService explainService,
        ILogger<AiAnalysisController> logger)
    {
        _analysisService = analysisService;
        _explainService = explainService;
        _logger = logger;
    }

    /// <summary>
    /// Analyze source code using AI and return summary, business purpose, and simplified explanation.
    /// </summary>
    [HttpPost("analyze")]
    [ProducesResponseType(typeof(AiAnalysisResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status503ServiceUnavailable)]
    public async Task<IActionResult> Analyze(
        [FromBody] AiAnalysisRequest request,
        CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        // Use a dedicated timeout rather than the browser's cancellation token so that
        // navigating away does not abort the OpenAI request mid-flight.
        using var cts = new CancellationTokenSource(TimeSpan.FromMinutes(5));

        try
        {
            _logger.LogInformation(
                "AI request starting. Type=Analyze FileName={FileName} SourceLength={Length}",
                request.FileName, request.SourceCode?.Length ?? 0);

            var response = await _analysisService.AnalyzeAsync(request, cts.Token);

            _logger.LogInformation("AI request completed. Type=Analyze FileName={FileName}", request.FileName);

            return Ok(response);
        }
        catch (ArgumentException ex)
        {
            _logger.LogWarning("Invalid analysis request: {Message}", ex.Message);
            return BadRequest(new ProblemDetails
            {
                Title = "Invalid Request",
                Detail = ex.Message,
                Status = StatusCodes.Status400BadRequest
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "AI request failed. Type=Analyze FileName={FileName}", request.FileName);
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new ProblemDetails
            {
                Title = "AI Service Unavailable",
                Detail = "The AI analysis service is currently unavailable. Please try again.",
                Status = StatusCodes.Status503ServiceUnavailable
            });
        }
    }

    /// <summary>
    /// Generate a free-form AI explanation from a structured prompt assembled by the frontend.
    /// </summary>
    [HttpPost("explain")]
    [ProducesResponseType(typeof(AiExplainResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status503ServiceUnavailable)]
    public async Task<IActionResult> Explain(
        [FromBody] AiExplainRequest request,
        CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        // Use a dedicated timeout rather than the browser's cancellation token so that
        // navigating away does not abort the OpenAI request mid-flight.
        using var cts = new CancellationTokenSource(TimeSpan.FromMinutes(5));

        try
        {
            _logger.LogInformation(
                "AI request starting. Type=Explain PromptLength={Length}",
                request.Prompt?.Length ?? 0);

            var response = await _explainService.ExplainAsync(request, cts.Token);

            _logger.LogInformation("AI request completed. Type=Explain");

            return Ok(response);
        }
        catch (ArgumentException ex)
        {
            _logger.LogWarning("Invalid explain request: {Message}", ex.Message);
            return BadRequest(new ProblemDetails
            {
                Title = "Invalid Request",
                Detail = ex.Message,
                Status = StatusCodes.Status400BadRequest
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "AI request failed. Type=Explain");
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new ProblemDetails
            {
                Title = "AI Service Unavailable",
                Detail = "The AI explanation service is currently unavailable. Please try again.",
                Status = StatusCodes.Status503ServiceUnavailable
            });
        }
    }
}
