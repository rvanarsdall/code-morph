import { CodeToken } from "./types";

// Global counter to ensure absolute uniqueness across all tokenization calls
let globalTokenCounter = 0;

// Cache to store tokens by code content to ensure consistency
const tokenCache = new Map<string, CodeToken[]>();

// Generate a session ID that persists for the same code content
const getSessionId = (code: string): string => {
  // Create a simple hash of the code content
  let hash = 0;
  for (let i = 0; i < code.length; i++) {
    const char = code.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return `session-${Math.abs(hash).toString(36)}`;
};

// Auto-detect language from code content
export const detectLanguage = (code: string): string => {
  if (/<[^>]+>/.test(code)) return "html";
  if (/\b(function|const|let|var|=>)\b/.test(code)) return "javascript";
  if (/\b(def|import|class|if __name__)\b/.test(code)) return "python";
  if (/\{[^}]*:[^}]*\}/.test(code)) return "css";
  if (/^\s*[{[]/.test(code.trim())) return "json";
  return "html"; // default
};

// Enhanced tokenizer that ensures consistent token IDs for the same content
export const tokenizeCode = (code: string, language: string): CodeToken[] => {
  // Check cache first for consistency
  const cacheKey = `${language}:${code}`;
  if (tokenCache.has(cacheKey)) {
    return tokenCache.get(cacheKey)!;
  }

  const sessionId = getSessionId(code);
  const localCounter = 0;
  let tokens: CodeToken[];

  if (language === "html") {
    tokens = tokenizeHTML(code, sessionId, localCounter);
  } else if (language === "css") {
    tokens = tokenizeCSS(code, sessionId, localCounter);
  } else {
    tokens = tokenizeJavaScript(code, sessionId, localCounter);
  }

  // Cache the result
  tokenCache.set(cacheKey, tokens);
  return tokens;
};

const tokenizeHTML = (
  code: string,
  sessionId: string,
  localCounterStart: number
): CodeToken[] => {
  const tokens: CodeToken[] = [];
  let localCounter = localCounterStart;
  const htmlRegex = /(<\/?[a-zA-Z][^>]*>)|(\s+)|([^<\s]+)/g;
  let match;

  while ((match = htmlRegex.exec(code)) !== null) {
    const content = match[0];
    const startPos = match.index;

    if (match[1]) {
      // HTML tag - parse it for attributes
      const tagContent = content;
      const tagRegex =
        /(<\/?[a-zA-Z][a-zA-Z0-9]*)|(\s+)|([a-zA-Z-]+)(=)("[^"]*"|'[^']*'|[^\s>]+)?|(>)/g;
      let tagMatch;
      let subIndex = 0;

      while ((tagMatch = tagRegex.exec(tagContent)) !== null) {
        const part = tagMatch[0];
        let type: CodeToken["type"] = "tag";

        if (tagMatch[1]) type = "tag";
        else if (tagMatch[2]) type = "whitespace";
        else if (tagMatch[3]) type = "attribute";
        else if (tagMatch[4]) type = "operator";
        else if (tagMatch[5]) type = "string";
        else if (tagMatch[6]) type = "tag";

        if (part) {
          const uniqueId = `${sessionId}-${type}-${globalTokenCounter++}-${localCounter++}-${startPos}-${subIndex}`;
          tokens.push({
            type,
            content: part,
            id: uniqueId,
          });
          subIndex++;
        }
      }
    } else if (match[2]) {
      // Whitespace
      const uniqueId = `${sessionId}-whitespace-${globalTokenCounter++}-${localCounter++}-${startPos}`;
      tokens.push({
        type: "whitespace",
        content: content,
        id: uniqueId,
      });
    } else {
      // Regular text content
      const uniqueId = `${sessionId}-text-${globalTokenCounter++}-${localCounter++}-${startPos}`;
      tokens.push({
        type: "text",
        content: content,
        id: uniqueId,
      });
    }
  }

  return tokens;
};

const tokenizeJavaScript = (
  code: string,
  sessionId: string,
  localCounterStart: number
): CodeToken[] => {
  const tokens: CodeToken[] = [];
  let localCounter = localCounterStart;
  let i = 0;

  while (i < code.length) {
    const char = code[i];
    const nextChar = code[i + 1];

    // Handle single-line comments (//)
    if (char === "/" && nextChar === "/") {
      const start = i;
      let end = i + 2;
      while (end < code.length && code[end] !== "\n") {
        end++;
      }

      tokens.push({
        type: "comment",
        content: code.substring(start, end),
        id: `${sessionId}-comment-${globalTokenCounter++}-${localCounter++}-${start}`,
      });

      i = end;
      continue;
    }

    // Handle multi-line comments (/* */)
    if (char === "/" && nextChar === "*") {
      const start = i;
      let end = i + 2;
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
        id: `${sessionId}-comment-${globalTokenCounter++}-${localCounter++}-${start}`,
      });

      i = end;
      continue;
    }

    // Handle string literals
    if (char === '"' || char === "'" || char === "`") {
      const quote = char;
      const start = i;
      let end = i + 1;
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
        id: `${sessionId}-string-${globalTokenCounter++}-${localCounter++}-${start}`,
      });

      i = end;
      continue;
    }

    // Handle whitespace
    if (/\s/.test(char)) {
      const start = i;
      let end = i;
      while (end < code.length && /\s/.test(code[end])) {
        end++;
      }

      tokens.push({
        type: "whitespace",
        content: code.substring(start, end),
        id: `${sessionId}-whitespace-${globalTokenCounter++}-${localCounter++}-${start}`,
      });

      i = end;
      continue;
    }

    // Handle numbers
    if (/[0-9]/.test(char)) {
      const start = i;
      let end = i;
      while (end < code.length && /[0-9.]/.test(code[end])) {
        end++;
      }

      tokens.push({
        type: "number",
        content: code.substring(start, end),
        id: `${sessionId}-number-${globalTokenCounter++}-${localCounter++}-${start}`,
      });

      i = end;
      continue;
    }

    // Handle operators and punctuation
    if (/[{}[\]();,.:=+\-*/%<>!&|]/.test(char)) {
      let end = i + 1;
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
        id: `${sessionId}-operator-${globalTokenCounter++}-${localCounter++}-${i}`,
      });

      i = end;
      continue;
    }

    // Handle identifiers and keywords
    if (/[a-zA-Z_$]/.test(char)) {
      const start = i;
      let end = i;
      while (end < code.length && /[a-zA-Z0-9_$]/.test(code[end])) {
        end++;
      }

      const content = code.substring(start, end);
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
        id: `${sessionId}-${type}-${globalTokenCounter++}-${localCounter++}-${start}`,
      });

      i = end;
      continue;
    }

    // Handle any other character
    tokens.push({
      type: "text",
      content: char,
      id: `${sessionId}-text-${globalTokenCounter++}-${localCounter++}-${i}`,
    });

    i++;
  }

  return tokens;
};

