using System.Text.Json;
using LegacyLens.Api.Configuration;
using LegacyLens.Api.Models;
using Microsoft.Extensions.Options;
using OpenAI;
using OpenAI.Chat;

namespace LegacyLens.Api.Providers;

public sealed class OpenAiProvider : IAiProvider
{
    private readonly OpenAiOptions _options;
    private readonly ILogger<OpenAiProvider> _logger;

    private const string SystemPrompt = """
        You are a senior software architect performing code review and documentation.

        Analyze the provided source code and return valid JSON matching this exact schema:

        {
          "summary": string,
          "businessPurpose": string,
          "explainSimpler": string,
          "risks": [
            {
              "title": string,
              "severity": string,
              "description": string
            }
          ],
          "architecture": {
            "patterns": [],
            "responsibilities": [],
            "dependencies": []
          }
        }

        summary:
        A clear, concise explanation of what the code does. Write for a developer who has
        never seen this codebase. Cover the main responsibility and key behaviour.

        businessPurpose:
        Why this code exists from a business perspective. What problem does it solve?
        What workflow or process does it support? Avoid technical jargon.

        explainSimpler:
        Explain the code to a junior developer or someone new to the project.
        Use plain language and analogies where helpful. Avoid assuming deep technical knowledge.

        risks:
        Identify meaningful software risks present in the code. Consider:
        - Null reference issues
        - Missing input validation
        - Error handling gaps
        - Security concerns (injection, exposure, auth)
        - Tight coupling or poor separation of concerns
        - Performance concerns (N+1 queries, blocking calls, missing async)
        - Maintainability concerns (magic strings, excessive complexity)
        - Technical debt
        - Database access concerns

        For each risk provide:
        title: a short name for the risk (e.g. "Missing Null Check", "N+1 Query Risk")
        severity: exactly one of "High", "Medium", or "Low" — no other values
        description: a clear explanation of the specific risk in this code

        Only return risks that are genuinely present. Do not invent risks.
        If no meaningful risks exist, return: "risks": []

        architecture:
        Identify the architectural characteristics of the code.

        patterns:
        List recognisable architectural and design patterns present.
        Examples: "Repository Pattern", "Service Layer", "Dependency Injection",
        "Factory Pattern", "Strategy Pattern", "CQRS", "Domain Model",
        "MVC", "API Controller", "Event Driven".
        Only include patterns clearly evidenced by the code. Do not invent patterns.
        If none apply, return: "patterns": []

        responsibilities:
        List the major responsibilities of this code as short, clear phrases.
        Examples: "Retrieves funding orders by user ID", "Maps entities to DTOs",
        "Validates user requests", "Publishes domain events".
        If none, return: "responsibilities": []

        dependencies:
        List meaningful dependencies referenced or injected into this code.
        Examples: "IFundingOrderRepository", "ILogger", "HttpClient", "Entity Framework",
        "IMapper", "IOptions<T>".
        Only list dependencies that are visibly present. Do not invent them.
        If none, return: "dependencies": []

        Return only the JSON object. No markdown, no code fences, no additional text.
        """;

    public OpenAiProvider(
        IOptions<OpenAiOptions> options,
        ILogger<OpenAiProvider> logger)
    {
        _options = options.Value;
        _logger = logger;
    }

