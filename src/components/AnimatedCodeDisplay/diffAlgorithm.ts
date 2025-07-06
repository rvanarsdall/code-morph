import { CodeToken } from "./types";

// Enhanced diff result token
export interface DiffToken extends CodeToken {
  status: "added" | "removed" | "unchanged";
  oldIndex?: number;
  newIndex: number;
}

/**
 * Create a content signature for matching tokens
 */
function createContentSignature(token: CodeToken): string {
  return `${token.type}:${token.content}`;
}

/**
 * Find longest common subsequence using the working algorithm from test-diff.js
 */
function findLongestCommonSubsequence(
  oldTokens: CodeToken[],
  newTokens: CodeToken[]
): Array<{ oldIndex: number; newIndex: number }> {
  const result: Array<{ oldIndex: number; newIndex: number }> = [];
  const usedOldIndices = new Set<number>();

  // First pass: Find exact sequential matches from the beginning
  let oldIdx = 0;
  let newIdx = 0;

  // Match tokens sequentially from the start
  while (oldIdx < oldTokens.length && newIdx < newTokens.length) {
    const oldSig = createContentSignature(oldTokens[oldIdx]);
    const newSig = createContentSignature(newTokens[newIdx]);

    if (oldSig === newSig) {
      result.push({ oldIndex: oldIdx, newIndex: newIdx });
      usedOldIndices.add(oldIdx);
      oldIdx++;
      newIdx++;
    } else {
      // Don't advance both indices automatically for whitespace differences
      // This was causing the '}' to not be matched properly
      // Instead, only advance the new index to look for insertions
      newIdx++;

      // If we've exhausted new tokens but still have old tokens,
      // try to find the remaining old tokens later in the new sequence
      if (newIdx >= newTokens.length && oldIdx < oldTokens.length) {
        break;
      }
    }
  }

  // Second pass: Find matches for remaining new tokens, but be more conservative
  for (let newIndex = 0; newIndex < newTokens.length; newIndex++) {
    // Skip if we already matched this new token
    if (result.some((r) => r.newIndex === newIndex)) continue;

    const newToken = newTokens[newIndex];
    const newSig = createContentSignature(newToken);

    // Look for matching old tokens that haven't been used
    let bestMatch = -1;
    let bestScore = -1;

    for (let oldIndex = 0; oldIndex < oldTokens.length; oldIndex++) {
      if (usedOldIndices.has(oldIndex)) continue;

      const oldToken = oldTokens[oldIndex];
      const oldSig = createContentSignature(oldToken);

      // For exact matches or whitespace-to-whitespace matches
      const isMatch =
        oldSig === newSig ||
        (oldToken.type === "whitespace" && newToken.type === "whitespace");

      if (isMatch) {
        // Check if this match maintains order relative to existing matches
        let maintainsOrder = true;
        for (const existingMatch of result) {
          if (
            existingMatch.newIndex < newIndex &&
            existingMatch.oldIndex > oldIndex
          ) {
            maintainsOrder = false;
            break;
          }
          if (
            existingMatch.newIndex > newIndex &&
            existingMatch.oldIndex < oldIndex
          ) {
            maintainsOrder = false;
            break;
          }
        }

        if (!maintainsOrder) continue;

        // Calculate proximity score
        const expectedOldPosition =
          (newIndex / newTokens.length) * oldTokens.length;
        const distance = Math.abs(oldIndex - expectedOldPosition);
        const maxDistance = Math.max(oldTokens.length, newTokens.length);
        const proximityScore = 1 - distance / maxDistance;

        // Give bonus for exact content matches
        const contentBonus = oldSig === newSig ? 0.2 : 0;
        const score = proximityScore + contentBonus;

        if (score > bestScore) {
          bestScore = score;
          bestMatch = oldIndex;
        }
      }
    }

    // Only accept the match if it has a reasonable score
    if (bestMatch !== -1 && bestScore > 0.3) {
      result.push({ oldIndex: bestMatch, newIndex: newIndex });
      usedOldIndices.add(bestMatch);
    }
  }

  // Sort by newIndex to maintain order
  result.sort((a, b) => a.newIndex - b.newIndex);

  return result;
}

/**
 * Compute the diff between old and new tokens using the working algorithm from test-diff.js
 */
export function computeDiff(
  oldTokens: CodeToken[],
  newTokens: CodeToken[]
): DiffToken[] {
  // Handle empty cases
  if (oldTokens.length === 0) {
    return newTokens.map((token, index) => ({
      ...token,
      status: "added" as const,
      newIndex: index,
    }));
  }

  if (newTokens.length === 0) {
    return oldTokens.map((token, index) => ({
      ...token,
      status: "removed" as const,
      oldIndex: index,
      newIndex: -1,
    }));
  }

  // Find matches using the working LCS algorithm
  const lcs = findLongestCommonSubsequence(oldTokens, newTokens);

  // Build the final diff result
  const result: DiffToken[] = [];

  // Process each new token
  for (let newIndex = 0; newIndex < newTokens.length; newIndex++) {
    const newToken = newTokens[newIndex];
    const matchedItem = lcs.find((match) => match.newIndex === newIndex);

    if (matchedItem) {
      // This token matches an old token - mark as unchanged and preserve old ID
      const oldToken = oldTokens[matchedItem.oldIndex];
      result.push({
        ...newToken,
        id: oldToken.id, // Preserve old ID for React stability
        status: "unchanged",
        oldIndex: matchedItem.oldIndex,
        newIndex: newIndex,
      });
    } else {
      // This is a new token - mark as added
      result.push({
        ...newToken,
        status: "added",
        newIndex: newIndex,
      });
    }
  }

  // Add removed tokens (old tokens that don't have matches)
  const usedOldIndices = new Set(lcs.map((match) => match.oldIndex));
  for (let oldIndex = 0; oldIndex < oldTokens.length; oldIndex++) {
    if (!usedOldIndices.has(oldIndex)) {
      const oldToken = oldTokens[oldIndex];
      result.push({
        ...oldToken,
        status: "removed",
        oldIndex: oldIndex,
        newIndex: -1,
      });
    }
  }

  return result;
}
