using LegacyLens.Api.Models;
using LegacyLens.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace LegacyLens.Api.Controllers;

[ApiController]
[Route("api/ai")]
public sealed class AiAnalysisController : ControllerBase
{
    private readonly IAiAnalysisService _analysisService;
    private readonly ILogger<AiAnalysisController> _logger;

    public AiAnalysisController(
        IAiAnalysisService analysisService,
        ILogger<AiAnalysisController> logger)
    {
        _analysisService = analysisService;
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

        try
        {
            var response = await _analysisService.AnalyzeAsync(request, cancellationToken);
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
            _logger.LogError(ex, "Unhandled error during AI analysis");
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new ProblemDetails
            {
                Title = "AI Service Unavailable",
                Detail = "The AI analysis service is currently unavailable. Please try again.",
                Status = StatusCodes.Status503ServiceUnavailable
            });
        }
    }
}
