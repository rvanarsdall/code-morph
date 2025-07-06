import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Save, X, Code2, Copy, Wand2, CheckCircle } from 'lucide-react';

interface CodeState {
  id: string;
  code: string;
  language: string;
  title: string;
  timestamp: number;
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
  if (/^\s*[\{\[]/.test(code.trim())) return 'json';
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
  } catch (error) {
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
  
  // Simple tokenization that preserves structure
  const tokens = normalized.split(/(<[^>]*>)/);
  
  tokens.forEach(token => {
    if (token.trim()) {
      if (token.startsWith('</')) {
        // Closing tag
        indent = Math.max(0, indent - 1);
        if (formatted && !formatted.endsWith('\n')) {
          formatted += '\n';
        }
        formatted += tab.repeat(indent) + token;
      } else if (token.startsWith('<') && !token.endsWith('/>')) {
        // Opening tag
        if (formatted && !formatted.endsWith('\n')) {
          formatted += '\n';
        }
        formatted += tab.repeat(indent) + token;
        // Only increase indent for non-self-closing tags
        if (!token.match(/<(area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)/i)) {
          indent++;
        }
      } else if (token.startsWith('<') && token.endsWith('/>')) {
        // Self-closing tag
        if (formatted && !formatted.endsWith('\n')) {
          formatted += '\n';
        }
        formatted += tab.repeat(indent) + token;
      } else {
        // Text content
        const trimmed = token.trim();
        if (trimmed) {
          if (formatted && !formatted.endsWith('\n') && !formatted.endsWith('>')) {
            formatted += '\n';
          }
          formatted += tab.repeat(indent) + trimmed;
        }
      }
    }
  });
  
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

  useEffect(() => {
    if (state && mode === 'edit') {
      setTitle(state.title);
      setCode(state.code);
      setLanguage(state.language);
    } else {
      setTitle('');
      setCode('');
      setLanguage('html');
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

  const handleAutofill = () => {
    if (previousState) {
      setCode(previousState.code);
      setLanguage(previousState.language);
      setTitle(previousState.title + ' (Copy)');
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
      language
    });
    
    // Reset form
    setTitle('');
    setCode('');
    setLanguage('html');
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
        className="bg-gray-800 rounded-2xl p-6 w-full max-w-6xl h-[85vh] flex flex-col"
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
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Paste your code here... (Language will be auto-detected)

Try pasting unformatted code like: <div><h1>Hello</h1><p>World</p></div>"
              className="flex-1 bg-gray-700 text-white px-4 py-3 rounded-lg border border-gray-600 focus:border-yellow-500 focus:outline-none font-mono text-sm resize-none min-h-0"
              style={{ fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace' }}
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