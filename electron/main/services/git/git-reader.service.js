const fs = require('fs');
const path = require('path');

/**
 * Reads git metadata from a repository's .git directory.
 * All reads are synchronous and non-throwing — missing or malformed data
 * returns null fields rather than crashing the add/open flow.
 *
 * @param {string} repoPath  Absolute path to the repository root
 * @returns {{ gitBranch: string|null, gitUrl: string|null }}
 */
function readGitMetadata(repoPath) {
  const gitDir = path.join(repoPath, '.git');

  return {
    gitBranch: readBranch(gitDir),
    gitUrl: readOriginUrl(gitDir),
  };
}

function readBranch(gitDir) {
  try {
    const headPath = path.join(gitDir, 'HEAD');
    const content = fs.readFileSync(headPath, 'utf8').trim();
    // "ref: refs/heads/main" → "main"
    const match = content.match(/^ref: refs\/heads\/(.+)$/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

function readOriginUrl(gitDir) {
  try {
    const configPath = path.join(gitDir, 'config');
    const content = fs.readFileSync(configPath, 'utf8');

    // Find [remote "origin"] section and extract the url = line
    const remoteOriginIndex = content.indexOf('[remote "origin"]');
    if (remoteOriginIndex === -1) return null;

    const afterRemote = content.slice(remoteOriginIndex);
    // Stop at the next section header (line starting with '[')
    const nextSection = afterRemote.slice(1).search(/^\[/m);
    const section = nextSection === -1 ? afterRemote : afterRemote.slice(0, nextSection + 1);

    const urlMatch = section.match(/^\s*url\s*=\s*(.+)$/m);
    return urlMatch ? urlMatch[1].trim() : null;
  } catch {
    return null;
  }
}

module.exports = { readGitMetadata };
