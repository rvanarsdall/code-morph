import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface CodeToken {
  type: 'tag' | 'text' | 'attribute' | 'string' | 'keyword' | 'operator' | 'punctuation' | 'number' | 'comment' | 'whitespace';
  content: string;
  id: string;
}

interface CodeChange {
  type: 'add' | 'remove' | 'keep' | 'move';
  token: CodeToken;
  oldIndex?: number;
  newIndex: number;
}

interface AnimatedCodeDisplayProps {
  currentCode: string;
  previousCode: string;
  language: string;
  fontSize: number;
  showLineNumbers: boolean;
  isAnimating: boolean;
  onAnimationComplete: () => void;
}

// Auto-detect language from code content
const detectLanguage = (code: string): string => {
  if (/<[^>]+>/.test(code)) return 'html';
  if (/\b(function|const|let|var|=>)\b/.test(code)) return 'javascript';
  if (/\b(def|import|class|if __name__)\b/.test(code)) return 'python';
  if (/\{[^}]*:[^}]*\}/.test(code)) return 'css';
  if (/^\s*[\{\[]/.test(code.trim())) return 'json';
  return 'html'; // default
};

// Enhanced tokenizer that preserves exact content structure
const tokenizeCode = (code: string, language: string): CodeToken[] => {
  const tokens: CodeToken[] = [];
  let index = 0;

  if (language === 'html') {
    // More precise HTML tokenization that preserves structure
    const htmlRegex = /(<\/?[a-zA-Z][^>]*>)|(\s+)|([^<\s]+)/g;
    let match;
    
    while ((match = htmlRegex.exec(code)) !== null) {
      const content = match[0];
      let type: CodeToken['type'] = 'text';
      
      if (match[1]) {
        // HTML tag - create unique ID based on tag name and position
        type = 'tag';
      } else if (match[2]) {
        // Whitespace
        type = 'whitespace';
      } else {
        // Regular text
        type = 'text';
      }
      
      tokens.push({
        type,
        content,
        id: `${type}-${index}-${content.replace(/[<>\/\s]/g, '_').substring(0, 20)}`
      });
      index++;
    }
  } else {
    // For other languages, split by words and operators
    const generalRegex = /(\s+)|([a-zA-Z_][a-zA-Z0-9_]*)|([0-9]+\.?[0-9]*)|([{}[\]();,.:=+\-*/%<>!&|]+)|(.)/g;
    let match;
    
    while ((match = generalRegex.exec(code)) !== null) {
      const content = match[0];
      let type: CodeToken['type'] = 'text';
      
      if (match[1]) type = 'whitespace';
      else if (match[2]) {
        // Check if it's a keyword
        const keywords = ['function', 'const', 'let', 'var', 'if', 'else', 'for', 'while', 'return', 'class', 'import', 'export'];
        type = keywords.includes(content) ? 'keyword' : 'text';
      }
      else if (match[3]) type = 'number';
      else if (match[4]) type = 'operator';
      
      tokens.push({
        type,
        content,
        id: `${type}-${index}-${content.replace(/\s/g, '_')}`
      });
      index++;
    }
  }
  
  return tokens;
};

// Improved diff algorithm that better handles content-based matching
const calculateTokenDiff = (oldTokens: CodeToken[], newTokens: CodeToken[]): CodeChange[] => {
  const changes: CodeChange[] = [];
  
  // Create a more sophisticated matching system
  const createTokenSignature = (token: CodeToken) => `${token.type}:${token.content}`;
  
  // Build maps for exact content matches
  const oldContentMap = new Map<string, number[]>();
  const newContentMap = new Map<string, number[]>();
  
  oldTokens.forEach((token, index) => {
    const sig = createTokenSignature(token);
    if (!oldContentMap.has(sig)) oldContentMap.set(sig, []);
    oldContentMap.get(sig)!.push(index);
  });
  
  newTokens.forEach((token, index) => {
    const sig = createTokenSignature(token);
    if (!newContentMap.has(sig)) newContentMap.set(sig, []);
    newContentMap.get(sig)!.push(index);
  });
  
  const usedOldIndices = new Set<number>();
  const usedNewIndices = new Set<number>();
  
  // First pass: Find exact matches and prefer keeping them in place
  newTokens.forEach((newToken, newIndex) => {
    const sig = createTokenSignature(newToken);
    const oldIndices = oldContentMap.get(sig) || [];
    
    // Find the best matching old index (prefer same position or closest)
    const availableOldIndices = oldIndices.filter(i => !usedOldIndices.has(i));
    
    if (availableOldIndices.length > 0) {
      // Prefer the old index that's closest to the new position
      const bestOldIndex = availableOldIndices.reduce((best, current) => {
        const bestDistance = Math.abs(best - newIndex);
        const currentDistance = Math.abs(current - newIndex);
        return currentDistance < bestDistance ? current : best;
      });
      
      changes.push({
        type: bestOldIndex === newIndex ? 'keep' : 'move',
        token: newToken,
        oldIndex: bestOldIndex,
        newIndex
      });
      
      usedOldIndices.add(bestOldIndex);
      usedNewIndices.add(newIndex);
    }
  });
  
  // Second pass: Handle additions
  newTokens.forEach((newToken, newIndex) => {
    if (!usedNewIndices.has(newIndex)) {
      changes.push({
        type: 'add',
        token: newToken,
        newIndex
      });
    }
  });
  
  // Third pass: Handle removals
  oldTokens.forEach((oldToken, oldIndex) => {
    if (!usedOldIndices.has(oldIndex)) {
      changes.push({
        type: 'remove',
        token: oldToken,
        oldIndex,
        newIndex: -1
      });
    }
  });
  
  // Sort by new index for proper rendering order
  return changes.sort((a, b) => {
    if (a.type === 'remove' && b.type !== 'remove') return 1;
    if (b.type === 'remove' && a.type !== 'remove') return -1;
    return a.newIndex - b.newIndex;
  });
};

const getTokenColor = (token: CodeToken): string => {
  switch (token.type) {
    case 'tag': return '#ff6b6b';
    case 'keyword': return '#4ecdc4';
    case 'string': return '#95e1d3';
    case 'number': return '#ff8b94';
    case 'operator': return '#fce38a';
    case 'comment': return '#6c757d';
    case 'attribute': return '#a8e6cf';
    case 'punctuation': return '#ffd93d';
    default: return '#ffffff';
  }
};

export const AnimatedCodeDisplay: React.FC<AnimatedCodeDisplayProps> = ({
  currentCode,
  previousCode,
  language: providedLanguage,
  fontSize,
  showLineNumbers,
  isAnimating,
  onAnimationComplete
}) => {
  const [animationPhase, setAnimationPhase] = useState<'idle' | 'positioning' | 'adding' | 'complete'>('idle');
  
  // Auto-detect language if not provided or if it's the default
  const detectedLanguage = useMemo(() => {
    return detectLanguage(currentCode) || providedLanguage;
  }, [currentCode, providedLanguage]);

  const currentTokens = useMemo(() => tokenizeCode(currentCode, detectedLanguage), [currentCode, detectedLanguage]);
  const previousTokens = useMemo(() => tokenizeCode(previousCode, detectedLanguage), [previousCode, detectedLanguage]);

  const changes = useMemo(() => {
    if (!previousCode || !isAnimating) {
      return currentTokens.map((token, index) => ({
        type: 'keep' as const,
        token,
        newIndex: index
      }));
    }
    return calculateTokenDiff(previousTokens, currentTokens);
  }, [previousTokens, currentTokens, previousCode, isAnimating]);

  useEffect(() => {
    if (!isAnimating) {
      setAnimationPhase('idle');
      return;
    }

    // Phase 1: Position existing elements (move/keep)
    setAnimationPhase('positioning');
    
    setTimeout(() => {
      // Phase 2: Add new elements
      setAnimationPhase('adding');
      
      setTimeout(() => {
        setAnimationPhase('complete');
        onAnimationComplete();
      }, 800); // Longer duration for smoother additions
    }, 600); // Longer duration for positioning
  }, [isAnimating, onAnimationComplete]);

  // Group tokens by lines for proper rendering
  const renderTokens = () => {
    const lines: { tokens: CodeChange[]; lineNumber: number }[] = [];
    let currentLine: CodeChange[] = [];
    let lineNumber = 1;

    // Filter changes based on animation phase
    const visibleChanges = changes.filter(change => {
      if (change.type === 'remove') return false;
      if (change.type === 'add' && animationPhase === 'positioning') return false;
      return true;
    });

    visibleChanges.forEach(change => {
      if (change.token.content.includes('\n')) {
        // Split on newlines
        const parts = change.token.content.split('\n');
        parts.forEach((part, index) => {
          if (part) {
            currentLine.push({
              ...change,
              token: { ...change.token, content: part }
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
            style={{ minWidth: '3em', fontSize: `${fontSize}px` }}
          >
            {lineNum}
          </div>
        )}
        <div className="flex flex-wrap items-center flex-1">
          <AnimatePresence mode="popLayout">
            {tokens.map((change, index) => (
              <motion.span
                key={`${change.token.id}-${change.type}`}
                className="inline-block"
                style={{
                  fontSize: `${fontSize}px`,
                  fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
                  color: getTokenColor(change.token),
                  whiteSpace: change.token.type === 'whitespace' ? 'pre' : 'normal'
                }}
                initial={
                  change.type === 'add'
                    ? { opacity: 0, scale: 0.8, y: -10 }
                    : { opacity: 1, scale: 1 }
                }
                animate={{
                  opacity: 1,
                  scale: 1,
                  y: 0,
                  x: 0
                }}
                exit={{
                  opacity: 0,
                  scale: 0.8,
                  y: 10
                }}
                transition={{
                  duration: change.type === 'add' ? 0.5 : 0.4,
                  ease: "easeOut",
                  delay: change.type === 'add' ? index * 0.08 : 0
                }}
                layout
                layoutId={change.token.id}
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
      <div className="space-y-1">
        {renderTokens()}
      </div>
    </div>
  );
};