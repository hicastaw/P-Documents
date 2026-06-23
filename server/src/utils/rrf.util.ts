/**
 * Reciprocal Rank Fusion — combines multiple ranked lists (e.g. vector +
 * keyword search results) into one, instead of picking only one source.
 * score(id) = Σ over lists containing id of 1 / (k + rank), rank is 1-based.
 */
export function fuseRRF<T extends string>(
  rankedLists: { id: T; rank: number }[][],
  k = 60,
): { id: T; score: number }[] {
  const scores = new Map<T, number>();
  for (const list of rankedLists) {
    for (const { id, rank } of list) {
      scores.set(id, (scores.get(id) ?? 0) + 1 / (k + rank));
    }
  }
  return [...scores.entries()]
    .map(([id, score]) => ({ id, score }))
    .sort((a, b) => b.score - a.score);
}
