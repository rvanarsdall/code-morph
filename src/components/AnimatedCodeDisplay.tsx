import React, { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";

// Animation timing constants - adjust these to fine-tune the animation speed
const ANIMATION_TIMINGS = {
  // Phase durations (in milliseconds)
  POSITIONING_PHASE_DURATION: 600, // How long existing elements take to move into position
  ADDING_PHASE_DURATION: 2500, // How long new elements take to appear

  // Individual element animation durations (in seconds)
  EXISTING_ELEMENT_DURATION: 0.4, // How long existing elements take to animate
  NEW_ELEMENT_DURATION: 0.8, // How long new elements take to fade/scale in

  // Stagger delays (in seconds)
  NEW_ELEMENT_STAGGER_DELAY: 0.08, // Delay between each new element appearing

  // Easing functions
  EXISTING_ELEMENT_EASING: "easeInOut" as const, // Smooth for existing elements
  NEW_ELEMENT_EASING: "easeOut" as const, // More dramatic for new elements
};

interface CodeToken {
  type:
    | "tag"
    | "text"
    | "attribute"
    | "string"
    | "keyword"
    | "operator"
    | "punctuation"
    | "number"
    | "comment"
    | "whitespace";
  content: string;
  id: string;
}

interface CodeChange {
  type: "add" | "remove" | "keep" | "move";
  token: CodeToken;
  oldIndex?: number;
  newIndex: number;
  isManuallyHighlighted?: boolean; // Track if this was manually highlighted
}

interface HighlightRange {
  start: number;
  end: number;
  type: "new" | "changed" | "emphasis";
}

interface AnimatedCodeDisplayProps {
  currentCode: string;
  previousCode: string;
  language: string;
  fontSize: number;
  showLineNumbers: boolean;
  isAnimating: boolean;
  onAnimationComplete: () => void;
  // New optional prop for manual highlighting
  manualHighlights?: HighlightRange[];
  // Option to disable automatic diff and use only manual highlights
  useManualHighlightsOnly?: boolean;
}

// Auto-detect language from code content
const detectLanguage = (code: string): string => {
  if (/<[^>]+>/.test(code)) return "html";
  if (/\b(function|const|let|var|=>)\b/.test(code)) return "javascript";
  if (/\b(def|import|class|if __name__)\b/.test(code)) return "python";
  if (/\{[^}]*:[^}]*\}/.test(code)) return "css";
  if (/^\s*[\{\[]/.test(code.trim())) return "json";
  return "html"; // default
};

// Enhanced tokenizer that preserves exact content structure
const tokenizeCode = (code: string, language: string): CodeToken[] => {
  const tokens: CodeToken[] = [];

  if (language === "html") {
    // More precise HTML tokenization that handles tags and attributes separately
    const htmlRegex = /(<\/?[a-zA-Z][^>]*>)|(\s+)|([^<\s]+)/g;
    let match;

    while ((match = htmlRegex.exec(code)) !== null) {
      const content = match[0];
      const startPos = match.index; // Use actual position in code for uniqueness

      if (match[1]) {
        // HTML tag - parse it for attributes but keep closing > with the tag
        const tagContent = content;
        const tagRegex =
          /(<\/?[a-zA-Z][a-zA-Z0-9]*)|(\s+)|([a-zA-Z-]+)(=)("[^"]*"|'[^']*'|[^\s>]+)?|(>)/g;
        let tagMatch;
        let lastIndex = 0;
        let subIndex = 0;

        while ((tagMatch = tagRegex.exec(tagContent)) !== null) {
          const part = tagMatch[0];
          let type: CodeToken["type"] = "tag";

          if (tagMatch[1]) {
            // Tag name (e.g., <h1, </h1)
            type = "tag";
          } else if (tagMatch[2]) {
            // Whitespace within tag
            type = "whitespace";
          } else if (tagMatch[3]) {
            // Attribute name (class, id, etc.)
            type = "attribute";
          } else if (tagMatch[4]) {
            // Equals sign
            type = "operator";
          } else if (tagMatch[5]) {
            // Attribute value
            type = "string";
          } else if (tagMatch[6]) {
            // Closing >
            type = "tag";
          }

          if (part) {
            tokens.push({
              type,
              content: part,
              // Create stable ID based on position in source code and content
              id: `${type}-${startPos}-${subIndex}-${part.replace(/[<>/\s"'=]/g, "_").substring(0, 10)}`,
            });
            subIndex++;
          }

          lastIndex = tagMatch.index + tagMatch[0].length;
        }

        // Handle any remaining content (though there shouldn't be any with the improved regex)
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
    // Enhanced JavaScript tokenizer with comment support
    const tokens: CodeToken[] = [];
    let i = 0;

    while (i < code.length) {
      const char = code[i];
      const nextChar = code[i + 1];

      // Handle single-line comments (//)
      if (char === "/" && nextChar === "/") {
        const start = i;
        let end = i + 2;

        // Find the end of the line
        while (end < code.length && code[end] !== "\n") {
          end++;
        }

        tokens.push({
          type: "comment",
          content: code.substring(start, end),
          id: `comment-${start}-${end - start}`,
        });

        i = end;
        continue;
      }

      // Handle multi-line comments (/* */)
      if (char === "/" && nextChar === "*") {
        const start = i;
        let end = i + 2;

        // Find the end of the comment
        while (end < code.length - 1) {
          if (code[end] === "*" && code[end + 1] === "/") {
            end += 2;
            break;
          }
          end++;
        }

        tokens.push({
          type: "comment",
          content: code.substring(start, end),
          id: `comment-${start}-${end - start}`,
        });

        i = end;
        continue;
      }

      // Handle string literals
      if (char === '"' || char === "'" || char === "`") {
        const quote = char;
        const start = i;
        let end = i + 1;

        // Find the end of the string
        while (end < code.length) {
          if (code[end] === quote && code[end - 1] !== "\\") {
            end++;
            break;
          }
          end++;
        }

        tokens.push({
          type: "string",
          content: code.substring(start, end),
          id: `string-${start}-${end - start}`,
        });

        i = end;
        continue;
      }

      // Handle whitespace
      if (/\s/.test(char)) {
        const start = i;
        let end = i;

        // Collect consecutive whitespace
        while (end < code.length && /\s/.test(code[end])) {
          end++;
        }

        tokens.push({
          type: "whitespace",
          content: code.substring(start, end),
          id: `whitespace-${start}-${end - start}`,
        });

        i = end;
        continue;
      }

      // Handle numbers
      if (/[0-9]/.test(char)) {
        const start = i;
        let end = i;

        // Collect digits and decimal points
        while (end < code.length && /[0-9.]/.test(code[end])) {
          end++;
        }

        tokens.push({
          type: "number",
          content: code.substring(start, end),
          id: `number-${start}-${end - start}`,
        });

        i = end;
        continue;
      }

      // Handle operators and punctuation
      if (/[{}[\]();,.:=+\-*/%<>!&|]/.test(char)) {
        let end = i + 1;

        // Handle multi-character operators
        const twoChar = code.substring(i, i + 2);
        const threeChar = code.substring(i, i + 3);

        if (["===", "!==", ">>>", "<<=", ">>="].includes(threeChar)) {
          end = i + 3;
        } else if (
          [
            "==",
            "!=",
            "<=",
            ">=",
            "&&",
            "||",
            "++",
            "--",
            "+=",
            "-=",
            "*=",
            "/=",
            "%=",
            "<<",
            ">>",
            "=>",
            "?.",
          ].includes(twoChar)
        ) {
          end = i + 2;
        }

        tokens.push({
          type: "operator",
          content: code.substring(i, end),
          id: `operator-${i}-${end - i}`,
        });

        i = end;
        continue;
      }

      // Handle identifiers and keywords
      if (/[a-zA-Z_$]/.test(char)) {
        const start = i;
        let end = i;

        // Collect identifier characters
        while (end < code.length && /[a-zA-Z0-9_$]/.test(code[end])) {
          end++;
        }

        const content = code.substring(start, end);

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
          "default",
          "async",
          "await",
          "try",
          "catch",
          "finally",
          "throw",
          "new",
          "this",
          "super",
          "extends",
          "static",
          "public",
          "private",
          "protected",
          "interface",
          "type",
          "true",
          "false",
          "null",
          "undefined",
          "typeof",
          "instanceof",
        ];

        const type = keywords.includes(content) ? "keyword" : "text";

        tokens.push({
          type,
          content,
          id: `${type}-${start}-${content}`,
        });

        i = end;
        continue;
      }

      // Handle any other character
      tokens.push({
        type: "text",
        content: char,
        id: `text-${i}-${char}`,
      });

      i++;
    }

    return tokens;
  }

  return tokens;
};

// Apply manual highlights to override automatic diff detection
const applyManualHighlights = (
  tokens: CodeToken[],
  highlights: HighlightRange[]
): CodeChange[] => {
  const changes: CodeChange[] = [];
  let currentPos = 0;

  tokens.forEach((token, index) => {
    const tokenStart = currentPos;
    const tokenEnd = currentPos + token.content.length;

    // Check if this token overlaps with any highlight range
    const highlightOverlap = highlights.find(
      (highlight) =>
        (highlight.start >= tokenStart && highlight.start < tokenEnd) ||
        (highlight.end > tokenStart && highlight.end <= tokenEnd) ||
        (highlight.start <= tokenStart && highlight.end >= tokenEnd)
    );

    changes.push({
      type: highlightOverlap ? "add" : "keep",
      token,
      newIndex: index,
      isManuallyHighlighted: !!highlightOverlap,
    });

    currentPos = tokenEnd;
  });

  return changes;
};

// Improved diff algorithm using Longest Common Subsequence (LCS)
const calculateTokenDiff = (
  oldTokens: CodeToken[],
  newTokens: CodeToken[]
): CodeChange[] => {
  const changes: CodeChange[] = [];

  // Use simplified LCS algorithm
  const lcs = findLongestCommonSubsequence(oldTokens, newTokens);

  // Build the changes array based on LCS
  let newIndex = 0;
  let lcsIndex = 0;

  while (newIndex < newTokens.length) {
    // Check if current new token is in the LCS
    if (lcsIndex < lcs.length && newIndex === lcs[lcsIndex].newIndex) {
      // This token should be kept - find its position in old tokens
      const lcsItem = lcs[lcsIndex];
      const oldToken = oldTokens[lcsItem.oldIndex];

      changes.push({
        type: "keep",
        token: {
          ...newTokens[newIndex],
          // Use the old token's ID to maintain consistency for Framer Motion
          id: oldToken.id,
        },
        oldIndex: lcsItem.oldIndex,
        newIndex: newIndex,
      });

      lcsIndex++;
    } else {
      // This is a new token
      changes.push({
        type: "add",
        token: newTokens[newIndex],
        newIndex: newIndex,
      });
    }

    newIndex++;
  }

  return changes;
};

// Find Longest Common Subsequence between old and new tokens
function findLongestCommonSubsequence(
  oldTokens: CodeToken[],
  newTokens: CodeToken[]
): Array<{ oldIndex: number; newIndex: number }> {
  const createContentSignature = (token: CodeToken) =>
    `${token.type}:${token.content}`;

  // Use a more sophisticated approach that considers local context
  // This prevents matching tokens that are too far apart or in different contexts

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
  // Only match if tokens are reasonably close to their expected position
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
        // Calculate a score based on how close this match is to the expected position
        // and whether it maintains relative order

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

        // Calculate proximity score - prefer matches that are close to expected position
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
    // This prevents matching tokens that are too far from their expected position
    if (bestMatch !== -1 && bestScore > 0.3) {
      result.push({ oldIndex: bestMatch, newIndex: newIndex });
      usedOldIndices.add(bestMatch);
    }
  }

  // Sort by newIndex to maintain order
  result.sort((a, b) => a.newIndex - b.newIndex);

  return result;
}

const getTokenColor = (token: CodeToken): string => {
  switch (token.type) {
    case "tag":
      return "#ff6b6b";
    case "attribute":
      return "#a8e6cf";
    case "keyword":
      return "#4ecdc4";
    case "string":
      return "#95e1d3";
    case "number":
      return "#ff8b94";
    case "operator":
      return "#fce38a";
    case "comment":
      return "#6c757d";
    case "punctuation":
      return "#ffd93d";
    default:
      return "#ffffff";
  }
};

export const AnimatedCodeDisplay: React.FC<AnimatedCodeDisplayProps> = ({
  currentCode,
  previousCode,
  language: providedLanguage,
  fontSize,
  showLineNumbers,
  isAnimating,
  onAnimationComplete,
  manualHighlights = [],
  useManualHighlightsOnly = false,
}) => {
  const [animationPhase, setAnimationPhase] = useState<
    "idle" | "positioning" | "adding" | "complete"
  >("idle");

  // Auto-detect language if not provided or if it's the default
  const detectedLanguage = useMemo(() => {
    return detectLanguage(currentCode) || providedLanguage;
  }, [currentCode, providedLanguage]);

  const currentTokens = useMemo(
    () => tokenizeCode(currentCode, detectedLanguage),
    [currentCode, detectedLanguage]
  );
  const previousTokens = useMemo(
    () => tokenizeCode(previousCode, detectedLanguage),
    [previousCode, detectedLanguage]
  );

  const changes = useMemo(() => {
    if (!previousCode) {
      // No previous code, so all tokens are static (no animation)
      return currentTokens.map((token, index) => ({
        type: "keep" as const,
        token,
        newIndex: index,
      }));
    }

    if (!isAnimating) {
      // Animation is complete or not started, show all tokens as static
      return currentTokens.map((token, index) => ({
        type: "keep" as const,
        token,
        newIndex: index,
      }));
    }

    // Use manual highlights if provided, otherwise fall back to automatic diff
    if (useManualHighlightsOnly || manualHighlights.length > 0) {
      const manualChanges = applyManualHighlights(
        currentTokens,
        manualHighlights
      );

      console.log("=== MANUAL HIGHLIGHTS DEBUG ===");
      console.log("Manual highlights:", manualHighlights);
      console.log(
        "Changes:",
        manualChanges.map(
          (c) =>
            `${c.type}: ${c.token.type}:'${c.token.content}' (Manual: ${c.isManuallyHighlighted})`
        )
      );

      return manualChanges;
    }

    // Automatic diff detection
    const diff = calculateTokenDiff(previousTokens, currentTokens);

    console.log("=== AUTO DIFF DEBUG ===");
    console.log("Previous code:", JSON.stringify(previousCode));
    console.log("Current code:", JSON.stringify(currentCode));
    console.log(
      "Changes:",
      diff.map(
        (c) =>
          `${c.type}: ${c.token.type}:'${c.token.content}' (ID: ${c.token.id})`
      )
    );

    return diff;
  }, [
    previousTokens,
    currentTokens,
    previousCode,
    currentCode,
    isAnimating,
    manualHighlights,
    useManualHighlightsOnly,
  ]);

  useEffect(() => {
    if (!isAnimating) {
      setAnimationPhase("idle");
      return;
    }

    // Phase 1: Position existing elements (move/keep) - faster since these should feel stable
    setAnimationPhase("positioning");

    setTimeout(() => {
      // Phase 2: Add new elements - slower to emphasize new content for teaching
      setAnimationPhase("adding");

      setTimeout(() => {
        setAnimationPhase("complete");
        onAnimationComplete();
      }, ANIMATION_TIMINGS.ADDING_PHASE_DURATION);
    }, ANIMATION_TIMINGS.POSITIONING_PHASE_DURATION);
  }, [isAnimating, onAnimationComplete]);

  // Group tokens by lines for proper rendering
  const renderTokens = () => {
    const lines: { tokens: CodeChange[]; lineNumber: number }[] = [];
    let currentLine: CodeChange[] = [];
    let lineNumber = 1;

    // Filter changes based on animation phase
    const visibleChanges = changes.filter((change) => {
      if (change.type === "remove") return false;
      if (change.type === "add" && animationPhase === "positioning")
        return false;
      return true;
    });

    visibleChanges.forEach((change) => {
      if (change.token.content.includes("\n")) {
        // Split on newlines
        const parts = change.token.content.split("\n");
        parts.forEach((part, index) => {
          if (part) {
            currentLine.push({
              ...change,
              token: { ...change.token, content: part },
            });
          }
          if (index < parts.length - 1) {
            lines.push({ tokens: [...currentLine], lineNumber });
            currentLine = [];
            lineNumber++;
          }
        });
      } else {
        currentLine.push(change);
      }
    });

    if (currentLine.length > 0) {
      lines.push({ tokens: currentLine, lineNumber });
    }

    return lines.map(({ tokens, lineNumber: lineNum }) => (
      <div key={lineNum} className="flex items-start min-h-[1.5em]">
        {showLineNumbers && (
          <div
            className="text-gray-500 text-right pr-4 select-none flex-shrink-0"
            style={{ minWidth: "3em", fontSize: `${fontSize}px` }}
          >
            {lineNum}
          </div>
        )}
        <div className="flex flex-wrap items-center flex-1">
          <AnimatePresence mode="popLayout">
            {tokens.map((change, index) => (
              <motion.span
                key={change.token.id}
                className="inline-block"
                style={{
                  fontSize: `${fontSize}px`,
                  fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
                  color: getTokenColor(change.token),
                  whiteSpace:
                    change.token.type === "whitespace" ? "pre" : "normal",
                  // Add visual indicator for manually highlighted content
                  backgroundColor: change.isManuallyHighlighted
                    ? "rgba(255, 215, 0, 0.2)"
                    : "transparent",
                  border: change.isManuallyHighlighted
                    ? "1px solid rgba(255, 215, 0, 0.5)"
                    : "none",
                  borderRadius: change.isManuallyHighlighted ? "2px" : "0",
                }}
                initial={
                  change.type === "add" && isAnimating
                    ? { opacity: 0, scale: 0.8, y: -10 }
                    : { opacity: 1, scale: 1 }
                }
                animate={{
                  opacity: 1,
                  scale: 1,
                  y: 0,
                  x: 0,
                }}
                exit={{
                  opacity: 0,
                  scale: 0.8,
                  y: 10,
                }}
                transition={{
                  duration:
                    change.type === "add" && isAnimating
                      ? ANIMATION_TIMINGS.NEW_ELEMENT_DURATION
                      : ANIMATION_TIMINGS.EXISTING_ELEMENT_DURATION,
                  ease:
                    change.type === "add" && isAnimating
                      ? ANIMATION_TIMINGS.NEW_ELEMENT_EASING
                      : ANIMATION_TIMINGS.EXISTING_ELEMENT_EASING,
                  delay:
                    change.type === "add" && isAnimating
                      ? index * ANIMATION_TIMINGS.NEW_ELEMENT_STAGGER_DELAY
                      : 0,
                }}
                layout={isAnimating}
                layoutId={isAnimating ? change.token.id : undefined}
              >
                {change.token.content}
              </motion.span>
            ))}
          </AnimatePresence>
        </div>
      </div>
    ));
  };

  return (
    <div className="bg-gray-900 rounded-lg overflow-hidden p-6 font-mono leading-relaxed">
      <div className="space-y-1">{renderTokens()}</div>
    </div>
  );
};
