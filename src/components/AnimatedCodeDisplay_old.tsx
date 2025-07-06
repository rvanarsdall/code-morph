import React, { useEffect, useState, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Copy, Check, Video, Square } from "lucide-react";

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
  if (/^\s*[{[]/.test(code.trim())) return "json";
  return "html"; // default
};

// Global counter to ensure absolute uniqueness across all tokenization calls
// This counter never resets and increases monotonically
let globalTokenCounter = 0;

// Generate a truly unique session ID that includes timestamp and random components
const generateSessionId = () => {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substr(2, 8);
  const performanceNow = performance.now().toString(36).replace(".", "");
  return `${timestamp}-${randomPart}-${performanceNow}`;
};

// Enhanced tokenizer that preserves exact content structure and spacing
const tokenizeCode = (code: string, language: string): CodeToken[] => {
  const tokens: CodeToken[] = [];

  // Create a unique session ID for this specific tokenization call
  const sessionId = generateSessionId();

  // Hash the entire code to create a unique fingerprint for this specific code state
  const codeHash = btoa(encodeURIComponent(code))
    .replace(/[^a-zA-Z0-9]/g, "")
    .substr(0, 8);

  // Add a call-specific counter to ensure uniqueness within this tokenization
  let localCounter = 0;

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
            // Create absolutely unique ID using multiple layers of uniqueness
            const contentFingerprint =
              part.length +
              "-" +
              part.charCodeAt(0) +
              "-" +
              (part.charCodeAt(part.length - 1) || 0);
            const uniqueId = `${sessionId}-${type}-${globalTokenCounter++}-${localCounter++}-${startPos}-${subIndex}-${contentFingerprint}-${codeHash}`;
            tokens.push({
              type,
              content: part,
              id: uniqueId,
            });
            subIndex++;
          }

          lastIndex = tagMatch.index + tagMatch[0].length;
        }

        // Handle any remaining content (though there shouldn't be any with the improved regex)
        if (lastIndex < tagContent.length) {
          const remaining = tagContent.substring(lastIndex);
          if (remaining) {
            const contentFingerprint =
              remaining.length +
              "-" +
              remaining.charCodeAt(0) +
              "-" +
              (remaining.charCodeAt(remaining.length - 1) || 0);
            const uniqueId = `${sessionId}-tag-${globalTokenCounter++}-${localCounter++}-${startPos}-${lastIndex}-${contentFingerprint}-${codeHash}`;
            tokens.push({
              type: "tag",
              content: remaining,
              id: uniqueId,
            });
          }
        }
      } else if (match[2]) {
        // Whitespace - create highly unique ID
        const contentFingerprint =
          content.length + "-" + content.replace(/\s/g, "_");
        const uniqueId = `${sessionId}-whitespace-${globalTokenCounter++}-${localCounter++}-${startPos}-${contentFingerprint}-${codeHash}`;
        tokens.push({
          type: "whitespace",
          content: content,
          id: uniqueId,
        });
      } else {
        // Regular text content
        const contentFingerprint =
          content.length +
          "-" +
          content.charCodeAt(0) +
          "-" +
          (content.charCodeAt(content.length - 1) || 0);
        const uniqueId = `${sessionId}-text-${globalTokenCounter++}-${localCounter++}-${startPos}-${contentFingerprint}-${codeHash}`;
        tokens.push({
          type: "text",
          content: content,
          id: uniqueId,
        });
      }
    }
  } else {
    // Enhanced JavaScript tokenizer with comment support and better spacing
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
          id: `${sessionId}-comment-${globalTokenCounter++}-${localCounter++}-${start}-${end - start}-${codeHash}`,
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
          id: `${sessionId}-comment-${globalTokenCounter++}-${localCounter++}-${start}-${end - start}-${codeHash}`,
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
          id: `${sessionId}-string-${globalTokenCounter++}-${localCounter++}-${start}-${end - start}-${codeHash}`,
        });

        i = end;
        continue;
      }

      // Handle whitespace - preserve exact whitespace
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
          id: `${sessionId}-whitespace-${globalTokenCounter++}-${localCounter++}-${start}-${end}-${code.substring(start, end).length}-${codeHash}`,
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
          id: `${sessionId}-number-${globalTokenCounter++}-${localCounter++}-${start}-${end - start}-${codeHash}`,
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
          id: `${sessionId}-operator-${globalTokenCounter++}-${localCounter++}-${i}-${end - i}-${codeHash}`,
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
          id: `${sessionId}-${type}-${globalTokenCounter++}-${localCounter++}-${start}-${content}-${codeHash}`,
        });

        i = end;
        continue;
      }

      // Handle any other character
      tokens.push({
        type: "text",
        content: char,
        id: `${sessionId}-text-${globalTokenCounter++}-${localCounter++}-${i}-${char}-${codeHash}`,
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

  const result: Array<{ oldIndex: number; newIndex: number }> = [];
  const usedOldIndices = new Set<number>();
  const usedNewIndices = new Set<number>();

  // First pass: Find exact matches in order, but allow for insertions
  // This is more flexible than strict sequential matching
  for (let newIndex = 0; newIndex < newTokens.length; newIndex++) {
    if (usedNewIndices.has(newIndex)) continue;

    const newToken = newTokens[newIndex];
    const newSig = createContentSignature(newToken);

    // Look for the best matching old token
    let bestMatch = -1;
    let bestScore = -1;

    for (let oldIndex = 0; oldIndex < oldTokens.length; oldIndex++) {
      if (usedOldIndices.has(oldIndex)) continue;

      const oldToken = oldTokens[oldIndex];
      const oldSig = createContentSignature(oldToken);

      // Only match if tokens are exactly the same (content and type)
      if (oldSig === newSig) {
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

        // Give bonus for exact content matches and for maintaining sequence
        const contentBonus = 0.2;

        // Give bonus for being in a similar relative position
        const positionBonus = proximityScore > 0.8 ? 0.1 : 0;

        const score = proximityScore + contentBonus + positionBonus;

        if (score > bestScore) {
          bestScore = score;
          bestMatch = oldIndex;
        }
      }
    }

    // Accept the match if it has a reasonable score
    // Lower threshold to catch more obvious matches like closing braces
    if (bestMatch !== -1 && bestScore > 0.2) {
      result.push({ oldIndex: bestMatch, newIndex: newIndex });
      usedOldIndices.add(bestMatch);
      usedNewIndices.add(newIndex);
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
  const [copySuccess, setCopySuccess] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingProgress, setRecordingProgress] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const animationFrameRef = useRef<number>();

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
      "Previous tokens:",
      previousTokens.map((t) => `${t.type}:'${t.content}'`)
    );
    console.log(
      "Current tokens:",
      currentTokens.map((t) => `${t.type}:'${t.content}'`)
    );
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

  // Handle copying code to clipboard
  const handleCopy = async () => {
    try {
      // Reconstruct the original code from the currently visible tokens
      // This ensures we copy exactly what's displayed, preserving original formatting
      const visibleChanges = changes.filter((change) => {
        if (change.type === "remove") return false;
        if (change.type === "add" && animationPhase === "positioning")
          return false;
        return true;
      });

      // Reconstruct the code by joining token contents directly
      const reconstructedCode = visibleChanges
        .map((change) => change.token.content)
        .join("");

      await navigator.clipboard.writeText(reconstructedCode);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error("Failed to copy code:", err);
      // Fallback to copying currentCode if reconstruction fails
      try {
        await navigator.clipboard.writeText(currentCode);
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
      } catch (fallbackErr) {
        console.error("Fallback copy also failed:", fallbackErr);
      }
    }
  };

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
    // Filter changes based on animation phase
    const visibleChanges = changes.filter((change) => {
      if (change.type === "remove") return false;
      if (change.type === "add" && animationPhase === "positioning")
        return false;
      return true;
    });

    // Split tokens into lines for line number display
    const lines: { tokens: CodeChange[]; lineNumber: number }[] = [];
    let currentLine: CodeChange[] = [];
    let lineNumber = 1;

    visibleChanges.forEach((change) => {
      if (change.token.content.includes("\n")) {
        // Split on newlines and handle each part
        const parts = change.token.content.split("\n");
        parts.forEach((part, index) => {
          if (part || index === 0) {
            // Include empty parts only at start of split
            currentLine.push({
              ...change,
              token: { ...change.token, content: part },
            });
          }
          if (index < parts.length - 1) {
            // End of line - add newline token and finalize line
            currentLine.push({
              ...change,
              token: { ...change.token, content: "\n", type: "whitespace" },
            });
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

    return (
      <div className="font-mono" style={{ fontSize: `${fontSize}px` }}>
        {lines.map(({ tokens, lineNumber: lineNum }) => (
          <div key={lineNum} className="flex">
            {showLineNumbers && (
              <div
                className="text-gray-500 text-right pr-4 select-none flex-shrink-0"
                style={{ minWidth: "3em", fontSize: `${fontSize}px` }}
              >
                {lineNum}
              </div>
            )}
            <pre className="flex-1 m-0 p-0 overflow-visible whitespace-pre-wrap font-mono">
              <AnimatePresence mode="popLayout">
                {tokens.map((change, index) => (
                  <motion.span
                    key={change.token.id}
                    className="inline"
                    style={{
                      color: getTokenColor(change.token),
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
            </pre>
          </div>
        ))}
      </div>
    );
  };

  // Canvas rendering functions for MP4 export
  const renderCodeToCanvas = (
    canvas: HTMLCanvasElement,
    visibleChanges: CodeChange[]
  ) => {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size to match display
    const padding = 48; // 3rem * 16px
    const lineHeight = fontSize * 1.5;
    const charWidth = fontSize * 0.6; // Approximate character width for monospace

    // Calculate canvas dimensions
    const lines = getVisibleLines(visibleChanges);
    const maxLineLength = Math.max(
      ...lines.map((line) =>
        line.tokens.reduce(
          (acc, change) => acc + change.token.content.length,
          0
        )
      )
    );

    const canvasWidth = Math.max(
      800,
      (showLineNumbers ? 60 : 0) + maxLineLength * charWidth + padding * 2
    );
    const canvasHeight = Math.max(400, lines.length * lineHeight + padding * 2);

    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    // Clear canvas with dark background
    ctx.fillStyle = "#111827"; // bg-gray-900
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Set font
    ctx.font = `${fontSize}px 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace`;
    ctx.textBaseline = "top";

    // Render code
    let y = padding;
    lines.forEach((line) => {
      let x = padding;

      // Render line number
      if (showLineNumbers) {
        ctx.fillStyle = "#9CA3AF"; // text-gray-400
        ctx.textAlign = "right";
        ctx.fillText(String(line.lineNumber), x + 40, y);
        x += 60;
        ctx.textAlign = "left";
      }

      // Render tokens
      line.tokens.forEach((change) => {
        const token = change.token;
        if (token.content === "\n") return;

        // Set color based on token type
        ctx.fillStyle = getTokenColor(token);

        // Add background for manually highlighted tokens
        if (change.isManuallyHighlighted) {
          ctx.fillStyle = "rgba(255, 215, 0, 0.2)";
          const textWidth = ctx.measureText(token.content).width;
          ctx.fillRect(x - 2, y - 2, textWidth + 4, lineHeight);
          ctx.fillStyle = getTokenColor(token);
        }

        ctx.fillText(token.content, x, y);
        x += ctx.measureText(token.content).width;
      });

      y += lineHeight;
    });
  };

  const getVisibleLines = (visibleChanges: CodeChange[]) => {
    const lines: { tokens: CodeChange[]; lineNumber: number }[] = [];
    let currentLine: CodeChange[] = [];
    let lineNumber = 1;

    visibleChanges.forEach((change) => {
      if (change.token.content.includes("\n")) {
        const parts = change.token.content.split("\n");
        parts.forEach((part, index) => {
          if (part || index === 0) {
            currentLine.push({
              ...change,
              token: { ...change.token, content: part },
            });
          }
          if (index < parts.length - 1) {
            currentLine.push({
              ...change,
              token: { ...change.token, content: "\n", type: "whitespace" },
            });
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

    return lines;
  };

  // Recording functions
  const startRecording = async () => {
    try {
      setIsRecording(true);
      setRecordingProgress(0);
      recordedChunksRef.current = [];

      // Use the main container for recording instead of hidden canvas
      const container = document.querySelector(".bg-gray-900") as HTMLElement;
      if (!container) {
        console.error("Could not find container to record");
        setIsRecording(false);
        return;
      }

      // Use getDisplayMedia to record the specific container
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "video/webm;codecs=vp9",
      });

      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, {
          type: "video/webm",
        });
        downloadVideo(blob);
        setIsRecording(false);
        setRecordingProgress(0);
      };

      mediaRecorder.start();

      // Start progress tracking
      trackRecordingProgress();
    } catch (error) {
      console.error("Failed to start recording:", error);
      setIsRecording(false);

      // Fallback to canvas recording if screen recording fails
      startCanvasRecording();
    }
  };

  const trackRecordingProgress = () => {
    const totalDuration =
      ANIMATION_TIMINGS.POSITIONING_PHASE_DURATION +
      ANIMATION_TIMINGS.ADDING_PHASE_DURATION;
    const startTime = Date.now();

    const updateProgress = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / totalDuration, 1);

      setRecordingProgress(progress * 100);

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(updateProgress);
      } else {
        // Animation complete, stop recording
        setTimeout(() => {
          stopRecording();
        }, 500);
      }
    };

    updateProgress();
  };

  const startCanvasRecording = async () => {
    if (!canvasRef.current) return;

    try {
      const canvas = canvasRef.current;
      const stream = canvas.captureStream(30);

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "video/webm;codecs=vp9",
      });

      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, {
          type: "video/webm",
        });
        downloadVideo(blob);
        setIsRecording(false);
        setRecordingProgress(0);
      };

      mediaRecorder.start();
      recordAnimation();
    } catch (error) {
      console.error("Canvas recording also failed:", error);
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.stop();
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
  };

  const recordAnimation = () => {
    if (!canvasRef.current) return;

    const totalDuration =
      ANIMATION_TIMINGS.POSITIONING_PHASE_DURATION +
      ANIMATION_TIMINGS.ADDING_PHASE_DURATION;
    const startTime = Date.now();

    const renderFrame = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / totalDuration, 1);

      setRecordingProgress(progress * 100);

      // Determine current animation phase based on elapsed time
      let currentPhase: "positioning" | "adding" | "complete";
      if (elapsed < ANIMATION_TIMINGS.POSITIONING_PHASE_DURATION) {
        currentPhase = "positioning";
      } else if (elapsed < totalDuration) {
        currentPhase = "adding";
      } else {
        currentPhase = "complete";
      }

      // Start with all "keep" changes (existing elements that don't animate in)
      let visibleChanges = changes.filter((change) => change.type === "keep");

      // During positioning phase: only show "keep" changes
      if (currentPhase === "positioning") {
        // Show only existing elements, no new ones yet
        renderCodeToCanvas(canvasRef.current!, visibleChanges);
      }
      // During adding phase: progressively add new elements with stagger
      else if (currentPhase === "adding") {
        const addingElapsed =
          elapsed - ANIMATION_TIMINGS.POSITIONING_PHASE_DURATION;

        // Get all "add" changes in order
        const addChanges = changes.filter((c) => c.type === "add");

        // Calculate how many "add" elements should be visible based on stagger timing
        const staggerDelayMs =
          ANIMATION_TIMINGS.NEW_ELEMENT_STAGGER_DELAY * 1000;
        const visibleAddCount = Math.floor(addingElapsed / staggerDelayMs) + 1;

        // Add the appropriate number of "add" changes
        const visibleAddChanges = addChanges.slice(
          0,
          Math.min(visibleAddCount, addChanges.length)
        );
        visibleChanges = [...visibleChanges, ...visibleAddChanges];

        renderCodeToCanvas(canvasRef.current!, visibleChanges);
      }
      // Complete phase: show everything
      else {
        visibleChanges = changes.filter((change) => change.type !== "remove");
        renderCodeToCanvas(canvasRef.current!, visibleChanges);
      }

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(renderFrame);
      } else {
        // Animation complete, stop recording
        setTimeout(() => {
          stopRecording();
        }, 500); // Give a bit of extra time
      }
    };

    renderFrame();
  };

  const downloadVideo = (blob: Blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "code-animation.webm";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-gray-900 rounded-lg overflow-hidden font-mono leading-relaxed relative">
      {/* Action buttons */}
      <div className="absolute top-4 right-4 z-10 flex space-x-2">
        {/* Record button */}
        <button
          onClick={isRecording ? stopRecording : startRecording}
          disabled={!previousCode || previousCode === currentCode}
          className={`flex items-center space-x-2 px-3 py-1.5 rounded transition-colors text-sm ${
            isRecording
              ? "bg-red-600 hover:bg-red-700 text-white"
              : "bg-blue-600 hover:bg-blue-700 text-white disabled:bg-gray-600 disabled:text-gray-400 disabled:cursor-not-allowed"
          }`}
          title={isRecording ? "Stop recording" : "Record animation as video"}
        >
          {isRecording ? (
            <>
              <Square className="w-4 h-4" />
              <span>Stop ({Math.round(recordingProgress)}%)</span>
            </>
          ) : (
            <>
              <Video className="w-4 h-4" />
              <span>Record</span>
            </>
          )}
        </button>

        {/* Copy button */}
        <button
          onClick={handleCopy}
          className="flex items-center space-x-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white rounded transition-colors text-sm"
          title="Copy code to clipboard"
        >
          {copySuccess ? (
            <>
              <Check className="w-4 h-4 text-green-400" />
              <span className="text-green-400">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-4 h-4" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Code display */}
      <div className="p-6 pt-12">{renderTokens()}</div>

      {/* Canvas for recording (hidden) */}
      <canvas
        ref={canvasRef}
        className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-0 z-0"
        style={{ width: "100%", height: "100%" }}
      />

      {/* Recording overlay */}
      {isRecording && (
        <div className="absolute inset-0 bg-black bg-opacity-50 z-30 flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 text-center">
            <div className="text-lg font-semibold mb-2">
              Recording Animation
            </div>
            <div className="text-gray-600 mb-4">
              Progress: {Math.round(recordingProgress)}%
            </div>
            <div className="w-64 bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${recordingProgress}%` }}
              />
            </div>
            <button
              onClick={stopRecording}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
            >
              Stop Recording
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
