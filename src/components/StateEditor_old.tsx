import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Save, X, Code2, Copy, Wand2, CheckCircle } from 'lucide-react';

interface HighlightRange {
  start: number;
  end: number;
  type: "new" | "changed" | "emphasis";
}

interface CodeState {
  id: string;
  code: string;
  language: string;
  title: string;
  timestamp: number;
  manualHighlights?: HighlightRange[];
  useManualHighlightsOnly?: boolean;
}

interface StateEditorProps {
  state?: CodeState;
  previousState?: CodeState;
  isOpen: boolean;
  onSave: (state: Omit<CodeState, 'id' | 'timestamp'>) => void;
  onCancel: () => void;
  mode: 'create' | 'edit';
}

// Auto-detect language from code content
const detectLanguage = (code: string): string => {
  if (/<[^>]+>/.test(code)) return 'html';
  if (/\b(function|const|let|var|=>|class)\b/.test(code)) return 'javascript';
  if (/\b(def|import|class|if __name__)\b/.test(code)) return 'python';
  if (/\{[^}]*:[^}]*\}/.test(code) && !/<[^>]+>/.test(code)) return 'css';
  if (/^\s*[{[]/.test(code.trim())) return 'json';
  if (/\b(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER)\b/i.test(code)) return 'sql';
  return 'html'; // default
};

// Check if code is already well-formatted
const isWellFormatted = (code: string, language: string): boolean => {
  const lines = code.split('\n');
  
  if (language === 'html') {
    // Check for proper HTML indentation
    const hasProperIndentation = lines.some(line => line.match(/^\s{2,}/));
    const hasMultipleLines = lines.length > 1;
    const hasConsistentStructure = !code.match(/><[^>]/); // No tags smashed together
    
    return hasProperIndentation && hasMultipleLines && hasConsistentStructure;
  }
  
  // For other languages, check for basic formatting
  const hasIndentation = lines.some(line => line.match(/^\s{2,}/));
  const hasMultipleLines = lines.length > 1;
  
  return hasIndentation && hasMultipleLines;
};

// Improved code formatter that's more conservative
const formatCode = (code: string, language: string): { formatted: string; changed: boolean } => {
  try {
    const original = code;
    let formatted: string;
    
    switch (language) {
      case 'html':
        formatted = formatHTML(code);
        break;
      case 'javascript':
      case 'typescript':
        formatted = formatJavaScript(code);
        break;
      case 'css':
        formatted = formatCSS(code);
        break;
      case 'json':
        formatted = JSON.stringify(JSON.parse(code), null, 2);
        break;
      default:
        formatted = code;
    }
    
    const changed = formatted !== original;
    return { formatted, changed };
  } catch {
    // If formatting fails, return original code
    return { formatted: code, changed: false };
  }
};

// More conservative HTML formatter
const formatHTML = (html: string): string => {
  // If the code is already well-formatted, don't change it
  if (isWellFormatted(html, 'html')) {
    return html.replace(/\n\s*\n/g, '\n').trim();
  }

  let formatted = '';
  let indent = 0;
  const tab = '  ';
  
  // Remove extra whitespace and normalize
  const normalized = html.replace(/>\s+</g, '><').trim();
  
  // Better tokenization that keeps content with opening tags when appropriate
  const tokens = [];
  let currentPos = 0;
  
  // Find all tags
  const tagRegex = /<[^>]*>/g;
  let match;
  
  while ((match = tagRegex.exec(normalized)) !== null) {
    // Add text before the tag
    if (match.index > currentPos) {
      const textBefore = normalized.substring(currentPos, match.index);
      if (textBefore.trim()) {
        tokens.push({ type: 'text', content: textBefore.trim() });
      }
    }
    
    // Add the tag
    tokens.push({ type: 'tag', content: match[0] });
    currentPos = match.index + match[0].length;
  }
  
  // Add remaining text
  if (currentPos < normalized.length) {
    const remaining = normalized.substring(currentPos).trim();
    if (remaining) {
      tokens.push({ type: 'text', content: remaining });
    }
  }
  
  // Format the tokens
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const nextToken = tokens[i + 1];
    const prevToken = tokens[i - 1];
    
    if (token.type === 'tag') {
      const tagContent = token.content;
      
      if (tagContent.startsWith('</')) {
        // Closing tag
        indent = Math.max(0, indent - 1);
        
        // If previous token was text, put closing tag on same line
        if (prevToken && prevToken.type === 'text') {
          formatted += tagContent;
        } else {
          if (formatted && !formatted.endsWith('\n')) {
            formatted += '\n';
          }
          formatted += tab.repeat(indent) + tagContent;
        }
      } else if (tagContent.endsWith('/>')) {
        // Self-closing tag
        if (formatted && !formatted.endsWith('\n')) {
          formatted += '\n';
        }
        formatted += tab.repeat(indent) + tagContent;
      } else {
        // Opening tag
        if (formatted && !formatted.endsWith('\n')) {
          formatted += '\n';
        }
        formatted += tab.repeat(indent) + tagContent;
        
        // If next token is text, put it on the same line
        if (nextToken && nextToken.type === 'text') {
          formatted += nextToken.content;
          i++; // Skip the next token since we've already processed it
        } else {
          // Only increase indent for tags that will have content on new lines
          if (!tagContent.match(/<(area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)/i)) {
            indent++;
          }
        }
      }
    } else {
      // Text content - should already be handled with opening tags
      if (prevToken && prevToken.type !== 'tag') {
        formatted += token.content;
      }
    }
  }
  
  return formatted.trim();
};

