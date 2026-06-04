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
          "explainSimpler": string
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
        _logger.LogInformation(
            "OpenAI Key Length: {Length}",
            _options.ApiKey?.Length ?? 0);

        _logger.LogInformation(
            "OpenAI Model: {Model}",
            _options.Model);

        if (string.IsNullOrWhiteSpace(_options.ApiKey))
        {
            _logger.LogError(
                "OpenAI API key is missing or empty.");

            throw new InvalidOperationException(
                "OpenAI API key is not configured.");
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
                fileName,
                _options.Model);

            var completion = await chatClient.CompleteChatAsync(
                messages,
                completionOptions,
                cancellationToken);

            var rawJson = completion.Value.Content[0].Text;

            _logger.LogInformation(
                "Successfully received AI response for {FileName}",
                fileName);

            _logger.LogDebug(
                "Raw AI response for {FileName}: {Json}",
                fileName,
                rawJson);

            return ParseResponse(rawJson, _options.Model);
        }
        catch (Exception ex)
        {
            _logger.LogError(
                ex,
                "OpenAI request failed for {FileName}",
                fileName);

            throw;
        }
    }

    private AiAnalysisResponse ParseResponse(
        string json,
        string model)
    {
        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;

        return new AiAnalysisResponse(
            Summary: root.GetProperty("summary").GetString() ?? string.Empty,
            BusinessPurpose: root.GetProperty("businessPurpose").GetString() ?? string.Empty,
            ExplainSimpler: root.GetProperty("explainSimpler").GetString() ?? string.Empty,
            Model: model,
            Provider: "OpenAI",
            GeneratedAtUtc: DateTimeOffset.UtcNow
        );
    }
}