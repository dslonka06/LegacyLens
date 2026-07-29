// SecurityEvidenceEngine — gathers structured evidence per security domain
// without making any pass/fail judgements. All grading is delegated to the LLM.
//
// Returns a SecurityEvidenceReport: { scope, fileCount, languages, candidates[], domainEvidence }
// Candidates are capped at 15, ranked by confidence score.

// ── Confidence scores for candidate ranking ───────────────────────────────────
const CONFIDENCE = {
  HARDCODED_SECRET: 100,
  RAW_JWT: 100,
  BEARER_TOKEN: 90,
  SQL_CONCAT: 80,
  WEAK_CRYPTO: 70,
  MISSING_AUTH: 60,
  UNSAFE_FILE_OP: 50,
  SENSITIVE_LOG: 40,
  PROXIMITY_SIGNAL: 20,
};

const MAX_CANDIDATES = 15;

// ── Secret patterns ───────────────────────────────────────────────────────────
const SECRET_PATTERNS = [
  { re: /password\s*=\s*["'][^"']{4,}/i,            label: 'hardcoded-secret',  desc: 'password= assignment with string literal value',        score: CONFIDENCE.HARDCODED_SECRET },
  { re: /api_?key\s*=\s*["'][^"']{8,}/i,            label: 'hardcoded-secret',  desc: 'API key assignment with string literal value',          score: CONFIDENCE.HARDCODED_SECRET },
  { re: /connectionstring\s*=\s*["'][^"']{12,}/i,   label: 'hardcoded-secret',  desc: 'connection string assignment with literal value',       score: CONFIDENCE.HARDCODED_SECRET },
  { re: /server\s*=\s*\w+;.*password\s*=/i,         label: 'hardcoded-secret',  desc: 'connection string with embedded password',              score: CONFIDENCE.HARDCODED_SECRET },
  { re: /secret\s*=\s*["'][^"']{4,}/i,              label: 'hardcoded-secret',  desc: 'secret= assignment with string literal value',          score: CONFIDENCE.HARDCODED_SECRET },
  { re: /privatekey\s*=\s*["'][^"']{8,}/i,          label: 'hardcoded-secret',  desc: 'private key assignment with string literal value',      score: CONFIDENCE.HARDCODED_SECRET },
  { re: /bearer\s+[a-zA-Z0-9\-._~+/]+=*/i,          label: 'bearer-token',      desc: 'bearer token literal in source',                       score: CONFIDENCE.BEARER_TOKEN },
  { re: /eyJ[a-zA-Z0-9\-_=]+\.[a-zA-Z0-9\-_=]+\.[a-zA-Z0-9\-_+/=]*/,
                                                     label: 'raw-jwt',           desc: 'raw JWT token literal in source',                      score: CONFIDENCE.RAW_JWT },
];

// ── SQL injection patterns ────────────────────────────────────────────────────
const SQL_CONCAT_PATTERNS = [
  /string\.format.*select/i,
  /execute\s*\(.*\+/i,
  /sql\s*=.*\+\s*\w/i,
  /query\s*=.*\+\s*\w/i,
  /"select[^"]*"\s*\+/i,
  /"insert[^"]*"\s*\+/i,
  /"update[^"]*"\s*\+/i,
  /"delete[^"]*"\s*\+/i,
];

const SQL_CONTEXT_KEYWORDS = ['select', 'insert', 'update', 'delete', 'execute', 'sqlcommand', 'dbcommand', 'query'];

// ── Weak crypto patterns ──────────────────────────────────────────────────────
const WEAK_CRYPTO_PATTERNS = [
  { re: /\bMD5\b/,        label: 'MD5'  },
  { re: /\bSHA1\b|\bSHA-1\b/i, label: 'SHA1' },
  { re: /\bDES\b(?!k)/i,  label: 'DES'  },
  { re: /\bRC4\b/i,       label: 'RC4'  },
];

const STRONG_CRYPTO_PATTERNS = [/\bAES\b/, /\bRSA\b/, /\bSHA256\b|\bSHA-256\b/i, /\bSHA512\b|\bSHA-512\b/i, /\bbcrypt\b/i, /\bargon2\b/i, /\bPBKDF2\b/i, /\bECDSA\b/i];

// ── Auth patterns ─────────────────────────────────────────────────────────────
const AUTH_FRAMEWORK_PATTERNS = [
  { re: /UseAuthentication\s*\(/,                  name: 'ASP.NET Identity' },
  { re: /AddAuthentication\s*\(/,                  name: 'ASP.NET Identity' },
  { re: /JwtBearer|AddJwtBearer/,                  name: 'JWT Bearer' },
  { re: /passport\.use\s*\(/,                      name: 'Passport.js' },
  { re: /passport\.initialize\s*\(/,               name: 'Passport.js' },
  { re: /@UseGuards\s*\(/,                         name: 'NestJS Guards' },
  { re: /jwt\.verify\s*\(/,                        name: 'jsonwebtoken' },
  { re: /@login_required/,                         name: 'Django/Flask' },
  { re: /Spring Security|@EnableWebSecurity/,      name: 'Spring Security' },
];

const AUTH_PROTECT_PATTERNS  = [/\[Authorize\]/i, /\[Authorize\(/, /requireAuth/, /@login_required/, /\.authenticated\(\)/, /\[Protected\]/i, /\[ApiKey\]/i, /@UseGuards/];
const HTTP_VERB_PATTERNS      = [/\[HttpGet\]|\[HttpPost\]|\[HttpPut\]|\[HttpDelete\]|\[HttpPatch\]/i, /@Get\(|@Post\(|@Put\(|@Delete\(|@Patch\(/];
const AUTH_MIDDLEWARE_PATTERNS = [/UseAuthentication\s*\(/, /passport\.initialize/, /app\.use\s*\(.*auth/i, /addAuthentication/i];

// ── Authorization patterns ────────────────────────────────────────────────────
const AUTHZ_ROLE_PATTERNS     = [/\[Authorize\(Roles\s*=/, /IsInRole\s*\(/, /HasRole\s*\(/, /\.hasRole\s*\(/i, /roles\s*:\s*\[/i];
const AUTHZ_POLICY_PATTERNS   = [/\[Authorize\(Policy\s*=/, /RequirePolicy\s*\(/, /\.RequireAuthenticatedUser/, /policy\s*:\s*["']/i];
const AUTHZ_PERMISSION_PATTERNS = [/HasPermission\s*\(/, /CanAccess\s*\(/, /IsAuthorized\s*\(/, /checkPermission\s*\(/i, /hasPermission\s*\(/i];

// ── Input validation patterns ─────────────────────────────────────────────────
const VALIDATION_FRAMEWORK_PATTERNS = [
  { re: /FluentValidation|AbstractValidator/, name: 'FluentValidation' },
  { re: /class-validator|@IsString|@IsEmail/, name: 'class-validator' },
  { re: /\bzod\b.*\.parse|z\.object/,         name: 'Zod' },
  { re: /joi\.object|Joi\.string/i,           name: 'Joi' },
  { re: /yup\.object|yup\.string/i,           name: 'Yup' },
  { re: /ModelState\.IsValid/,                name: 'ASP.NET ModelState' },
  { re: /javax\.validation|@Valid\b/,         name: 'Jakarta Validation' },
];

const VALIDATION_ATTR_PATTERNS = [/\[Required\]/, /\[Range\s*\(/, /\[RegularExpression/, /\[StringLength/, /\[MaxLength/, /\[MinLength/, /\[EmailAddress\]/];
const GUARD_CLAUSE_PATTERNS    = [/ArgumentNullException/, /ArgumentException/, /throw new Error\s*\(/, /if\s*\(!?\w+\)\s*(?:throw|return)/, /Guard\.Against/];
const UNVALIDATED_ENTRY_RE     = /\[(HttpGet|HttpPost|HttpPut|HttpDelete|HttpPatch)\]/i;

// ── Data access patterns ──────────────────────────────────────────────────────
const ORM_PATTERNS = [
  { re: /DbContext|EntityFramework|\.Include\s*\(|\.FirstOrDefault\s*\(/,    name: 'Entity Framework' },
  { re: /DapperExtensions|\.Query<|connection\.Execute\s*\(/,                name: 'Dapper' },
  { re: /TypeOrmModule|@InjectRepository|getRepository\s*\(/,               name: 'TypeORM' },
  { re: /PrismaClient|prisma\.\w+\.(find|create|update|delete)/,            name: 'Prisma' },
  { re: /sequelize\.(define|query)|Sequelize\(/,                             name: 'Sequelize' },
  { re: /mongoose\.model|Schema\s*\(\s*\{/,                                 name: 'Mongoose' },
  { re: /knex\s*\(|\.table\s*\(.*\)\.select|knex\.schema/,                  name: 'Knex' },
];

const PARAMETERISED_PATTERNS    = [/SqlParameter\s*\(/, /@\w+\b(?=.*where)/i, /\?\s*(?:,|\)|\s*where)/i, /:\w+\b(?=.*where)/i, /AddWithValue\s*\(/, /cmd\.Parameters/];
const STORED_PROC_PATTERNS      = [/CommandType\.StoredProcedure/, /EXEC\s+sp_/i, /ExecuteStoredProcedure\s*\(/i, /callProc\s*\(/i];

// ── Logging patterns ──────────────────────────────────────────────────────────
const LOG_FRAMEWORK_PATTERNS = [
  { re: /Serilog|Log\.Information|Log\.Warning|Log\.Error/,  name: 'Serilog' },
  { re: /NLog|_logger\.|ILogger/,                            name: 'NLog / Microsoft.Extensions.Logging' },
  { re: /winston\.(info|warn|error|debug)/,                  name: 'Winston' },
  { re: /pino\s*\(\)|logger\.(info|warn|error)\s*\(/,        name: 'Pino' },
  { re: /log4j|LogManager\.getLogger/,                       name: 'Log4j' },
  { re: /console\.(log|warn|error|info)\s*\(/,               name: 'console (raw)' },
];

const SENSITIVE_FIELD_RE        = /password|secret|token|ssn|creditcard|credit_card|apikey|api_key|privatekey/i;
const LOG_CALL_RE               = /log\.(info|warn|error|debug|trace|write)|console\.(log|warn|error)|_logger\.(Log|Information|Warning|Error)/i;
const STRUCTURED_LOG_RE         = /\$"|@\w+(?=\s*,|\s*\))|\{[A-Z]\w+\}/;
const RAW_CONSOLE_RE            = /console\.(log|warn|error|info)\s*\(/;

// ── Error handling patterns ───────────────────────────────────────────────────
const TRY_CATCH_RE              = /\btry\s*\{/;
const EMPTY_CATCH_RE            = /catch\s*(?:\([^)]*\))?\s*\{\s*\}/;
const GLOBAL_HANDLER_PATTERNS   = [/UseExceptionHandler\s*\(/, /app\.use\s*\(\s*(?:function\s*)?\(\s*err/, /process\.on\s*\(\s*['"]uncaughtException/, /\.UseMiddleware.*Exception/i, /GlobalExceptionHandler/i];
const STACK_EXPOSURE_RE         = /\.StackTrace|\.stack(?:\s+in|\s*\+|\s*\))|err\.stack/;

// ── Secrets manager / env var patterns ───────────────────────────────────────
const ENV_VAR_PATTERNS          = [/process\.env\.\w+/, /Environment\.GetEnvironmentVariable\s*\(/, /IConfiguration(?:\s+\w+)?\[/, /config\[["']\w/, /getenv\s*\(/i, /os\.environ/i];
const SECRETS_MANAGER_PATTERNS  = [/KeyVaultClient|SecretClient|getSecret\s*\(/, /SecretsManager|GetSecretValue/, /HashiCorp|vault\.read/i, /SSMClient|GetParameter\s*\(/, /@Value\s*\(\s*['"]?\$\{/];

// ── File op patterns ──────────────────────────────────────────────────────────
const FILE_OP_RE                = /File\.(WriteAll|Create|Open|Copy|Move)|fs\.(writeFile|createWriteStream|appendFile)|open\s*\(.*["']w/i;
const USER_INPUT_RE             = /Request\.|input\.|param\.|req\.body|req\.query|req\.params/i;

class SecurityEvidenceEngine {

  gatherEvidence(sourceFiles, dependencyGraph, scope, languages) {
    const allCandidates = [];
    const domain = this._emptyDomainEvidence();

    for (const file of sourceFiles) {
      if (!file.content || !file.content.trim()) continue;
      const isTest = /test|spec|mock|fixture/i.test(file.path);
      this._scanFile(file.path, file.content, isTest, allCandidates, domain);
    }

    // Rank candidates and cap at MAX_CANDIDATES
    allCandidates.sort((a, b) => b.score - a.score);
    const candidates = allCandidates.slice(0, MAX_CANDIDATES).map(({ score, ...rest }) => rest);

    return {
      scope,
      fileCount: sourceFiles.length,
      languages,
      candidates,
      domainEvidence: domain,
    };
  }

  // ── Per-file scan ─────────────────────────────────────────────────────────

  _scanFile(filePath, content, isTest, candidates, domain) {
    const lower = content.toLowerCase();
    const fileName = filePath.split(/[/\\]/).pop() ?? filePath;

    // ── Secrets ──────────────────────────────────────────────────────────────
    for (const { re, label, desc, score } of SECRET_PATTERNS) {
      if (re.test(content)) {
        domain.secrets.hardcodedHits++;
        const loc = this._extractFunctionSnippet(content, re);
        const candidate = { file: filePath, pattern: label, patternDescription: desc, score, ...loc };
        candidates.push(candidate);
        if (domain.secrets.examples.length < 2) domain.secrets.examples.push({ file: filePath, pattern: label, patternDescription: desc, ...loc });
        break; // one secret finding per file
      }
    }
    for (const re of ENV_VAR_PATTERNS)         { if (re.test(content)) { domain.secrets.envVarRefs++;        break; } }
    for (const re of SECRETS_MANAGER_PATTERNS) { if (re.test(content)) { domain.secrets.secretsManagerRefs++; break; } }

    // ── SQL injection ─────────────────────────────────────────────────────────
    const hasSqlContext = SQL_CONTEXT_KEYWORDS.some(k => lower.includes(k));
    if (hasSqlContext) {
      for (const re of SQL_CONCAT_PATTERNS) {
        if (re.test(content)) {
          domain.dataAccess.concatenatedCount++;
          const loc = this._extractFunctionSnippet(content, re);
          const candidate = { file: filePath, pattern: 'sql-concat', patternDescription: 'string concatenation in SQL query context', score: CONFIDENCE.SQL_CONCAT, ...loc };
          candidates.push(candidate);
          break;
        }
      }
    }

    // ── Data access positive signals ──────────────────────────────────────────
    if (!domain.dataAccess.ormDetected) {
      for (const { re, name } of ORM_PATTERNS) {
        if (re.test(content)) { domain.dataAccess.ormDetected = name; break; }
      }
    }
    for (const re of PARAMETERISED_PATTERNS) { if (re.test(content)) { domain.dataAccess.parameterisedCount++; break; } }
    for (const re of STORED_PROC_PATTERNS)   { if (re.test(content)) { domain.dataAccess.storedProcedureCount++; break; } }

    // ── Authentication ────────────────────────────────────────────────────────
    if (!domain.authentication.frameworkDetected) {
      for (const { re, name } of AUTH_FRAMEWORK_PATTERNS) {
        if (re.test(content)) { domain.authentication.frameworkDetected = name; break; }
      }
    }
    for (const re of AUTH_PROTECT_PATTERNS)   { if (re.test(content)) { domain.authentication.protectedSurfaces++;  break; } }
    for (const re of AUTH_MIDDLEWARE_PATTERNS) { if (re.test(content)) { domain.authentication.middlewareFound = true; break; } }

    // Count unprotected HTTP verb methods — each verb decoration without [Authorize] nearby
    const httpVerbMatches = content.match(/\[(HttpGet|HttpPost|HttpPut|HttpDelete|HttpPatch)\]|@(Get|Post|Put|Delete|Patch)\s*\(/gi) ?? [];
    if (httpVerbMatches.length > 0 && !content.includes('[Authorize]') && !content.includes('[AllowAnonymous]')) {
      const unprotected = httpVerbMatches.length;
      if (unprotected > 0) {
        domain.authentication.unprotectedHttpVerbs += unprotected;
        const loc = this._extractFunctionSnippet(content, HTTP_VERB_PATTERNS[0]);
        candidates.push({ file: filePath, pattern: 'missing-auth', patternDescription: `${unprotected} HTTP endpoint(s) with no [Authorize] decoration`, score: CONFIDENCE.MISSING_AUTH, ...loc });
      }
    }

    // ── Authorization ─────────────────────────────────────────────────────────
    for (const re of AUTHZ_ROLE_PATTERNS)       { if (re.test(content)) { domain.authorization.roleScopedCount++;     break; } }
    for (const re of AUTHZ_POLICY_PATTERNS)     { if (re.test(content)) { domain.authorization.policyScopedCount++;   break; } }
    for (const re of AUTHZ_PERMISSION_PATTERNS) { if (re.test(content)) { domain.authorization.permissionCheckCount++; break; } }
    // Presence-only: [Authorize] without role/policy
    if (/\[Authorize\](?!\s*\()/.test(content)) domain.authorization.presenceOnlyCount++;

    // ── Input validation ──────────────────────────────────────────────────────
    if (!domain.inputValidation.frameworkDetected) {
      for (const { re, name } of VALIDATION_FRAMEWORK_PATTERNS) {
        if (re.test(content)) { domain.inputValidation.frameworkDetected = name; break; }
      }
    }
    for (const re of VALIDATION_ATTR_PATTERNS) { if (re.test(content)) { domain.inputValidation.validationAttributes++; break; } }
    for (const re of GUARD_CLAUSE_PATTERNS)    { if (re.test(content)) { domain.inputValidation.guardClauseCount++;      break; } }
    // Unvalidated entry: HTTP verb with no visible validation pattern in same file
    if (UNVALIDATED_ENTRY_RE.test(content)) {
      const hasValidation = VALIDATION_ATTR_PATTERNS.some(re => re.test(content)) ||
                            VALIDATION_FRAMEWORK_PATTERNS.some(({ re }) => re.test(content)) ||
                            GUARD_CLAUSE_PATTERNS.some(re => re.test(content));
      if (!hasValidation) domain.inputValidation.unvalidatedEntryPoints++;
    }

    // ── Logging ───────────────────────────────────────────────────────────────
    if (!domain.logging.frameworkDetected) {
      for (const { re, name } of LOG_FRAMEWORK_PATTERNS) {
        if (re.test(content)) { domain.logging.frameworkDetected = name; break; }
      }
    }
    if (STRUCTURED_LOG_RE.test(content) && LOG_CALL_RE.test(content)) domain.logging.structuredLoggingUsed = true;
    if (!isTest && RAW_CONSOLE_RE.test(content)) domain.logging.rawConsoleLogCount++;

    // Sensitive-adjacent log: log call + sensitive field name in same file
    if (LOG_CALL_RE.test(content) && SENSITIVE_FIELD_RE.test(content)) {
      domain.logging.sensitiveAdjacentCount++;
      if (domain.logging.examples.length < 2) {
        const loc = this._extractFunctionSnippet(content, LOG_CALL_RE);
        domain.logging.examples.push({ file: filePath, pattern: 'sensitive-log', patternDescription: 'log call in file containing sensitive field names', ...loc });
        candidates.push({ file: filePath, pattern: 'sensitive-log', patternDescription: 'log call in file containing sensitive field names', score: CONFIDENCE.SENSITIVE_LOG, ...loc });
      }
    }

    // ── Error handling ────────────────────────────────────────────────────────
    const tryCatches = (content.match(TRY_CATCH_RE) ?? []).length;
    domain.errorHandling.tryCatchCount += tryCatches;
    const emptyCatches = (content.match(EMPTY_CATCH_RE) ?? []).length;
    domain.errorHandling.emptyCatchCount += emptyCatches;
    if (!domain.errorHandling.globalHandlerFound) {
      for (const re of GLOBAL_HANDLER_PATTERNS) {
        if (re.test(content)) { domain.errorHandling.globalHandlerFound = true; break; }
      }
    }
    domain.errorHandling.stackExposureCount += (content.match(STACK_EXPOSURE_RE) ?? []).length;

    // ── Cryptography ──────────────────────────────────────────────────────────
    for (const { re, label } of WEAK_CRYPTO_PATTERNS) {
      if (re.test(content) && !domain.cryptography.weakAlgorithms.includes(label)) {
        domain.cryptography.weakAlgorithms.push(label);
        const loc = this._extractFunctionSnippet(content, re);
        domain.cryptography.examples.push({ file: filePath, pattern: 'weak-crypto', patternDescription: `${label} usage detected`, ...loc });
        candidates.push({ file: filePath, pattern: 'weak-crypto', patternDescription: `${label} usage detected`, score: CONFIDENCE.WEAK_CRYPTO, ...loc });
      }
    }
    for (const re of STRONG_CRYPTO_PATTERNS) {
      const m = content.match(re);
      if (m && !domain.cryptography.strongAlgorithms.includes(m[0])) {
        domain.cryptography.strongAlgorithms.push(m[0]);
      }
    }
    if (/(?:IV|iv|salt)\s*=\s*["'\[{]/.test(content) && /encrypt|cipher|aes|rsa/i.test(content)) {
      domain.cryptography.hardcodedIvOrKey++;
    }

    // ── File operations ───────────────────────────────────────────────────────
    if (FILE_OP_RE.test(content) && USER_INPUT_RE.test(content)) {
      const loc = this._extractFunctionSnippet(content, FILE_OP_RE);
      candidates.push({ file: filePath, pattern: 'unsafe-file-op', patternDescription: 'file operation in file with user input references', score: CONFIDENCE.UNSAFE_FILE_OP, ...loc });
    }
  }

  // ── Function-scoped snippet extraction ───────────────────────────────────────
  // Walks backward from the match line to the nearest function/method declaration,
  // forward to the matching closing brace. Capped at 30 lines.

  _extractFunctionSnippet(content, pattern) {
    const match = pattern.exec(content);
    if (!match) return { snippet: '', lineStart: 1, lineEnd: 1 };

    const lines = content.split('\n');
    let pos = 0;
    let matchLine = 0;
    for (let i = 0; i < lines.length; i++) {
      if (pos + lines[i].length >= match.index) { matchLine = i; break; }
      pos += lines[i].length + 1;
    }

    // Walk backward to find function declaration
    const FUNC_RE = /(?:public|private|protected|internal|static|async|def|function|fun)\s+\w+\s*\(|(?:const|let|var)\s+\w+\s*=\s*(?:async\s*)?\(/;
    let start = matchLine;
    for (let i = matchLine; i >= Math.max(0, matchLine - 20); i--) {
      if (FUNC_RE.test(lines[i])) { start = i; break; }
    }

    // Walk forward to closing brace, cap at 30 lines total
    const maxEnd = Math.min(lines.length - 1, start + 29);
    let depth = 0;
    let end = maxEnd;
    for (let i = start; i <= maxEnd; i++) {
      for (const ch of lines[i]) {
        if (ch === '{') depth++;
        if (ch === '}') { depth--; if (depth <= 0 && i > matchLine) { end = i; break; } }
      }
      if (end < maxEnd && end >= matchLine) break;
    }

    return {
      snippet: lines.slice(start, end + 1).join('\n'),
      lineStart: start + 1,
      lineEnd: end + 1,
    };
  }

  // ── Empty domain evidence object ──────────────────────────────────────────

  _emptyDomainEvidence() {
    return {
      secrets: {
        envVarRefs: 0,
        secretsManagerRefs: 0,
        hardcodedHits: 0,
        examples: [],
      },
      inputValidation: {
        frameworkDetected: null,
        validationAttributes: 0,
        guardClauseCount: 0,
        unvalidatedEntryPoints: 0,
      },
      authentication: {
        frameworkDetected: null,
        protectedSurfaces: 0,
        unprotectedHttpVerbs: 0,
        middlewareFound: false,
      },
      authorization: {
        roleScopedCount: 0,
        policyScopedCount: 0,
        presenceOnlyCount: 0,
        permissionCheckCount: 0,
      },
      dataAccess: {
        ormDetected: null,
        parameterisedCount: 0,
        concatenatedCount: 0,
        storedProcedureCount: 0,
      },
      logging: {
        frameworkDetected: null,
        structuredLoggingUsed: false,
        sensitiveAdjacentCount: 0,
        rawConsoleLogCount: 0,
        examples: [],
      },
      errorHandling: {
        tryCatchCount: 0,
        emptyCatchCount: 0,
        globalHandlerFound: false,
        stackExposureCount: 0,
      },
      cryptography: {
        strongAlgorithms: [],
        weakAlgorithms: [],
        hardcodedIvOrKey: 0,
        examples: [],
      },
    };
  }
}

module.exports = { SecurityEvidenceEngine };
