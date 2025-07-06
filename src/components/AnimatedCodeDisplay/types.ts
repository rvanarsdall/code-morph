export interface CodeToken {
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

export interface CodeChange {
  type: "add" | "remove" | "keep" | "move";
  token: CodeToken;
  oldIndex?: number;
  newIndex: number;
  isManuallyHighlighted?: boolean;
}

export interface HighlightRange {
  start: number;
  end: number;
  type: "new" | "changed" | "emphasis";
}

export interface AnimatedCodeDisplayProps {
  currentCode: string;
  previousCode: string;
  language: string;
  fontSize: number;
  showLineNumbers: boolean;
  isAnimating: boolean;
  onAnimationComplete: () => void;
  manualHighlights?: HighlightRange[];
  useManualHighlightsOnly?: boolean;
}

export const ANIMATION_TIMINGS = {
  // Phase durations (in milliseconds) - Educational pacing
  POSITIONING_PHASE_DURATION: 1200, // Longer time to see elements move into position
  PAUSE_BETWEEN_PHASES: 500, // Pause between positioning and adding
  ADDING_PHASE_DURATION: 4000, // Much longer to see new elements appear

  // Individual element animation durations (in seconds) - Slower for teaching
  EXISTING_ELEMENT_DURATION: 0.8, // Slower movement of existing elements
  NEW_ELEMENT_DURATION: 1.2, // Slower fade-in of new elements

  // Stagger delays (in seconds) - More pronounced for visibility
  NEW_ELEMENT_STAGGER_DELAY: 0.15, // Longer delay between each new element

  // Easing functions - More dramatic for educational effect
  EXISTING_ELEMENT_EASING: "easeInOut" as const,
  NEW_ELEMENT_EASING: "easeOut" as const,
};
