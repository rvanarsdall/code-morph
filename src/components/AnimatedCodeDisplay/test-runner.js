// Simple CommonJS test runner to debug the diff algorithm
const fs = require("fs");
const path = require("path");

// Read and eval the compiled modules (this is a hack but will work for testing)
console.log("Running diff algorithm test...");

// Test case for HTML attribute changes
function testHtmlAttributeChange() {
  console.log("=== Testing HTML attribute change ===");

  const oldCode = `<h1>Hello World</h1>`;
  const newCode = `<h1 class="header-text">Hello World</h1>`;

  console.log(`OLD: "${oldCode}"`);
  console.log(`NEW: "${newCode}"`);

  // Simple tokenization for testing
  function simpleTokenize(code) {
    const tokens = [];
    const htmlRegex = /(<\/?[a-zA-Z][^>]*>)|(\s+)|([^<\s]+)/g;
    let match;
    let position = 0;

    while ((match = htmlRegex.exec(code)) !== null) {
      const content = match[0];
      const startPos = match.index;

      if (match[1]) {
        // HTML tag - parse for attributes
        const tagContent = content;
        if (tagContent.includes(" ")) {
          // Tag with attributes - split it up
          const parts = tagContent.match(
            /(<[a-zA-Z]+)|(\s+)|([a-zA-Z-]+="[^"]*")|([a-zA-Z-]+)|([=>])/g
          ) || [tagContent];
          parts.forEach((part, i) => {
            if (part.trim()) {
              let type = "tag";
              if (part.match(/^\s+$/)) type = "whitespace";
              else if (part.match(/^[a-zA-Z-]+="[^"]*"$/)) type = "attribute";

              tokens.push({
                type,
                content: part,
                id: `${type}-${startPos}-${i}-${part.replace(/[<>/\s"'=]/g, "_").substring(0, 10)}`,
              });
            }
          });
        } else {
          tokens.push({
            type: "tag",
            content: content,
            id: `tag-${startPos}-${content.replace(/[<>/\s"'=]/g, "_").substring(0, 10)}`,
          });
        }
      } else if (match[2]) {
        tokens.push({
          type: "whitespace",
          content: content,
          id: `whitespace-${startPos}-${content.length}`,
        });
      } else {
        tokens.push({
          type: "text",
          content: content,
          id: `text-${startPos}-${content.replace(/\s/g, "_").substring(0, 10)}`,
        });
      }
    }

    return tokens;
  }

  const oldTokens = simpleTokenize(oldCode);
  const newTokens = simpleTokenize(newCode);

  console.log("\nOLD TOKENS:");
  oldTokens.forEach((t, i) => {
    console.log(`  ${i}: ${t.type}:'${t.content}' (ID: ${t.id})`);
  });

  console.log("\nNEW TOKENS:");
  newTokens.forEach((t, i) => {
    console.log(`  ${i}: ${t.type}:'${t.content}' (ID: ${t.id})`);
  });

  // Simple LCS-based diff
  function simpleDiff(oldTokens, newTokens) {
    const result = [];
    const used = new Set();

    // Find matches
    for (let i = 0; i < newTokens.length; i++) {
      const newToken = newTokens[i];
      let matched = false;

      for (let j = 0; j < oldTokens.length; j++) {
        if (used.has(j)) continue;

        const oldToken = oldTokens[j];
        if (
          oldToken.type === newToken.type &&
          oldToken.content === newToken.content
        ) {
          result.push({
            ...newToken,
            id: oldToken.id, // Preserve old ID
            status: "unchanged",
            oldIndex: j,
            newIndex: i,
          });
          used.add(j);
          matched = true;
          break;
        }
      }

      if (!matched) {
        result.push({
          ...newToken,
          status: "added",
          newIndex: i,
        });
      }
    }

    // Add removed tokens
    for (let j = 0; j < oldTokens.length; j++) {
      if (!used.has(j)) {
        result.push({
          ...oldTokens[j],
          status: "removed",
          oldIndex: j,
          newIndex: -1,
        });
      }
    }

    return result;
  }

  const diff = simpleDiff(oldTokens, newTokens);

  console.log("\nDIFF RESULTS:");
  diff.forEach((token, i) => {
    console.log(
      `  ${i}: ${token.status.toUpperCase()} - ${token.type}:'${token.content}'`
    );
  });

  const unchanged = diff.filter((t) => t.status === "unchanged");
  const added = diff.filter((t) => t.status === "added");
  const removed = diff.filter((t) => t.status === "removed");

  console.log(
    `\nSUMMARY: ${unchanged.length} unchanged, ${added.length} added, ${removed.length} removed`
  );

  return { diff, unchanged, added, removed };
}

// Run the test
testHtmlAttributeChange();
