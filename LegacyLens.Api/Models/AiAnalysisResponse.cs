namespace LegacyLens.Api.Models;

public sealed record AiAnalysisResponse(
    string Summary,
    string BusinessPurpose,
    string ExplainSimpler,
    string Model,
    string Provider,
    DateTimeOffset GeneratedAtUtc
);
