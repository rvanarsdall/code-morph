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
