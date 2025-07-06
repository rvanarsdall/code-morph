import React, { useEffect, useState, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Copy, Check, Video, Square } from "lucide-react";

// Import helper modules
import {
  AnimatedCodeDisplayProps,
  CodeToken,
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
import {
  recordAnimation,
  downloadBlob,
  setupRecordingCanvas,
  RecordingState,
} from "./AnimatedCodeDisplay/videoRecording";

const AnimatedCodeDisplay: React.FC<AnimatedCodeDisplayProps> = ({
  currentCode,
  previousCode,
  fontSize,
  showLineNumbers,
  isAnimating,
  onAnimationComplete,
  useManualHighlightsOnly = false,
}) => {
  const [copySuccess, setCopySuccess] = useState(false);
  const [recordingState, setRecordingState] = useState<RecordingState>({
    isRecording: false,
    progress: 0,
    status: "",
  });
  const [animationKey, setAnimationKey] = useState(0);
  const displayRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const detectedLanguage = useMemo(
    () => detectLanguage(currentCode),
    [currentCode]
  );

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
      return tokenizedCodes.currentTokens.map((token, index) => ({
        ...token,
        status: "unchanged" as const,
        newIndex: index,
      }));
    }

    // Handle case when animation is not active
    if (!isAnimating) {
      // Animation is complete or not started, show all tokens as static
      return tokenizedCodes.currentTokens.map((token, index) => ({
        ...token,
        status: "unchanged" as const,
        newIndex: index,
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
  }, [tokenizedCodes, previousCode, isAnimating, shouldIgnorePreviousCode]);

  const renderTokens = useMemo(() => {
    const tokens = diffResult.map((token) => ({
      ...token,
      isManuallyHighlighted: checkManualHighlight(),
    }));

    if (useManualHighlightsOnly) {
      return tokens.filter((token) => token.isManuallyHighlighted);
    }

    return tokens;
  }, [diffResult, useManualHighlightsOnly]);

  // Animation effects with educational timing and state reset
  useEffect(() => {
    if (!isAnimating) return;

    // Reset animation key to force remount of motion components
    setAnimationKey((prev) => prev + 1);

    // Use the new educational animation phases
    const phases =
      ANIMATION_TIMINGS.POSITIONING_PHASE_DURATION +
      ANIMATION_TIMINGS.PAUSE_BETWEEN_PHASES +
      ANIMATION_TIMINGS.ADDING_PHASE_DURATION;

    const completeTimer = setTimeout(() => {
      onAnimationComplete();
    }, phases);

    return () => {
      clearTimeout(completeTimer);
    };
  }, [isAnimating, onAnimationComplete]);

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

  // Video recording functionality
  const startRecording = async () => {
    if (!displayRef.current || !canvasRef.current) return;

    setRecordingState((prev) => ({
      ...prev,
      isRecording: true,
      status: "Starting...",
    }));

    try {
      const canvas = canvasRef.current;
      setupRecordingCanvas(displayRef.current, canvas);

      // Record the animation
      const blob = await recordAnimation({
        canvasElement: canvas,
        duration:
          ANIMATION_TIMINGS.POSITIONING_PHASE_DURATION +
          ANIMATION_TIMINGS.ADDING_PHASE_DURATION,
        onProgress: (progress) => {
          setRecordingState((prev) => ({ ...prev, progress }));
        },
        onStatusChange: (status) => {
          setRecordingState((prev) => ({ ...prev, status }));
        },
      });

      if (blob) {
        const filename = `code-animation-${Date.now()}.webm`;
        downloadBlob(blob, filename);
        setRecordingState((prev) => ({
          ...prev,
          status: "Download complete!",
        }));
      }
    } catch (error) {
      console.error("Recording failed:", error);
      setRecordingState((prev) => ({ ...prev, status: "Recording failed" }));
    } finally {
      setTimeout(() => {
        setRecordingState({ isRecording: false, progress: 0, status: "" });
      }, 3000);
    }
  };

  const stopRecording = () => {
    setRecordingState({ isRecording: false, progress: 0, status: "" });
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

        <button
          onClick={recordingState.isRecording ? stopRecording : startRecording}
          disabled={recordingState.isRecording}
          className={`p-2 rounded-md transition-colors ${
            recordingState.isRecording
              ? "bg-red-600 hover:bg-red-700"
              : "bg-gray-800 hover:bg-gray-700"
          }`}
          title={
            recordingState.isRecording ? "Stop recording" : "Record as MP4"
          }
        >
          {recordingState.isRecording ? (
            <Square className="w-4 h-4 text-white" />
          ) : (
            <Video className="w-4 h-4 text-gray-400" />
          )}
        </button>
      </div>

      {/* Recording status */}
      {recordingState.isRecording && (
        <div className="absolute top-12 right-2 bg-red-600 text-white px-3 py-1 rounded-md text-sm z-10">
          {recordingState.status} ({Math.round(recordingState.progress)}%)
        </div>
      )}

      {/* Code display */}
      <div
        key={`code-display-${animationKey}`}
        ref={displayRef}
        className="bg-gray-900 text-gray-100 rounded-lg p-4 overflow-auto font-mono"
        style={{ fontSize: `${fontSize}px` }}
      >
        {splitTokensIntoLinesWithNumbers(renderTokens).map(
          ({ tokens, lineNumber }) => (
            <div key={lineNumber} className="flex">
              {showLineNumbers && (
                <div
                  className="text-gray-500 text-right pr-4 select-none flex-shrink-0"
                  style={{ minWidth: "3em", fontSize: `${fontSize}px` }}
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

      {/* Hidden canvas for recording */}
      <canvas
        ref={canvasRef}
        className="hidden"
        style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none" }}
      />
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
      // Removed elements: Fade out quickly
      return {
        initial: { opacity: 1 },
        animate: { opacity: 0 },
        exit: {
          opacity: 0,
          scale: 0.7,
          y: 15,
        },
        transition: {
          duration: ANIMATION_TIMINGS.EXISTING_ELEMENT_DURATION * 0.5, // Faster removal
          ease: ANIMATION_TIMINGS.EXISTING_ELEMENT_EASING,
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

function checkManualHighlight(): boolean {
  // TODO: Implement manual highlight checking based on character positions
  return false;
}

export { AnimatedCodeDisplay };
