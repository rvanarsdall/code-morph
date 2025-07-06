import { tokenizeCode } from "./tokenizer";
import { computeDiff } from "./diffAlgorithm";
import { CodeToken } from "./types";

// Test case for HTML attribute changes
function testHtmlAttributeChange() {
  console.log("Testing HTML attribute change...");

  const oldCode = `<h1>Hello World</h1>`;
  const newCode = `<h1 class="header-text">Hello World</h1>`;

  const oldTokens = tokenizeCode(oldCode, "html");
  const newTokens = tokenizeCode(newCode, "html");

  console.log(
    "Old tokens:",
    oldTokens.map((t: CodeToken) => `${t.type}:"${t.content}"`)
  );
  console.log(
    "New tokens:",
    newTokens.map((t: CodeToken) => `${t.type}:"${t.content}"`)
  );

  const diff = computeDiff(oldTokens, newTokens);

  console.log("\nDiff results:");
  diff.forEach((token, i) => {
    console.log(`${i}: ${token.status} - ${token.type}:"${token.content}"`);
  });

  // Expected: Only the space and class="header-text" should be added
  // The <h1>, >Hello World<, and /h1> should be unchanged

  const unchanged = diff.filter((t) => t.status === "unchanged");
  const added = diff.filter((t) => t.status === "added");
  const removed = diff.filter((t) => t.status === "removed");

  console.log(
    `\nSummary: ${unchanged.length} unchanged, ${added.length} added, ${removed.length} removed`
  );

  return { diff, unchanged, added, removed };
}

// Test case for simple text addition
function testSimpleTextChange() {
  console.log("\n\nTesting simple text change...");

  const oldCode = `Hello World`;
  const newCode = `Hello Beautiful World`;

  const oldTokens = tokenizeCode(oldCode, "text");
  const newTokens = tokenizeCode(newCode, "text");

  console.log(
    "Old tokens:",
    oldTokens.map((t: CodeToken) => `${t.type}:"${t.content}"`)
  );
  console.log(
    "New tokens:",
    newTokens.map((t: CodeToken) => `${t.type}:"${t.content}"`)
  );

  const diff = computeDiff(oldTokens, newTokens);

  console.log("\nDiff results:");
  diff.forEach((token, i) => {
    console.log(`${i}: ${token.status} - ${token.type}:"${token.content}"`);
  });

  return diff;
}

// Run tests
export function runDiffTests() {
  testHtmlAttributeChange();
  testSimpleTextChange();
}