    public async Task<AiAnalysisResponse> AnalyzeCodeAsync(
        string fileName,
        string sourceCode,
        CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("OpenAI Key Length: {Length}", _options.ApiKey?.Length ?? 0);
        _logger.LogInformation("OpenAI Model: {Model}", _options.Model);

        if (string.IsNullOrWhiteSpace(_options.ApiKey))
        {
            _logger.LogError("OpenAI API key is missing or empty.");
            throw new InvalidOperationException("OpenAI API key is not configured.");
        }

        try
        {
            var client = new OpenAIClient(_options.ApiKey);
            var chatClient = client.GetChatClient(_options.Model);

            var userMessage = $"""
                File Name: {fileName}

                Source Code:
                {sourceCode}
                """;

            var messages = new List<ChatMessage>
            {
                new SystemChatMessage(SystemPrompt),
                new UserChatMessage(userMessage)
            };

            var completionOptions = new ChatCompletionOptions
            {
                ResponseFormat = ChatResponseFormat.CreateJsonObjectFormat()
            };

            _logger.LogInformation(
                "Requesting AI analysis for {FileName} using model {Model}",
                fileName, _options.Model);

            var completion = await chatClient.CompleteChatAsync(
                messages, completionOptions, cancellationToken);

            var rawJson = completion.Value.Content[0].Text;

            _logger.LogInformation("Successfully received AI response for {FileName}", fileName);
            _logger.LogDebug("Raw AI response for {FileName}: {Json}", fileName, rawJson);

            return ParseResponse(rawJson, _options.Model);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "OpenAI request failed for {FileName}", fileName);
            throw;
        }
    }

    private AiAnalysisResponse ParseResponse(string json, string model)
    {
        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;

        return new AiAnalysisResponse(
            Summary:         root.GetProperty("summary").GetString()         ?? string.Empty,
            BusinessPurpose: root.GetProperty("businessPurpose").GetString() ?? string.Empty,
            ExplainSimpler:  root.GetProperty("explainSimpler").GetString()  ?? string.Empty,
            Risks:           ParseRisks(root),
            Architecture:    ParseArchitecture(root),
            Model:           model,
            Provider:        "OpenAI",
            GeneratedAtUtc:  DateTimeOffset.UtcNow
        );
    }

    private static IReadOnlyList<AiRisk> ParseRisks(JsonElement root)
    {
        var risks = new List<AiRisk>();

        if (!root.TryGetProperty("risks", out var risksEl) ||
            risksEl.ValueKind != JsonValueKind.Array)
            return risks.AsReadOnly();

        foreach (var r in risksEl.EnumerateArray())
        {
            var title       = r.TryGetProperty("title",       out var t) ? t.GetString() ?? string.Empty : string.Empty;
            var severity    = r.TryGetProperty("severity",    out var s) ? s.GetString() ?? "Low"        : "Low";
            var description = r.TryGetProperty("description", out var d) ? d.GetString() ?? string.Empty : string.Empty;

            var normalisedSeverity = severity.Trim() switch
            {
                "High"   or "high"   => "High",
                "Medium" or "medium" => "Medium",
                _                    => "Low"
            };

            if (!string.IsNullOrWhiteSpace(title))
                risks.Add(new AiRisk(title, normalisedSeverity, description));
        }

        return risks.AsReadOnly();
    }

    private static ArchitectureAnalysis ParseArchitecture(JsonElement root)
    {
        if (!root.TryGetProperty("architecture", out var archEl) ||
            archEl.ValueKind != JsonValueKind.Object)
            return EmptyArchitecture();

        return new ArchitectureAnalysis(
            Patterns:         ParseStringArray(archEl, "patterns"),
            Responsibilities: ParseStringArray(archEl, "responsibilities"),
            Dependencies:     ParseStringArray(archEl, "dependencies")
        );
    }

    private static IReadOnlyList<string> ParseStringArray(JsonElement parent, string propertyName)
    {
        if (!parent.TryGetProperty(propertyName, out var el) ||
            el.ValueKind != JsonValueKind.Array)
            return Array.Empty<string>();

        var result = new List<string>();
        foreach (var item in el.EnumerateArray())
        {
            var value = item.GetString();
            if (!string.IsNullOrWhiteSpace(value))
                result.Add(value.Trim());
        }
        return result.AsReadOnly();
    }

    private static ArchitectureAnalysis EmptyArchitecture() =>
        new(Array.Empty<string>(), Array.Empty<string>(), Array.Empty<string>());
}
