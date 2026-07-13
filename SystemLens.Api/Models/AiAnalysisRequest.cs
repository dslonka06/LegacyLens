namespace SystemLens.Api.Models;

public sealed record AiAnalysisRequest(
    string FileName,
    string SourceCode
);
