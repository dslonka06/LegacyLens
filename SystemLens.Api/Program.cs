using SystemLens.Api.Configuration;
using SystemLens.Api.Providers;
using SystemLens.Api.Services;

var builder = WebApplication.CreateBuilder(args);

// ─── Configuration ───────────────────────────────────────
builder.Services.Configure<OpenAiOptions>(
    builder.Configuration.GetSection(OpenAiOptions.SectionName));

// ─── AI Layer ────────────────────────────────────────────
// Swap IAiProvider implementation here to change AI backends.
// OpenAiProvider → AnthropicProvider → OllamaProvider, etc.
builder.Services.AddScoped<IAiProvider, OpenAiProvider>();
builder.Services.AddScoped<IAiAnalysisService, AiAnalysisService>();
builder.Services.AddScoped<IAiExplainService, AiExplainService>();

// ─── API ─────────────────────────────────────────────────
builder.Services.AddControllers();
builder.Services.AddOpenApi();

// ─── CORS — allow Angular dev server ────────────────────
builder.Services.AddCors(options =>
{
    options.AddPolicy("AngularDev", policy =>
    {
        policy
            .WithOrigins("http://localhost:4200")
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();
app.UseCors("AngularDev");
app.UseAuthorization();
app.MapControllers();

app.Run();
