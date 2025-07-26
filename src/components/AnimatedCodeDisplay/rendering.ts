import { DiffToken } from "./diffAlgorithm";
import { CodeToken, ANIMATION_TIMINGS } from "./types";

/**
 * Rendering utilities for animated code display
 */

export interface RenderToken extends DiffToken {
  isManuallyHighlighted?: boolean;
  animationPhase?: "entering" | "stable" | "exiting";
}

/**
 * Get color for a token based on its type
 */
export function getTokenColor(token: CodeToken | RenderToken): string {
  switch (token.type) {
    // HTML specific colors
    case "tag":
      return "#ff6b6b"; // Red for HTML tags
    case "attribute":
      return "#4fc3f7"; // Light blue for HTML attributes
    case "string":
      return "#a5d6a7"; // Light green for attribute values/strings
    case "operator":
      return "#fff59d"; // Light yellow for operators (=, +, etc)

    // General programming colors
    case "keyword":
      return "#ce93d8"; // Light purple for keywords
    case "number":
      return "#ffab91"; // Light orange for numbers
    case "comment":
      return "#757575"; // Gray for comments
    case "punctuation":
      return "#ffd93d"; // Yellow for punctuation
    case "text":
      return "#ffffff"; // White for plain text
    default:
      return "#ffffff"; // Default to white
  }
}

/**
 * Get CSS classes for a token based on its properties
 */
export function getTokenClasses(token: RenderToken): string {
  const classes: string[] = [];

  // Base syntax highlighting class
  classes.push(`token-${token.type}`);

  // Status-based classes for diff visualization
  if (token.status === "added") {
    classes.push("token-added");
  } else if (token.status === "removed") {
    classes.push("token-removed");
  } else if (token.status === "unchanged") {
    classes.push("token-unchanged");
  }

  // Manual highlight
  if (token.isManuallyHighlighted) {
    classes.push("token-manually-highlighted");
  }

  // Animation phase
  if (token.animationPhase) {
    classes.push(`token-${token.animationPhase}`);
  }

  return classes.join(" ");
}

/**
 * Get complete styles for a token including color and highlighting
 */
export function getTokenDisplayStyles(token: RenderToken): React.CSSProperties {
  const styles: React.CSSProperties = {
    color: getTokenColor(token),
    display: "inline",
    whiteSpace: "pre-wrap",
  };

  // We removed the yellow highlighting but still need to mark
  // manually highlighted tokens so they can be animated correctly.
  // This is done using the isManuallyHighlighted flag and CSS classes,
  // not through inline styles anymore.

  return styles;
}

/**
 * Get inline styles for a token during animation
 */
export function getTokenStyles(
  token: RenderToken,
  animationProgress: number
): React.CSSProperties {
  const styles: React.CSSProperties = {};

  if (token.status === "added") {
    // Fade in effect
    styles.opacity = animationProgress;
    styles.transform = `translateY(${(1 - animationProgress) * 10}px)`;
  } else if (token.status === "removed") {
    // Fade out effect
    styles.opacity = 1 - animationProgress;
    styles.transform = `translateY(${animationProgress * -10}px)`;
  } else {
    // Stable display
    styles.opacity = 1;
  }

  return styles;
}

/**
 * Calculate the animation progress for a given timestamp
 */
export function calculateAnimationProgress(
  startTime: number,
  currentTime: number,
  duration: number
): number {
  const elapsed = currentTime - startTime;
  return Math.min(elapsed / duration, 1);
}

/**
 * Reconstruct the visible code from rendered tokens
 */
export function reconstructCodeFromTokens(tokens: RenderToken[]): string {
  return tokens
    .filter((token) => token.status !== "removed")
    .map((token) => token.content)
    .join("");
}

/**
 * Split tokens into lines for line-by-line rendering with line numbers
 */
export function splitTokensIntoLinesWithNumbers(
  tokens: RenderToken[]
): { tokens: RenderToken[]; lineNumber: number }[] {
  const lines: { tokens: RenderToken[]; lineNumber: number }[] = [];
  let currentLine: RenderToken[] = [];
  let lineNumber = 1;

  tokens.forEach((token) => {
    if (token.content.includes("\n")) {
      // Split on newlines and handle each part
      const parts = token.content.split("\n");
      parts.forEach((part, index) => {
        if (part) {
          // Add non-empty parts
          currentLine.push({
            ...token,
            content: part,
          });
        }
        if (index < parts.length - 1) {
          // End of line - finalize current line (don't add extra newline token)
          lines.push({ tokens: [...currentLine], lineNumber });
          currentLine = [];
          lineNumber++;
        }
      });
    } else {
      currentLine.push(token);
    }
  });

  if (currentLine.length > 0) {
    lines.push({ tokens: currentLine, lineNumber });
  }

  return lines;
}

/**
 * Apply manual highlights to tokens
 */
export function applyManualHighlights(
  tokens: RenderToken[],
  highlights: Array<{ start: number; end: number; type: string }>
): RenderToken[] {
  let charIndex = 0;

  return tokens.map((token) => {
    const tokenStart = charIndex;
    const tokenEnd = charIndex + token.content.length;

    // Check if this token is within any highlight range
    const isHighlighted = highlights.some(
      (highlight) => tokenStart < highlight.end && tokenEnd > highlight.start
    );

    charIndex = tokenEnd;

    return {
      ...token,
      isManuallyHighlighted: isHighlighted,
    };
  });
}