// More conservative JavaScript formatter
const formatJavaScript = (js: string): string => {
  // If already formatted, just clean up
  if (isWellFormatted(js, 'javascript')) {
    return js.replace(/\n\s*\n/g, '\n').trim();
  }

  let formatted = '';
  let indent = 0;
  const tab = '  ';
  let inString = false;
  let stringChar = '';
  
  for (let i = 0; i < js.length; i++) {
    const char = js[i];
    const nextChar = js[i + 1];
    const prevChar = js[i - 1];
    
    if (!inString && (char === '"' || char === "'" || char === '`')) {
      inString = true;
      stringChar = char;
      formatted += char;
    } else if (inString && char === stringChar && prevChar !== '\\') {
      inString = false;
      stringChar = '';
      formatted += char;
    } else if (!inString) {
      if (char === '{') {
        formatted += char;
        if (nextChar !== '}') {
          formatted += '\n';
          indent++;
          formatted += tab.repeat(indent);
        }
      } else if (char === '}') {
        if (prevChar !== '{') {
          formatted = formatted.trimEnd() + '\n';
          indent = Math.max(0, indent - 1);
          formatted += tab.repeat(indent);
        }
        formatted += char;
        if (nextChar && nextChar !== ',' && nextChar !== ';' && nextChar !== ')' && nextChar !== '}') {
          formatted += '\n' + tab.repeat(indent);
        }
      } else if (char === ';' && nextChar !== ' ' && nextChar !== '\n' && nextChar) {
        formatted += char + '\n' + tab.repeat(indent);
      } else if (char === '\n') {
        // Skip multiple newlines
        if (!formatted.endsWith('\n')) {
          formatted += char;
        }
      } else {
        formatted += char;
      }
    } else {
      formatted += char;
    }
  }
  
  return formatted.replace(/\n\s*\n/g, '\n').trim();
};

// More conservative CSS formatter
const formatCSS = (css: string): string => {
  // If already formatted, just clean up
  if (isWellFormatted(css, 'css')) {
    return css.replace(/\n\s*\n/g, '\n').trim();
  }

  let formatted = '';
  let indent = 0;
  const tab = '  ';
  let inRule = false;
  
  for (let i = 0; i < css.length; i++) {
    const char = css[i];
    const nextChar = css[i + 1];
    
    if (char === '{') {
      inRule = true;
      formatted += ' {';
      if (nextChar !== '}') {
        formatted += '\n';
        indent++;
      }
    } else if (char === '}') {
      inRule = false;
      if (formatted.endsWith('\n')) {
        indent = Math.max(0, indent - 1);
        formatted += tab.repeat(indent);
      }
      formatted += '}';
      if (nextChar && nextChar.trim()) {
        formatted += '\n\n';
      }
    } else if (char === ';' && inRule) {
      formatted += ';';
      if (nextChar !== '}' && nextChar) {
        formatted += '\n' + tab.repeat(indent);
      }
    } else if (char === '\n') {
      // Skip multiple newlines
      if (!formatted.endsWith('\n')) {
        formatted += char;
        if (inRule) {
          formatted += tab.repeat(indent);
        }
      }
    } else if (char.trim()) {
      if (formatted.endsWith('\n') && inRule) {
        formatted += tab.repeat(indent);
      }
      formatted += char;
    } else {
      formatted += char;
    }
  }
  
  return formatted.replace(/\n\s*\n\s*\n/g, '\n\n').trim();
};

