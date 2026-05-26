// Minimal picomatch-style glob matcher.
//
// Why not pull in `picomatch`: Track 1 has only two glob features in practice
// — `*` (single segment, no `/`) and `**` (any number of segments). Adding a
// dep for one regex would be overkill, and we already enforce the syntax
// rules in PolicyRule validation.
//
// Supported syntax:
//   contracts/**          → any file under contracts/
//   src/auth/**           → any file under src/auth/
//   src/*.ts              → any *.ts directly under src/
//   src/**/*.test.ts      → any *.test.ts at any depth under src/
//   **/Cargo.toml         → any Cargo.toml at any depth
// Brace expansion (`{ts,tsx}`) is intentionally not supported — callers must
// add separate rules for each extension.

export function matchPath(filePath: string, pattern: string): boolean {
  if (!filePath || !pattern) return false;

  // Normalize: leading "./" → "", strip leading "/"
  const f = filePath.replace(/^\.\/+/, '').replace(/^\/+/, '');
  const p = pattern.replace(/^\.\/+/, '').replace(/^\/+/, '');

  const re = globToRegex(p);
  return re.test(f);
}

export function anyMatch(filePaths: readonly string[], pattern: string): boolean {
  for (const fp of filePaths) {
    if (matchPath(fp, pattern)) return true;
  }
  return false;
}

function escapeRegex(s: string): string {
  return s.replace(/[.+^${}()|[\]\\]/g, '\\$&');
}

function globToRegex(glob: string): RegExp {
  // Tokenize, then expand globstars / wildcards into regex fragments.
  const segments = glob.split('/');
  const parts: string[] = [];

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];

    if (seg === '**') {
      // Greedy: match any number of segments (including zero).
      // Followed by `/` in the glob → consume the trailing slash too.
      const nextExists = i < segments.length - 1;
      if (nextExists) {
        // `**/foo` → matches `foo` and `bar/foo` etc.
        parts.push('(?:.*/)?');
      } else {
        // Trailing `**` → matches anything (including empty)
        parts.push('.*');
      }
      continue;
    }

    // Segment with `*` (and possibly literal chars)
    let regex = '';
    for (const ch of seg) {
      if (ch === '*') regex += '[^/]*';
      else regex += escapeRegex(ch);
    }
    parts.push(regex);
    if (i < segments.length - 1) parts.push('/');
  }

  // Stitch: collapse "(?:.*/)?/" → "(?:.*/)?" because our globstar already
  // accounted for the trailing slash.
  let assembled = parts.join('');
  assembled = assembled.replace(/\(\?:\.\*\/\)\?\//g, '(?:.*/)?');

  return new RegExp(`^${assembled}$`);
}
