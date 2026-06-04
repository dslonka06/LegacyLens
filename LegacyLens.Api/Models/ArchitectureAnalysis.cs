namespace LegacyLens.Api.Models;

public sealed record ArchitectureAnalysis(
    IReadOnlyList<string> Patterns,
    IReadOnlyList<string> Responsibilities,
    IReadOnlyList<string> Dependencies
);
