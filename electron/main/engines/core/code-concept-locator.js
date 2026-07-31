'use strict';

/**
 * CodeConceptLocator — scans source content to find where specific learning
 * concepts are used in the analysed code.
 *
 * File scope:   returns { lineStart, lineEnd, label }[] — line ranges within the single file.
 * Folder/repo:  returns { filePaths: string[] } — top files by match density, content-scanned.
 */

// ── Concept locators ──────────────────────────────────────────────────────────
//
// Each entry maps a concept key to an array of regex patterns.
// A line is counted as a hit if any pattern matches it.

const LOCATORS = {
  'oop-design': [
    /\bclass\s+\w+\s*(?:extends\s+\w+)?\s*\{/,
    /\bconstructor\s*\(/,
    /(?:public|private|protected|static|get|set)\s+\w+\s*\(/,
    /\bextends\s+\w+|implements\s+\w+/,
    /\bsuper\s*\(/,
    /prototype\.\w+\s*=/,
  ],
  'data-transformation': [
    /\bmap\s*\(|\.filter\s*\(|\.reduce\s*\(|\.flatMap\s*\(/,
    /\.sort\s*\(|\.slice\s*\(|\.splice\s*\(/,
    /new\s+Map\s*\(|new\s+Set\s*\(|Object\.keys\s*\(|Object\.entries\s*\(/,
    /\.join\s*\(|\.split\s*\(|\.replace\s*\(/,
    /JSON\.parse\s*\(|JSON\.stringify\s*\(/,
    /\bconst\s+\w+\s*=\s*\{[^}]{0,60}\}|return\s+\{/,
  ],
  'dependency-injection': [
    /@Injectable|@Component|@Service|@Controller|@Module/,
    /constructor\s*\([^)]*:\s*\w/,
    /providers\s*:/,
    /\bDI\b|\bIoC\b/,
    /resolve\s*<|GetService\s*<|GetRequiredService\s*</,
    /\[Inject\]|\[FromServices\]/,
  ],
  'reactive-streams': [
    /Observable|Subject|BehaviorSubject|ReplaySubject|AsyncSubject/,
    /\.pipe\s*\(|\.subscribe\s*\(/,
    /\bfrom\b\s*\(|of\s*\(|combineLatest|switchMap|mergeMap|concatMap|takeUntil/,
    /Flux\.|Mono\.|@reactive/i,
  ],
  'authentication': [
    /\[Authorize\]|\[AllowAnonymous\]/i,
    /passport\.use|jwt\.verify|jwt\.sign/,
    /requireAuth|isAuthenticated|authenticate\s*\(/,
    /UseAuthentication|AddAuthentication/,
    /canActivate|AuthGuard/,
    /session\s*\.\s*user|req\.user/,
    /bearer|access_token|id_token/i,
  ],
  'authorization': [
    /\[Authorize\s*\(.*Roles|Policy/i,
    /HasPermission|IsInRole|CheckPolicy/,
    /\.AddAuthorization|\.AddPolicy/,
    /canActivate|PermissionGuard|RoleGuard/,
    /req\.user\.role|claims\[|ClaimTypes\./,
  ],
  'data-modelling': [
    /@Entity|@Table|@Column|@PrimaryKey/,
    /\[Table\]|\[Column\]|\[Key\]|\[ForeignKey\]/,
    /class\s+\w+\s+(?:extends|implements)\s+\w*(?:Entity|Model|Schema)/,
    /interface\s+\w+\s*\{[^}]*:\s*(?:string|number|boolean|Date)/,
    /Schema\s*\(\s*\{|model\s*\(\s*['"]|defineModel/,
    /mongoose\.Schema|TypeORM|Sequelize/,
  ],
  'async-patterns': [
    /\basync\s+\w+\s*\(|await\s+/,
    /new\s+Promise\s*\(|Promise\.all\s*\(|Promise\.race\s*\(/,
    /\.then\s*\(|\.catch\s*\(|\.finally\s*\(/,
    /Task\s*<|async\s+Task|await\s+Task/,
  ],
  'http-api': [
    /@Get\s*\(|@Post\s*\(|@Put\s*\(|@Delete\s*\(|@Patch\s*\(/,
    /\[HttpGet\]|\[HttpPost\]|\[HttpPut\]|\[HttpDelete\]/,
    /router\.(get|post|put|delete|patch)\s*\(/,
    /app\.(get|post|put|delete|patch)\s*\(/,
    /fetch\s*\(|axios\.(get|post|put|delete)|HttpClient/,
    /\[Route\s*\(|\[ApiController\]/,
  ],
  'state-management': [
    /createStore|configureStore|NgRx|@ngrx/,
    /useReducer|useSelector|useDispatch/,
    /Vuex|createPinia|defineStore/,
    /BehaviorSubject|StateService|Store\s*</,
    /dispatch\s*\(|selector\s*\(|reducer\s*\(/,
  ],
  'error-handling': [
    /try\s*\{|catch\s*\(\w/,
    /throw\s+new\s+\w+Error|throw\s+new\s+\w+Exception/,
    /UseExceptionHandler|app\.use\s*\(\s*\(err/,
    /GlobalExceptionFilter|IExceptionHandler/,
    /Result<|Either<|Option</,
  ],
  'testing': [
    /\bdescribe\s*\(|\bit\s*\(|\btest\s*\(/,
    /\[Test\]|\[Fact\]|\[Theory\]|\[TestMethod\]/,
    /\bexpect\s*\(|\bassert\s*\(|Assert\./,
    /\bjest\.\|vitest\.|beforeEach|afterEach/,
    /\bmock\s*\(|\bspy\s*\(|\bstub\s*\(/i,
  ],
  'security-patterns': [
    /bcrypt|argon2|PBKDF2|AES|RSA|SHA256/i,
    /sanitize|xss|csrf|cors|helmet/i,
    /encrypt|decrypt|hash\s*\(/i,
    /SECRET_KEY|JWT_SECRET|API_KEY/,
    /process\.env\.|Environment\.GetEnvironmentVariable/,
  ],
  'orm-data-access': [
    /\.find\s*\(|\.findOne\s*\(|\.findById\s*\(/,
    /\.save\s*\(|\.create\s*\(|\.update\s*\(|\.delete\s*\(/,
    /DbContext|DbSet<|IRepository|Repository</,
    /EntityFramework|TypeORM|Mongoose|Dapper|Hibernate/,
    /SELECT|INSERT|UPDATE|DELETE/,
  ],
  'frontend-components': [
    /@Component\s*\(\s*\{/,
    /React\.Component|extends\s+Component|function\s+\w+\s*\(\s*\{?\s*\}/,
    /defineComponent|createApp/,
    /template\s*:|render\s*\(/,
    /ngOnInit|ngOnDestroy|useEffect|useState/,
  ],
  'configuration': [
    /process\.env\.|\.env\./,
    /IConfiguration|config\.get\s*\(|AppSettings/,
    /appsettings\.|\.config\.|dotenv/i,
    /Environment\.GetEnvironmentVariable|ConfigurationManager/,
  ],
};

// ── Line scanner ──────────────────────────────────────────────────────────────

/**
 * Scan a source string for all lines matching any pattern for a concept.
 * Returns an array of { lineNumber (1-based), text (trimmed line content) }.
 */
function matchingLines(conceptKey, content) {
  const patterns = LOCATORS[conceptKey];
  if (!patterns || !content) return [];

  const lines = content.split('\n');
  const hits = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (patterns.some(p => p.test(line))) {
      hits.push({ lineNumber: i + 1, text: line.trim() });
    }
  }
  return hits;
}

/**
 * Merge nearby hits into contiguous ranges.
 * Lines within `gap` of each other are merged. The first hit's text becomes the range label.
 */
function mergeIntoRanges(hits, gap = 3) {
  if (hits.length === 0) return [];

  const sorted = [...hits].sort((a, b) => a.lineNumber - b.lineNumber);
  const ranges = [];
  let start = sorted[0].lineNumber;
  let end = sorted[0].lineNumber;
  let label = sorted[0].text;

  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].lineNumber <= end + gap) {
      end = sorted[i].lineNumber;
    } else {
      ranges.push({ lineStart: start, lineEnd: end, label });
      start = sorted[i].lineNumber;
      end = sorted[i].lineNumber;
      label = sorted[i].text;
    }
  }
  ranges.push({ lineStart: start, lineEnd: end, label });
  return ranges;
}

// ── Public class ──────────────────────────────────────────────────────────────

class CodeConceptLocator {

  /**
   * File scope: scan a single source string for a concept.
   * Returns up to `maxRanges` line ranges sorted by position.
   *
   * @param {string} conceptKey
   * @param {string} sourceCode
   * @param {number} maxRanges
   * @returns {{ lineStart: number, lineEnd: number }[]}
   */
  locateInFile(conceptKey, sourceCode, maxRanges = 5) {
    const hits = matchingLines(conceptKey, sourceCode);
    const ranges = mergeIntoRanges(hits);
    return ranges.slice(0, maxRanges);
  }

  /**
   * Folder/repo scope: scan multiple source files for a concept.
   * Returns the paths of the top `maxFiles` files by match density.
   *
   * @param {string} conceptKey
   * @param {{ path: string, content: string }[]} sourceFiles
   * @param {number} maxFiles
   * @returns {string[]}
   */
  locateInKnowledge(conceptKey, sourceFiles, maxFiles = 5) {
    const patterns = LOCATORS[conceptKey];
    if (!patterns || !sourceFiles?.length) return [];

    const scored = [];
    for (const file of sourceFiles) {
      if (!file.content) continue;
      const hits = matchingLines(conceptKey, file.content);
      if (hits.length > 0) {
        scored.push({ path: file.path, hits: hits.length });
      }
    }

    return scored
      .sort((a, b) => b.hits - a.hits)
      .slice(0, maxFiles)
      .map(f => f.path);
  }

  /**
   * Returns true if the locator has patterns for the given concept key.
   */
  supports(conceptKey) {
    return conceptKey in LOCATORS;
  }

  /**
   * All concept keys this locator can scan for.
   */
  get conceptKeys() {
    return Object.keys(LOCATORS);
  }
}

module.exports = { CodeConceptLocator };
