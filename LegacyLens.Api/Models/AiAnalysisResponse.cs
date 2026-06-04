namespace LegacyLens.Api.Models;

public sealed record AiAnalysisResponse(
    string Summary,
    string BusinessPurpose,
    string ExplainSimpler,
    IReadOnlyList<AiRisk> Risks,
    ArchitectureAnalysis Architecture,
    IReadOnlyList<ModernizationRecommendation> Modernizations,
    GeneratedDocumentation Documentation,
    string Model,
    string Provider,
    DateTimeOffset GeneratedAtUtc
);