const tokenizeCSS = (
  code: string,
  sessionId: string,
  localCounterStart: number
): CodeToken[] => {
  const tokens: CodeToken[] = [];
  let localCounter = localCounterStart;
  let i = 0;

  while (i < code.length) {
    const char = code[i];
    const nextChar = code[i + 1];

    // CSS Comments
    if (char === "/" && nextChar === "*") {
      const start = i;
      let end = i + 2;
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
        id: `${sessionId}-comment-${globalTokenCounter++}-${localCounter++}-${start}`,
      });
      i = end;
      continue;
    }

    // CSS Strings
    if (char === '"' || char === "'") {
      const quote = char;
      const start = i;
      let end = i + 1;
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
        id: `${sessionId}-string-${globalTokenCounter++}-${localCounter++}-${start}`,
      });
      i = end;
      continue;
    }

    // CSS Numbers (including units)
    if (/[0-9]/.test(char)) {
      const start = i;
      let end = i;
      while (end < code.length && /[0-9.]/.test(code[end])) end++;
      // Include units like px, em, rem, %, etc.
      while (end < code.length && /[a-zA-Z%]/.test(code[end])) end++;
      tokens.push({
        type: "number",
        content: code.substring(start, end),
        id: `${sessionId}-number-${globalTokenCounter++}-${localCounter++}-${start}`,
      });
      i = end;
      continue;
    }

    // CSS Selectors and Properties
    if (/[a-zA-Z_-]/.test(char)) {
      const start = i;
      let end = i;
      while (end < code.length && /[a-zA-Z0-9_-]/.test(code[end])) end++;
      const word = code.substring(start, end);

      // CSS Properties
      const cssProperties = [
        "color", "background", "background-color", "font-size", "font-family", 
        "font-weight", "margin", "padding", "border", "width", "height", 
        "display", "position", "top", "left", "right", "bottom", "z-index",
        "opacity", "transform", "transition", "animation", "flex", "grid",
        "justify-content", "align-items", "text-align", "line-height",
        "box-shadow", "border-radius", "overflow", "visibility", "cursor",
        "pointer-events", "user-select", "white-space", "text-decoration",
        "vertical-align", "float", "clear", "content", "list-style",
        "outline", "resize", "min-width", "max-width", "min-height", "max-height"
      ];

      // CSS Pseudo-classes and pseudo-elements
      const cssPseudos = [
        "hover", "focus", "active", "visited", "first-child", "last-child",
        "nth-child", "before", "after", "first-line", "first-letter"
      ];

      // CSS Values and Keywords
      const cssValues = [
        "auto", "none", "inherit", "initial", "unset", "normal", "bold",
        "italic", "underline", "center", "left", "right", "block", "inline",
        "flex", "grid", "absolute", "relative", "fixed", "static", "sticky",
        "hidden", "visible", "transparent", "solid", "dashed", "dotted"
      ];

      let type: CodeToken["type"] = "text";
      
      if (cssProperties.includes(word)) {
        type = "attribute"; // CSS properties
      } else if (cssPseudos.includes(word)) {
        type = "keyword"; // Pseudo-classes and pseudo-elements
      } else if (cssValues.includes(word)) {
        type = "keyword"; // CSS values
      } else if (word.startsWith("#") || word.startsWith(".")) {
        type = "tag"; // CSS selectors
      }

      tokens.push({
        type,
        content: word,
        id: `${sessionId}-${type}-${globalTokenCounter++}-${localCounter++}-${start}`,
      });

      i = end;
      continue;
    }

    // CSS Operators and Punctuation
    if (/[{}();:,.]/.test(char)) {
      tokens.push({
        type: "operator",
        content: char,
        id: `${sessionId}-operator-${globalTokenCounter++}-${localCounter++}-${i}`,
      });
      i++;
      continue;
    }

    // CSS ID and Class selectors
    if (char === "#" || char === ".") {
      const start = i;
      let end = i + 1;
      while (end < code.length && /[a-zA-Z0-9_-]/.test(code[end])) end++;
      tokens.push({
        type: "tag",
        content: code.substring(start, end),
        id: `${sessionId}-tag-${globalTokenCounter++}-${localCounter++}-${start}`,
      });
      i = end;
      continue;
    }

    // Whitespace
    if (/\s/.test(char)) {
      const start = i;
      let end = i;
      while (end < code.length && /\s/.test(code[end])) end++;
      tokens.push({
        type: "whitespace",
        content: code.substring(start, end),
        id: `${sessionId}-whitespace-${globalTokenCounter++}-${localCounter++}-${start}`,
      });
      i = end;
      continue;
    }

    // Everything else
    tokens.push({
      type: "text",
      content: char,
      id: `${sessionId}-text-${globalTokenCounter++}-${localCounter++}-${i}`,
    });

    i++;
  }

  return tokens;
};

export default tokenizeCode;
