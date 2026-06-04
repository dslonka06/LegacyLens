namespace LegacyLens.Api.Configuration;

public sealed class OpenAiOptions
{
    public const string SectionName = "OpenAI";

    public string ApiKey { get; init; } = string.Empty;
    public string Model { get; init; } = "gpt-4.1-mini";
    public int MaxSourceCodeLength { get; init; } = 50_000;
}
