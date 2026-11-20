/** Suggest a fix for a mistyped common email domain (gmial.com → gmail.com). Client-side hint only. */
const COMMON = ["gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "icloud.com", "ymail.com", "live.com"];

function distance(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
        i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1] ? dp[i - 2][j - 2] + 1 : Infinity);
  return dp[a.length][b.length];
}

export function suggestEmail(email: string): string | null {
  const at = email.lastIndexOf("@");
  if (at < 1) return null;
  const domain = email.slice(at + 1).trim().toLowerCase();
  if (!domain || COMMON.includes(domain)) return null;
  const fixed = domain.replace(/\.(con|cpm|comm|om|co|cm)$/, ".com");
  let best: string | null = COMMON.includes(fixed) ? fixed : null;
  if (!best) {
    let bestD = 3;
    for (const c of COMMON) {
      const d = distance(fixed, c);
      if (d < bestD) { bestD = d; best = c; }
    }
  }
  return best ? `${email.slice(0, at)}@${best}` : null;
}
