import React, { useEffect, useState, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Copy, Check } from "lucide-react";

// Import helper modules
import {
  AnimatedCodeDisplayProps,
  CodeToken,
  HighlightRange,
  ANIMATION_TIMINGS,
} from "./AnimatedCodeDisplay/types";
import { tokenizeCode, detectLanguage } from "./AnimatedCodeDisplay/tokenizer";
import { computeDiff } from "./AnimatedCodeDisplay/diffAlgorithm";
import {
  getTokenClasses,
  getTokenDisplayStyles,
  reconstructCodeFromTokens,
  splitTokensIntoLinesWithNumbers,
  RenderToken,
} from "./AnimatedCodeDisplay/rendering";

const AnimatedCodeDisplay: React.FC<AnimatedCodeDisplayProps> = ({
  currentCode,
  previousCode,
  language,
  fontSize,
  showLineNumbers,
  isAnimating,
  onAnimationComplete,
  manualHighlights = [],
  useManualHighlightsOnly = false,
}) => {
  const [copySuccess, setCopySuccess] = useState(false);
  const [animationKey, setAnimationKey] = useState(0);
  const [animationJustCompleted, setAnimationJustCompleted] = useState(false);
  const displayRef = useRef<HTMLDivElement>(null);

  const detectedLanguage = useMemo(() => {
    // Use provided language if available, otherwise detect from code
    return language || detectLanguage(currentCode);
  }, [currentCode, language]);

  // Detect if there's a significant language change that should reset the diff
  const shouldIgnorePreviousCode = useMemo(() => {
    if (!previousCode) return false;

    const currentLang = detectLanguage(currentCode);
    const previousLang = detectLanguage(previousCode);

    // If languages are significantly different, treat as if no previous code
    const incompatibleLanguages = [
      ["html", "javascript"],
      ["html", "typescript"],
      ["html", "python"],
      ["javascript", "html"],
      ["typescript", "html"],
      ["python", "html"],
      ["python", "javascript"],
      ["javascript", "python"],
    ];

    return incompatibleLanguages.some(
      ([lang1, lang2]) =>
        (currentLang === lang1 && previousLang === lang2) ||
        (currentLang === lang2 && previousLang === lang1)
    );
  }, [currentCode, previousCode]);

  const tokenizedCodes = useMemo(() => {
    const currentTokens = tokenizeCode(currentCode, detectedLanguage);
    const previousTokens = tokenizeCode(previousCode, detectedLanguage);

    console.log("Tokenized codes:", {
      currentTokens: currentTokens.length,
      previousTokens: previousTokens.length,
      duplicateIds: checkForDuplicateIds(currentTokens),
    });

    return { currentTokens, previousTokens };
  }, [currentCode, previousCode, detectedLanguage]);

  const diffResult = useMemo(() => {
    // Handle case when there's no previous code or language changed significantly
    if (!previousCode || shouldIgnorePreviousCode) {
      // No previous code or language changed, so all tokens are static (no animation)
      // Preserve all original token properties for proper syntax highlighting
      return tokenizedCodes.currentTokens.map((token, index) => ({
        ...token,
        status: "unchanged" as const,
        newIndex: index,
        oldIndex: undefined, // No previous reference
      }));
    }

    // Handle case when animation is not active AND we've given time for animations to complete
    if (!isAnimating && !animationJustCompleted) {
      // Animation is complete or not started, show all tokens as static
      // Preserve all original token properties for proper syntax highlighting
      return tokenizedCodes.currentTokens.map((token, index) => ({
        ...token,
        status: "unchanged" as const,
        newIndex: index,
        oldIndex: undefined, // No previous reference when not animating
      }));
    }

    const diff = computeDiff(
      tokenizedCodes.previousTokens,
      tokenizedCodes.currentTokens
    );
    console.log("Diff result:", {
      totalTokens: diff.length,
      added: diff.filter((t) => t.status === "added").length,
      removed: diff.filter((t) => t.status === "removed").length,
      unchanged: diff.filter((t) => t.status === "unchanged").length,
    });
    return diff;
  }, [
    tokenizedCodes,
    previousCode,
    isAnimating,
    shouldIgnorePreviousCode,
    animationJustCompleted,
  ]);

  const renderTokens = useMemo(() => {
    // Convert manual highlights from character positions to token indices
    const tokenHighlightRanges = convertManualHighlightsToTokenRanges(
      manualHighlights,
      tokenizedCodes.currentTokens
    );

    // Log highlight info to help debugging
    if (manualHighlights.length > 0) {
      console.log("Manual highlights:", {
        ranges: manualHighlights,
        mappedTokenRanges: tokenHighlightRanges,
        totalTokensHighlighted: tokenHighlightRanges.flat().length,
      });
    }

    // During animation or just after completion, show ALL tokens (removed, unchanged, and added)
    // This ensures the user sees the full transformation from previous to current state
    let tokens;

    if (
      (isAnimating || animationJustCompleted) &&
      previousCode &&
      !shouldIgnorePreviousCode
    ) {
      // During animation: include ALL diff tokens (removed ones will fade out, added ones will fade in)
      tokens = diffResult.map((token, index) => ({
        ...token,
        isManuallyHighlighted: checkTokenInHighlightRanges(
          index,
          tokenHighlightRanges
        ),
      }));
    } else {
      // When not animating: only show non-removed tokens (final state)
      tokens = diffResult
        .filter((token) => token.status !== "removed")
        .map((token, index) => ({
          ...token,
          isManuallyHighlighted: checkTokenInHighlightRanges(
            index,
            tokenHighlightRanges
          ),
        }));
    }

    if (useManualHighlightsOnly) {
      // When only showing manually highlighted elements:
      // 1. Filter to only include manually highlighted tokens
      // 2. Ensure they're treated as "added" for animation purposes

      // Check if we actually have highlighted tokens
      const hasHighlightedTokens = tokens.some(
        (token) => token.isManuallyHighlighted
      );

      if (!hasHighlightedTokens) {
        // No manual highlights were detected, this could be due to character position mapping issues
        // Fall back to the standard diff for a better user experience
        console.warn(
          "No manually highlighted tokens found despite having manual highlights defined."
        );
        return tokens;
      }

      const highlightedTokens = tokens
        .filter((token) => token.isManuallyHighlighted)
        .map((token) => ({
          ...token,
          // Force tokens to be "added" to ensure they animate properly with the correct type
          status: isAnimating ? ("added" as const) : ("unchanged" as const),
        }));

      // Log the highlighted tokens for debugging
      console.log("Manual highlights only mode:", {
        totalHighlightedTokens: highlightedTokens.length,
        firstFewTokens: highlightedTokens.slice(0, 5).map((t) => t.content),
        highlightRanges: manualHighlights,
      });

      return highlightedTokens;
    }

    return tokens;
  }, [
    diffResult,
    useManualHighlightsOnly,
    manualHighlights,
    isAnimating,
    animationJustCompleted,
    previousCode,
    shouldIgnorePreviousCode,
    tokenizedCodes.currentTokens,
  ]);

  // Animation effects with educational timing and state reset
  useEffect(() => {
    // Store animation timer references for cleanup
    const timers: NodeJS.Timeout[] = [];
    
    if (!isAnimating) {
      // Reset the just completed state when starting fresh
      if (animationJustCompleted) {
        setAnimationJustCompleted(false);
      }
      return () => {
        // No timers to clean up if we're not animating
      };
    }

    // Reset animation key to force remount of motion components
    setAnimationKey((prev) => prev + 1);
    setAnimationJustCompleted(false);

    // Calculate the total animation duration
    const basePhases =
      ANIMATION_TIMINGS.POSITIONING_PHASE_DURATION +
      ANIMATION_TIMINGS.PAUSE_BETWEEN_PHASES +
      ANIMATION_TIMINGS.ADDING_PHASE_DURATION;

    // Account for the longest possible individual element animation
    // Use a conservative estimate for new elements count
    const maxNewElements = Math.max(
      tokenizedCodes.currentTokens.length -
        tokenizedCodes.previousTokens.length,
      5 // Minimum estimate
    );
    const longestNewElementAnimation =
      ANIMATION_TIMINGS.NEW_ELEMENT_DURATION * 1000 + // Convert to ms
      maxNewElements * ANIMATION_TIMINGS.NEW_ELEMENT_STAGGER_DELAY * 1000; // Convert to ms

    // Use the longer of the two calculations, plus a small buffer
    const totalDuration =
      Math.max(
        basePhases,
        ANIMATION_TIMINGS.POSITIONING_PHASE_DURATION +
          ANIMATION_TIMINGS.PAUSE_BETWEEN_PHASES +
          longestNewElementAnimation
      ) + 300; // Larger buffer to ensure animations complete

    console.log("🎬 Animation timing:", {
      basePhases,
      longestNewElementAnimation,
      totalDuration,
      maxNewElements,
    });

    // Store the completeTimer so we can clear it if the animation is interrupted
    const completeTimer = setTimeout(() => {
      // Set the just completed flag to maintain diff state briefly
      setAnimationJustCompleted(true);
      onAnimationComplete();

      // After a short delay, allow the final state to show
      const finalStateTimer = setTimeout(() => {
        setAnimationJustCompleted(false);
      }, 100); // 100ms delay to let exit animations finish
      
      timers.push(finalStateTimer);
    }, totalDuration);
    
    timers.push(completeTimer);

    // If this effect is cleaned up (e.g., because a new animation starts),
    // clear all timers to ensure the animation completes properly
    return () => {
      timers.forEach(timer => clearTimeout(timer));
      
      // If we're cleaning up due to a state change (and not component unmount),
      // notify that the animation is complete to reset state in the parent
      onAnimationComplete();
    };
  }, [
    isAnimating,
    onAnimationComplete,
    animationJustCompleted,
    tokenizedCodes.currentTokens.length,
    tokenizedCodes.previousTokens.length,
  ]);

  // Copy functionality
  const handleCopy = async () => {
    const visibleCode = reconstructCodeFromTokens(
      renderTokens.filter((token) => token.status !== "removed")
    );

    try {
      await navigator.clipboard.writeText(visibleCode);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <div className="relative">
      {/* Control buttons */}
      <div className="absolute top-2 right-2 flex gap-2 z-10">
        <button
          onClick={handleCopy}
          className="p-2 bg-gray-800 hover:bg-gray-700 rounded-md transition-colors"
          title="Copy code"
        >
          {copySuccess ? (
            <Check className="w-4 h-4 text-green-400" />
          ) : (
            <Copy className="w-4 h-4 text-gray-400" />
          )}
        </button>
      </div>

      {/* Code display */}
      <div
        key={`code-display-${animationKey}`}
        ref={displayRef}
        className="bg-gray-900 text-gray-100 rounded-lg p-4 overflow-auto font-mono"
        style={{ fontSize: `${fontSize}px` }} // Dynamic font size from props
      >
        {splitTokensIntoLinesWithNumbers(renderTokens).map(
          ({ tokens, lineNumber }) => (
            <div key={lineNumber} className="flex">
              {showLineNumbers && (
                <div
                  className="text-gray-500 text-right pr-4 select-none flex-shrink-0"
                  style={{ minWidth: "3em", fontSize: `${fontSize}px` }} // Dynamic font size matching code
                >
                  {lineNumber}
                </div>
              )}
              <pre className="flex-1 m-0 p-0 overflow-visible whitespace-pre-wrap font-mono">
                <AnimatePresence
                  mode="popLayout"
                  key={`animate-presence-${animationKey}`}
                >
                  {tokens.map((token, index) => (
                    <TokenComponent
                      key={`${token.id}-${animationKey}`}
                      token={token}
                      index={index}
                      isAnimating={isAnimating}
                    />
                  ))}
                </AnimatePresence>
              </pre>
            </div>
          )
        )}
      </div>
    </div>
  );
};

// Individual token component
const TokenComponent = React.forwardRef<
  HTMLSpanElement,
  {
    token: RenderToken;
    index: number;
    isAnimating: boolean;
  }
>(({ token, index, isAnimating }, ref) => {
  const getAnimationProps = () => {
    // Debug the token status for manually highlighted tokens
    if (token.isManuallyHighlighted) {
      console.log("Animating manually highlighted token:", {
        content: token.content,
        status: token.status,
        isAnimating,
      });
    }

    if (!isAnimating) {
      return {
        initial: { opacity: 1 },
        animate: { opacity: 1 },
      };
    }

    // Enhanced handling for manual highlights
    if (token.status === "added" || token.isManuallyHighlighted) {
      // New elements or manually highlighted: Start hidden, appear after positioning + pause
      return {
        initial: { opacity: 0, scale: 0.7, y: -15 },
        animate: {
          opacity: 1,
          scale: 1,
          y: 0,
          x: 0,
        },
        exit: {
          opacity: 0,
          scale: 0.7,
          y: 15,
        },
        transition: {
          duration: ANIMATION_TIMINGS.NEW_ELEMENT_DURATION,
          delay:
            (ANIMATION_TIMINGS.POSITIONING_PHASE_DURATION +
              ANIMATION_TIMINGS.PAUSE_BETWEEN_PHASES) /
              1000 + // Convert to seconds
            index * ANIMATION_TIMINGS.NEW_ELEMENT_STAGGER_DELAY,
          ease: ANIMATION_TIMINGS.NEW_ELEMENT_EASING,
        },
        layout: isAnimating,
        layoutId: isAnimating ? token.id : undefined,
      };
    } else if (token.status === "removed") {
      // Removed elements: Start visible, then fade out quickly during the first phase
      return {
        initial: { opacity: 1, scale: 1 },
        animate: { opacity: 0, scale: 0.7, y: -15 },
        exit: {
          opacity: 0,
          scale: 0.5,
          y: -20,
        },
        transition: {
          duration: ANIMATION_TIMINGS.EXISTING_ELEMENT_DURATION * 0.8, // Slightly longer for cleaner exit
          delay: 0, // Start immediately
          ease: "easeOut" as const,
        },
        layout: isAnimating,
        layoutId: isAnimating ? token.id : undefined,
      };
    } else {
      // Unchanged tokens - these move to new positions during positioning phase
      return {
        initial: { opacity: 1, scale: 1 },
        animate: {
          opacity: 1,
          scale: 1,
          y: 0,
          x: 0,
        },
        transition: {
          duration: ANIMATION_TIMINGS.EXISTING_ELEMENT_DURATION,
          ease: ANIMATION_TIMINGS.EXISTING_ELEMENT_EASING,
          // No delay - these move immediately
        },
        layout: isAnimating,
        layoutId: isAnimating ? token.id : undefined,
      };
    }
  };

  const className = getTokenClasses(token);
  const displayStyles = getTokenDisplayStyles(token);

  return (
    <motion.span
      ref={ref}
      {...getAnimationProps()}
      className={className}
      style={displayStyles}
    >
      {token.content}
    </motion.span>
  );
});

// Add display name for debugging
TokenComponent.displayName = "TokenComponent";

// Helper functions
function checkForDuplicateIds(tokens: CodeToken[]): string[] {
  const seen = new Set<string>();
  const duplicates: string[] = [];

  tokens.forEach((token) => {
    if (seen.has(token.id)) {
      duplicates.push(token.id);
    } else {
      seen.add(token.id);
    }
  });

  return duplicates;
}

/**
 * Convert character-based highlight ranges to token-based highlight ranges
 * by mapping each highlight range to the tokens it covers
 */
function convertManualHighlightsToTokenRanges(
  manualHighlights: HighlightRange[],
  tokens: CodeToken[]
): number[][] {
  if (!manualHighlights.length) return [];

  // For each highlight range, find all token indices that fall within that range
  return manualHighlights.map((highlight) => {
    const { start, end } = highlight;
    const tokenIndices: number[] = [];

    // Track character position as we iterate through tokens
    let charPos = 0;

    // Debug the original code to reconstruct and verify character positions
    const originalCode = tokens.map((t) => t.content).join("");
    console.log("Manual highlight conversion debug:", {
      highlightRange: `${start}-${end}`,
      highlightedText: originalCode.substring(start, end),
      totalCodeLength: originalCode.length,
    });

    // Check each token to see if it falls within the highlight range
    tokens.forEach((token, index) => {
      const tokenStart = charPos;
      const tokenEnd = charPos + token.content.length;

      // Debug token positions for troubleshooting
      if (index < 10 || (tokenStart <= end && tokenEnd >= start)) {
        console.log(
          `Token ${index}: '${token.content}' (${tokenStart}-${tokenEnd})`
        );
      }

      // Enhanced overlap detection logic for more accurate highlight matching
      // A token is considered part of the highlight if any portion of it overlaps with the highlight range
      const isOverlapping =
        (tokenStart >= start && tokenStart < end) || // Token starts inside highlight
        (tokenEnd > start && tokenEnd <= end) || // Token ends inside highlight
        (tokenStart <= start && tokenEnd >= end); // Token completely surrounds highlight

      if (isOverlapping) {
        tokenIndices.push(index);
        console.log(`  ✓ Including token ${index}: '${token.content}'`);
      }

      // Update character position
      charPos += token.content.length;
    });

    return tokenIndices;
  });
}

/**
 * Check if a token index is in any of the token-based highlight ranges
 */
function checkTokenInHighlightRanges(
  tokenIndex: number,
  tokenHighlightRanges: number[][]
): boolean {
  return tokenHighlightRanges.some((range) => range.includes(tokenIndex));
}

export { AnimatedCodeDisplay };
