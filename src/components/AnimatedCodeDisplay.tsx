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
        isManuallyHighlighted: checkManualHighlight(
          token,
          index,
          manualHighlights
        ),
      }));
    } else {
      // When not animating: only show non-removed tokens (final state)
      tokens = diffResult
        .filter((token) => token.status !== "removed")
        .map((token, index) => ({
          ...token,
          isManuallyHighlighted: checkManualHighlight(
            token,
            index,
            manualHighlights
          ),
        }));
    }

    if (useManualHighlightsOnly) {
      return tokens.filter((token) => token.isManuallyHighlighted);
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
  ]);

  // Animation effects with educational timing and state reset
  useEffect(() => {
    if (!isAnimating) {
      // Reset the just completed state when starting fresh
      if (animationJustCompleted) {
        setAnimationJustCompleted(false);
      }
      return;
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

    const completeTimer = setTimeout(() => {
      // Set the just completed flag to maintain diff state briefly
      setAnimationJustCompleted(true);
      onAnimationComplete();

      // After a short delay, allow the final state to show
      setTimeout(() => {
        setAnimationJustCompleted(false);
      }, 100); // 100ms delay to let exit animations finish
    }, totalDuration);

    return () => {
      clearTimeout(completeTimer);
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
    if (!isAnimating) {
      return {
        initial: { opacity: 1 },
        animate: { opacity: 1 },
      };
    }

    if (token.status === "added") {
      // New elements: Start hidden, appear after positioning + pause
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

function checkManualHighlight(
  _token: CodeToken,
  index: number,
  manualHighlights: HighlightRange[] = []
): boolean {
  // Calculate the character position of this token
  // This is a simplified implementation - for more accuracy, you'd need to calculate
  // the actual character position based on the token's position in the reconstructed code
  const tokenPosition = index;

  return manualHighlights.some(
    (highlight) =>
      tokenPosition >= highlight.start && tokenPosition <= highlight.end
  );
}

export { AnimatedCodeDisplay };