export const StateEditor: React.FC<StateEditorProps> = ({
  state,
  previousState,
  isOpen,
  onSave,
  onCancel,
  mode
}) => {
  const [title, setTitle] = useState('');
  const [code, setCode] = useState('');
  const [language, setLanguage] = useState('html');
  const [isFormatting, setIsFormatting] = useState(false);
  const [formatMessage, setFormatMessage] = useState<string | null>(null);
  const [manualHighlights, setManualHighlights] = useState<HighlightRange[]>([]);
  const [useManualHighlightsOnly, setUseManualHighlightsOnly] = useState(false);
  const [isSelectingHighlight, setIsSelectingHighlight] = useState(false);
  const [highlightType, setHighlightType] = useState<HighlightRange['type']>('new');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (state && mode === 'edit') {
      setTitle(state.title);
      setCode(state.code);
      setLanguage(state.language);
      setManualHighlights(state.manualHighlights || []);
      setUseManualHighlightsOnly(state.useManualHighlightsOnly || false);
    } else {
      setTitle('');
      setCode('');
      setLanguage('html');
      setManualHighlights([]);
      setUseManualHighlightsOnly(false);
    }
  }, [state, mode, isOpen]);

  useEffect(() => {
    if (code) {
      const detected = detectLanguage(code);
      setLanguage(detected);
    }
  }, [code]);

  useEffect(() => {
    if (formatMessage) {
      const timer = setTimeout(() => setFormatMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [formatMessage]);

  // Handle Tab key for proper indentation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const textarea = e.currentTarget;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const value = textarea.value;
      
      if (e.shiftKey) {
        // Shift+Tab: Remove indentation
        const lineStart = value.lastIndexOf('\n', start - 1) + 1;
        const lineEnd = value.indexOf('\n', end);
        const actualLineEnd = lineEnd === -1 ? value.length : lineEnd;
        const selectedLines = value.substring(lineStart, actualLineEnd);
        
        if (selectedLines.startsWith('  ')) {
          const newValue = value.substring(0, lineStart) + 
                          selectedLines.replace(/^  /gm, '') + 
                          value.substring(actualLineEnd);
          setCode(newValue);
          
          // Restore cursor position
          setTimeout(() => {
            textarea.selectionStart = Math.max(lineStart, start - 2);
            textarea.selectionEnd = Math.max(lineStart, end - 2);
          }, 0);
        }
      } else {
        // Tab: Add indentation
        if (start !== end) {
          // Multi-line selection: indent all lines
          const lineStart = value.lastIndexOf('\n', start - 1) + 1;
          const lineEnd = value.indexOf('\n', end);
          const actualLineEnd = lineEnd === -1 ? value.length : lineEnd;
          const selectedLines = value.substring(lineStart, actualLineEnd);
          
          const newValue = value.substring(0, lineStart) + 
                          selectedLines.replace(/^/gm, '  ') + 
                          value.substring(actualLineEnd);
          setCode(newValue);
          
          // Restore cursor position
          setTimeout(() => {
            textarea.selectionStart = start + 2;
            textarea.selectionEnd = end + (selectedLines.split('\n').length * 2);
          }, 0);
        } else {
          // Single cursor: insert two spaces
          const newValue = value.substring(0, start) + '  ' + value.substring(end);
          setCode(newValue);
          
          // Restore cursor position
          setTimeout(() => {
            textarea.selectionStart = start + 2;
            textarea.selectionEnd = start + 2;
          }, 0);
        }
      }
    }
  };

  // Handle text selection for manual highlighting
  const handleTextSelection = () => {
    if (!isSelectingHighlight || !textareaRef.current) return;
    
    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    
    if (start !== end) {
      // Create new highlight range
      const newHighlight: HighlightRange = {
        start,
        end,
        type: highlightType
      };
      
      setManualHighlights(prev => [...prev, newHighlight]);
      setIsSelectingHighlight(false);
    }
  };

  // Remove a highlight range
  const removeHighlight = (index: number) => {
    setManualHighlights(prev => prev.filter((_, i) => i !== index));
  };

  // Clear all highlights
  const clearHighlights = () => {
    setManualHighlights([]);
  };

  // Get highlight color for display
  const getHighlightColor = (type: HighlightRange['type']) => {
    switch (type) {
      case 'new': return 'bg-green-200 text-green-800';
      case 'changed': return 'bg-yellow-200 text-yellow-800';
      case 'emphasis': return 'bg-blue-200 text-blue-800';
      default: return 'bg-gray-200 text-gray-800';
    }
  };

  const handleAutofill = () => {
    if (previousState) {
      setCode(previousState.code);
      setLanguage(previousState.language);
      setTitle(previousState.title + ' (Copy)');
      setManualHighlights(previousState.manualHighlights || []);
      setUseManualHighlightsOnly(previousState.useManualHighlightsOnly || false);
    }
  };

  const handleFormat = async () => {
    if (!code.trim()) return;
    
    setIsFormatting(true);
    setFormatMessage(null);
    
    // Add a small delay to show the formatting animation
    setTimeout(() => {
      const { formatted, changed } = formatCode(code, language);
      
      if (changed) {
        setCode(formatted);
        setFormatMessage('Code formatted successfully!');
      } else {
        setFormatMessage('Code is already well-formatted!');
      }
      
      setIsFormatting(false);
    }, 300);
  };

  const handleSave = () => {
    if (!code.trim()) return;
    
    onSave({
      title: title || `${language.toUpperCase()} Code`,
      code,
      language,
      manualHighlights,
      useManualHighlightsOnly
    });
    
    // Reset form
    setTitle('');
    setCode('');
    setLanguage('html');
    setManualHighlights([]);
    setUseManualHighlightsOnly(false);
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onCancel}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-gray-800 rounded-2xl p-6 w-full max-w-6xl h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <Code2 className="w-6 h-6 text-yellow-400" />
            <h2 className="text-xl font-semibold text-white">
              {mode === 'edit' ? 'Edit Code State' : 'Create New Code State'}
            </h2>
          </div>
          <button
            onClick={onCancel}
            title="Close editor"
            className="p-2 text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 flex flex-col space-y-4 overflow-hidden">
          <div className="flex space-x-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter a descriptive title..."
                className="w-full bg-gray-700 text-white px-4 py-3 rounded-lg border border-gray-600 focus:border-yellow-500 focus:outline-none"
              />
            </div>
            <div className="w-48">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Language
              </label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                title="Select programming language"
                className="w-full bg-gray-700 text-white px-4 py-3 rounded-lg border border-gray-600 focus:border-yellow-500 focus:outline-none"
              >
                <option value="html">HTML</option>
                <option value="javascript">JavaScript</option>
                <option value="typescript">TypeScript</option>
                <option value="python">Python</option>
                <option value="java">Java</option>
                <option value="css">CSS</option>
                <option value="json">JSON</option>
                <option value="sql">SQL</option>
              </select>
            </div>
          </div>

          {/* Manual Highlighting Controls */}
          <div className="bg-gray-700 rounded-lg p-4 border border-gray-600">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-300">Manual Highlighting</h3>
              <div className="flex items-center space-x-2">
                <label className="flex items-center space-x-2 text-sm text-gray-300">
                  <input
                    type="checkbox"
                    checked={useManualHighlightsOnly}
                    onChange={(e) => setUseManualHighlightsOnly(e.target.checked)}
                    className="rounded border-gray-500 bg-gray-600 text-yellow-500 focus:ring-yellow-500"
                  />
                  <span>Use manual highlights only</span>
                </label>
              </div>
            </div>
            
            <div className="flex items-center space-x-3 mb-3">
              <select
                value={highlightType}
                onChange={(e) => setHighlightType(e.target.value as HighlightRange['type'])}
                className="bg-gray-600 text-white px-3 py-1.5 rounded border border-gray-500 text-sm"
              >
                <option value="new">New Code</option>
                <option value="changed">Changed Code</option>
                <option value="emphasis">Emphasis</option>
              </select>
              
              <button
                onClick={() => setIsSelectingHighlight(!isSelectingHighlight)}
                className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                  isSelectingHighlight 
                    ? 'bg-yellow-600 text-white' 
                    : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                }`}
              >
                {isSelectingHighlight ? 'Cancel Selection' : 'Select Text to Highlight'}
              </button>
              
              {manualHighlights.length > 0 && (
                <button
                  onClick={clearHighlights}
                  className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-sm font-medium transition-colors"
                >
                  Clear All ({manualHighlights.length})
                </button>
              )}
            </div>

            {isSelectingHighlight && (
              <div className="text-sm text-yellow-400 bg-yellow-900/20 rounded p-2 mb-3">
                Select text in the code editor below, then release to create a highlight
              </div>
            )}

            {manualHighlights.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wide">Active Highlights</h4>
                <div className="space-y-1 max-h-20 overflow-y-auto">
                  {manualHighlights.map((highlight, index) => (
                    <div key={index} className="flex items-center justify-between text-xs bg-gray-600 rounded p-2">
                      <div className="flex items-center space-x-2">
                        <span className={`px-2 py-0.5 rounded ${getHighlightColor(highlight.type)}`}>
                          {highlight.type}
                        </span>
                        <span className="text-gray-300">
                          Characters {highlight.start}-{highlight.end}
                        </span>
                        <span className="text-gray-400 font-mono">
                          "{code.substring(highlight.start, highlight.end).substring(0, 20)}..."
                        </span>
                      </div>
                      <button
                        onClick={() => removeHighlight(index)}
                        className="text-red-400 hover:text-red-300 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons Row */}
          {mode === 'create' && previousState && (
            <div className="flex items-center space-x-3 pb-2 border-b border-gray-700">
              <button
                onClick={handleAutofill}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-medium"
              >
                <Copy className="w-4 h-4" />
                <span>Copy from Previous State</span>
              </button>
              <div className="text-sm text-gray-400">
                Previous: <span className="text-blue-400 font-medium">{previousState.title}</span>
              </div>
            </div>
          )}

          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-300">
                Code
              </label>
              <div className="flex items-center space-x-3">
                {formatMessage && (
                  <motion.div
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    className="flex items-center space-x-2 text-sm"
                  >
                    <CheckCircle className="w-4 h-4 text-green-400" />
                    <span className="text-green-400">{formatMessage}</span>
                  </motion.div>
                )}
                <button
                  onClick={handleFormat}
                  disabled={!code.trim() || isFormatting}
                  className="flex items-center space-x-2 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-all text-sm font-medium"
                >
                  <motion.div
                    animate={isFormatting ? { rotate: 360 } : { rotate: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <Wand2 className="w-4 h-4" />
                  </motion.div>
                  <span>{isFormatting ? 'Formatting...' : 'Format Code'}</span>
                </button>
              </div>
            </div>
            <textarea
              ref={textareaRef}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={handleKeyDown}
              onMouseUp={handleTextSelection}
              placeholder="Paste your code here... (Language will be auto-detected)

Try pasting unformatted code like: <div><h1>Hello</h1><p>World</p></div>

Press Tab to indent, Shift+Tab to unindent"
              className="flex-1 bg-gray-700 text-white px-4 py-3 rounded-lg border border-gray-600 focus:border-yellow-500 focus:outline-none resize-none min-h-0 font-mono"
              style={{ 
                fontSize: '14px',
                lineHeight: '1.5',
                tabSize: 2
              }}
            />
            {code && (
              <div className="mt-2 flex items-center justify-between text-sm">
                <div className="text-gray-400">
                  Detected language: <span className="text-yellow-400 font-semibold">{detectLanguage(code)}</span>
                </div>
                {isWellFormatted(code, language) && (
                  <div className="flex items-center space-x-1 text-green-400">
                    <CheckCircle className="w-4 h-4" />
                    <span>Well formatted</span>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-700">
            <button
              onClick={onCancel}
              className="px-6 py-3 text-gray-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!code.trim()}
              className="px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white rounded-lg font-semibold transition-all flex items-center"
            >
              <Save className="w-4 h-4 mr-2" />
              {mode === 'edit' ? 'Update State' : 'Save State'}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};