/**
 * Generate unique DOM IDs for elements to avoid conflicts
 */
export function generateElementId(prefix: string, tokenId: string): string {
  // Create a hash-like short ID from the full token ID
  const hash = tokenId
    .split("")
    .reduce((acc, char) => acc + char.charCodeAt(0), 0)
    .toString(36);

  return `${prefix}-${hash}`;
}

/**
 * Optimize render tokens for animation by pre-calculating animation needs
 */
export function optimizeTokensForAnimation(
  tokens: RenderToken[],
  isAnimating: boolean
): RenderToken[] {
  if (!isAnimating) {
    // When not animating, all tokens should be in stable state
    return tokens.map((token) => ({
      ...token,
      animationPhase: "stable" as const,
    }));
  }

  return tokens.map((token) => {
    // Determine animation phase based on token status
    let animationPhase: "entering" | "stable" | "exiting";

    if (token.status === "added") {
      animationPhase = "entering";
    } else if (token.status === "removed") {
      animationPhase = "exiting";
    } else {
      animationPhase = "stable";
    }

    return {
      ...token,
      animationPhase,
    };
  });
}

/**
 * Filter tokens for rendering based on their status and animation phase
 */
export function filterRenderableTokens(tokens: RenderToken[]): RenderToken[] {
  // Only show tokens that aren't completely removed
  return tokens.filter(
    (token) => token.status !== "removed" || token.animationPhase === "exiting"
  );
}

/**
 * Reset animation state for replay functionality
 */
export function resetTokensForReplay(tokens: RenderToken[]): RenderToken[] {
  return tokens.map((token) => ({
    ...token,
    animationPhase: undefined,
    // Reset any animation-specific state
  }));
}

/**
 * Create educational animation phases with clear timing
 */
export function createEducationalAnimationPhases() {
  const {
    POSITIONING_PHASE_DURATION,
    PAUSE_BETWEEN_PHASES,
    ADDING_PHASE_DURATION,
    NEW_ELEMENT_STAGGER_DELAY,
  } = ANIMATION_TIMINGS;

  return {
    // Phase 1: Existing elements move to new positions
    positioningPhase: {
      start: 0,
      duration: POSITIONING_PHASE_DURATION,
      description: "Existing code elements move to their new positions",
    },

    // Pause: Let students see the new layout
    pausePhase: {
      start: POSITIONING_PHASE_DURATION,
      duration: PAUSE_BETWEEN_PHASES,
      description: "Pause to observe the new layout",
    },

    // Phase 2: New elements appear with stagger
    addingPhase: {
      start: POSITIONING_PHASE_DURATION + PAUSE_BETWEEN_PHASES,
      duration: ADDING_PHASE_DURATION,
      description: "New code elements appear one by one",
    },

    // Total duration
    totalDuration:
      POSITIONING_PHASE_DURATION + PAUSE_BETWEEN_PHASES + ADDING_PHASE_DURATION,

    // Helper to calculate stagger delay for element index
    getStaggerDelay: (elementIndex: number) =>
      elementIndex * NEW_ELEMENT_STAGGER_DELAY,
  };
}

/**
 * Determine which animation phase we're currently in
 */
export function getCurrentAnimationPhase(
  currentTime: number,
  animationStart: number
): "positioning" | "pause" | "adding" | "complete" {
  const elapsed = currentTime - animationStart;
  const phases = createEducationalAnimationPhases();

  if (elapsed < phases.positioningPhase.duration) {
    return "positioning";
  } else if (
    elapsed <
    phases.positioningPhase.duration + phases.pausePhase.duration
  ) {
    return "pause";
  } else if (elapsed < phases.totalDuration) {
    return "adding";
  } else {
    return "complete";
  }
}

/**
 * Enhanced animation state management for educational pacing
 */
export function createTeacherModeAnimation() {
  return {
    // Phase descriptions for UI feedback
    phases: [
      "Preparing to show changes...",
      "Moving existing code to new positions...",
      "Pausing to let you observe the layout...",
      "Adding new code elements one by one...",
      "Animation complete!",
    ],

    // Get current phase description
    getCurrentPhaseDescription: (
      phase: "positioning" | "pause" | "adding" | "complete"
    ) => {
      const phaseMap = {
        positioning: "Moving existing code to new positions...",
        pause: "Pausing to let you observe the layout...",
        adding: "Adding new code elements one by one...",
        complete: "Animation complete!",
      };
      return phaseMap[phase];
    },

    // Calculate total animation time
    getTotalDuration: () => {
      const phases = createEducationalAnimationPhases();
      return phases.totalDuration;
    },

    // Get progress percentage
    getProgress: (currentTime: number, startTime: number) => {
      const elapsed = currentTime - startTime;
      const total = createEducationalAnimationPhases().totalDuration;
      return Math.min((elapsed / total) * 100, 100);
    },
  };
}
