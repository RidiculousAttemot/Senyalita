export interface TokenizedResult {
  tokens: string[];
  sentences: string[];
}

export function tokenize(text: string): TokenizedResult {
  const sentences = text
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const tokens = text
    .toLowerCase()
    .replace(/[^\w\s'-ñáéíóú]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 0);

  return { tokens, sentences };
}
