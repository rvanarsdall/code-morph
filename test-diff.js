// Simple test to debug the tokenizer and diff algorithm

// Simplified versions of the functions for testing
function createContentSignature(token) {
  return `${token.type}:${token.content}`;
}

function tokenizeCode(code, language) {
  const tokens = [];

  if (language === "html") {
    const htmlRegex = /(<\/?[a-zA-Z][^>]*>)|(\s+)|([^<\s]+)/g;
    let match;

    while ((match = htmlRegex.exec(code)) !== null) {
      const content = match[0];
      const startPos = match.index;

      if (match[1]) {
        // HTML tag - parse it for attributes
        const tagContent = content;
        const tagRegex =
          /(<\/?[a-zA-Z][a-zA-Z0-9]*)|(\s+)|([a-zA-Z-]+)(=)("[^"]*"|'[^']*'|[^\s>]+)?|(>)/g;
        let tagMatch;
        let lastIndex = 0;
        let subIndex = 0;

        while ((tagMatch = tagRegex.exec(tagContent)) !== null) {
          const part = tagMatch[0];
          let type = "tag";

          if (tagMatch[1]) {
            type = "tag";
          } else if (tagMatch[2]) {
            type = "whitespace";
          } else if (tagMatch[3]) {
            type = "attribute";
          } else if (tagMatch[4]) {
            type = "operator";
          } else if (tagMatch[5]) {
            type = "string";
          } else if (tagMatch[6]) {
            type = "tag";
          }

          if (part) {
            tokens.push({
              type,
              content: part,
              id: `${type}-${startPos}-${subIndex}-${part.replace(/[<>/\s"'=]/g, "_").substring(0, 10)}`,
            });
            subIndex++;
          }

          lastIndex = tagMatch.index + tagMatch[0].length;
        }

        // Handle any remaining content
        if (lastIndex < tagContent.length) {
          const remaining = tagContent.substring(lastIndex);
          if (remaining) {
            tokens.push({
              type: "tag",
              content: remaining,
              id: `tag-${startPos}-${subIndex}-${remaining.replace(/[<>/\s"'=]/g, "_").substring(0, 10)}`,
            });
          }
        }
      } else if (match[2]) {
        // Whitespace
        tokens.push({
          type: "whitespace",
          content: content,
          id: `whitespace-${startPos}-${content.length}`,
        });
      } else {
        // Regular text content
        tokens.push({
          type: "text",
          content: content,
          id: `text-${startPos}-${content.replace(/\s/g, "_").substring(0, 10)}`,
        });
      }
    }
  } else {
    // For other languages, split by words and operators
    const generalRegex =
      /(\s+)|([a-zA-Z_][a-zA-Z0-9_]*)|([0-9]+\.?[0-9]*)|([{}[\]();,.:=+\-*/%<>!&|]+)|(.)/g;
    let match;

    while ((match = generalRegex.exec(code)) !== null) {
      const content = match[0];
      const startPos = match.index;
      let type = "text";

      if (match[1]) type = "whitespace";
      else if (match[2]) {
        // Check if it's a keyword
        const keywords = [
          "function",
          "const",
          "let",
          "var",
          "if",
          "else",
          "for",
          "while",
          "return",
          "class",
          "import",
          "export",
        ];
        type = keywords.includes(content) ? "keyword" : "text";
      } else if (match[3]) type = "number";
      else if (match[4]) type = "operator";

      tokens.push({
        type,
        content,
        id: `${type}-${startPos}-${content.replace(/\s/g, "_")}`,
      });
    }
  }

  return tokens;
}

function findLongestCommonSubsequence(oldTokens, newTokens) {
  const result = [];
  const usedOldIndices = new Set();

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

// Test the HTML attribute case - this should show proper animation
const oldCode = "<h1>Hello World</h1>";
const newCode = '<h1 class="header-text">Hello World</h1>';

console.log("=== TESTING HTML ATTRIBUTE ADDITION ===");
console.log("OLD:", JSON.stringify(oldCode));
console.log("NEW:", JSON.stringify(newCode));

const oldTokens = tokenizeCode(oldCode, "html");
const newTokens = tokenizeCode(newCode, "html");

console.log("\nOLD TOKENS:");
oldTokens.forEach((token, i) => {
  console.log(`  ${i}: ${token.type}:'${token.content}' (ID: ${token.id})`);
});

console.log("\nNEW TOKENS:");
newTokens.forEach((token, i) => {
  console.log(`  ${i}: ${token.type}:'${token.content}' (ID: ${token.id})`);
});

const lcs = findLongestCommonSubsequence(oldTokens, newTokens);

console.log("\nLCS MATCHES:");
lcs.forEach((match) => {
  console.log(
    `  NEW[${match.newIndex}] -> OLD[${match.oldIndex}]: ${newTokens[match.newIndex].type}:'${newTokens[match.newIndex].content}'`
  );
});

console.log("\nFINAL RESULT:");
for (let i = 0; i < newTokens.length; i++) {
  const matchedItem = lcs.find((match) => match.newIndex === i);
  const action = matchedItem ? "KEEP" : "ADD";

  // If matched, show that we'd use the old token's ID
  if (matchedItem) {
    const oldToken = oldTokens[matchedItem.oldIndex];
    console.log(
      `  ${action}: ${newTokens[i].type}:'${newTokens[i].content}' (OLD ID: ${oldToken.id} -> NEW ID: ${newTokens[i].id})`
    );
  } else {
    console.log(
      `  ${action}: ${newTokens[i].type}:'${newTokens[i].content}' (NEW ID: ${newTokens[i].id})`
    );
  }
}
