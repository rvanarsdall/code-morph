# CodeMorphStudio - Complete Recreation Guide

## Project Overview

CodeMorphStudio is a sophisticated code animation tool that provides step-by-step, pedagogical animations of code transformations. It features syntax highlighting, diff visualization, manual highlighting capabilities, and professional code presentation.

## Core Features Required

### 1. **Animated Code Display Component**

- **Purpose**: Main component that displays code with smooth, educational animations
- **Key Features**:
  - Step-by-step code transformation animations (teacher-style pacing)
  - Syntax highlighting for multiple languages (HTML, CSS, JavaScript, Python)
  - Diff visualization (additions, removals, unchanged elements)
  - Line numbers with proper formatting
  - Copy functionality
  - Manual highlight ranges for emphasis
  - Professional dark theme with customizable colors

### 2. **Advanced Tokenization System**

- **Purpose**: Break down code into semantic tokens for precise animation and highlighting
- **Requirements**:
  - Language-agnostic tokenizer with language-specific implementations
  - Stable, unique token IDs for consistent animations
  - Support for HTML, CSS, JavaScript, Python, and JSON
  - Proper handling of strings, comments, keywords, operators, numbers
  - CSS-specific tokenization for properties, selectors, values, units

### 3. **Intelligent Diff Algorithm**

- **Purpose**: Calculate precise differences between code versions
- **Requirements**:
  - Token-level diff computation (not line-level)
  - Handles structural changes (language switches, major refactors)
  - Identifies added, removed, unchanged, and moved tokens
  - Optimized for animation performance
  - Graceful fallback for drastically different code

### 4. **Professional Animation System**

- **Purpose**: Provide smooth, educational code transformations
- **Requirements**:
  - Multi-phase animation (positioning → pause → additions)
  - Staggered animations for multiple elements
  - Configurable timing for educational pacing
  - Framer Motion integration for smooth transitions
  - Proper animation lifecycle management
  - Reset and replay capabilities

### 5. **State Management System**

- **Purpose**: Manage multiple code states and project configurations
- **Requirements**:
  - Multiple projects with custom settings
  - State timeline with previous/next navigation
  - Undo/redo functionality
  - Import/export capabilities
  - Local storage persistence
  - State validation and error handling

### 6. **Interactive Controls**

- **Purpose**: User interface for controlling animations and settings
- **Components Needed**:
  - **PlaybackControls**: Play, pause, reset, step-through
  - **ProjectSelector**: Create, switch, delete projects
  - **StateEditor**: Code input with syntax highlighting
  - **StateTimeline**: Visual timeline of code states
  - **Settings Panel**: Font size, line numbers, theme options

### 7. **Syntax Highlighting Theme**

- **Purpose**: Beautiful, VS Code-like syntax highlighting
- **Color Scheme Requirements**:
  ```css
  /* CSS Selectors */
  color: #ffd23f; /* Golden yellow */
  /* CSS Properties */
  color: #4fc3f7; /* Light blue */
  /* CSS Values */
  color: #a5d6a7; /* Light green */
  /* CSS Numbers */
  color: #ffab91; /* Light orange */
  /* Keywords */
  color: #ce93d8; /* Light purple */
  /* Strings */
  color: #90caf9; /* Light blue */
  /* Comments */
  color: #757575; /* Gray */
  /* Operators */
  color: #fff59d; /* Light yellow */
  ```

## Technical Architecture

### **Technology Stack**

- **Framework**: React 18+ with TypeScript
- **Animation**: Framer Motion
- **Styling**: Tailwind CSS
- **Build Tool**: Vite
- **Icons**: Lucide React
- **Syntax Highlighting**: Custom tokenizer (no external dependencies)

### **Project Structure**

```
src/
├── components/
│   ├── AnimatedCodeDisplay/
│   │   ├── index.tsx                 # Main component
│   │   ├── types.ts                  # TypeScript interfaces
│   │   ├── tokenizer.ts              # Language tokenizers
│   │   ├── diffAlgorithm.ts          # Diff computation
│   │   ├── rendering.ts              # Token rendering utilities
│   │   └── animations.ts             # Animation configurations
│   ├── StateEditor/
│   │   ├── index.tsx                 # Code input editor
│   │   └── SyntaxHighlighter.tsx     # Real-time highlighting
│   ├── PlaybackControls.tsx          # Animation controls
│   ├── ProjectSelector.tsx           # Project management
│   └── StateTimeline.tsx             # State navigation
├── hooks/
│   ├── useProjects.ts                # Project state management
│   ├── useCodeStates.ts              # Code state management
│   └── useLocalStorage.ts            # Persistence
├── utils/
│   ├── storage.ts                    # Local storage utilities
│   ├── validation.ts                 # Data validation
│   └── constants.ts                  # App constants
└── types/
    └── index.ts                      # Global TypeScript types
```

## Implementation Prompt

### **Primary Prompt for AI Assistant**

```
Create a professional code animation tool called "CodeMorphStudio" with the following specifications:

CORE FUNCTIONALITY:
1. **Animated Code Display**: Build a React component that shows smooth, step-by-step animations of code transformations. The animations should be educational (teacher-style pacing) and show how code evolves from one state to another.

2. **Multi-Language Syntax Highlighting**: Implement custom tokenizers for HTML, CSS, JavaScript, Python, and JSON with beautiful VS Code-like color themes.

3. **Advanced Diff Algorithm**: Create a token-level diff system that accurately identifies changes between code versions, even with major structural changes.

4. **State Management**: Build a system to manage multiple projects, each with multiple code states, timeline navigation, and persistent storage.

TECHNICAL REQUIREMENTS:
- React 18+ with TypeScript
- Framer Motion for animations
- Tailwind CSS for styling
- Vite build system
- No external syntax highlighting libraries (custom implementation)
- Modular, clean architecture
- Mobile-responsive design

ANIMATION SPECIFICATIONS:
- Multi-phase animations: positioning (1.2s) → pause (0.5s) → additions (4s)
- Staggered animations for multiple elements (100ms delay between elements)
- Smooth fade-in/out for added/removed tokens
- Position transitions for moved elements
- Educational timing optimized for learning

UI COMPONENTS NEEDED:
1. AnimatedCodeDisplay - Main code animation component
2. StateEditor - Code input with real-time syntax highlighting
3. PlaybackControls - Play, pause, reset, step controls
4. ProjectSelector - Project management interface
5. StateTimeline - Visual timeline of code states
6. Settings panel for customization

COLOR THEME (VS Code style):
- CSS Selectors: #ffd23f (golden yellow)
- CSS Properties: #4fc3f7 (light blue)
- CSS Values: #a5d6a7 (light green)
- Keywords: #ce93d8 (light purple)
- Strings: #90caf9 (light blue)
- Comments: #757575 (gray)
- Numbers: #ffab91 (light orange)
- Operators: #fff59d (light yellow)

KEY FEATURES:
- Copy code functionality
- Manual highlight ranges for emphasis
- Line numbers with proper formatting
- Dark theme with professional appearance
- Import/export project data
- Undo/redo state changes
- Responsive design for all screen sizes
```

### **Follow-up Prompts for Specific Components**

#### **For Advanced Tokenization:**

```
Create a sophisticated tokenization system that:
1. Detects language automatically from code content
2. Implements language-specific tokenizers (HTML, CSS, JS, Python, JSON)
3. Generates stable, unique token IDs for consistent animations
4. Handles edge cases like nested quotes, comments, and complex CSS selectors
5. Provides semantic token types for accurate syntax highlighting
```

#### **For Animation System:**

```
Build a professional animation system with:
1. Multi-phase animations optimized for educational content
2. Configurable timing for different learning paces
3. Smooth transitions using Framer Motion
4. Proper animation lifecycle management
5. Staggered animations for multiple simultaneous changes
6. Reset and replay capabilities with smooth state transitions
```

#### **For State Management:**

```
Implement a robust state management system featuring:
1. Multiple project support with unique configurations
2. Timeline-based state navigation (previous/next)
3. Undo/redo functionality with state validation
4. Local storage persistence with data migration
5. Import/export capabilities for sharing projects
6. Error handling and data validation
```

## Quality Standards

### **Code Quality Requirements**

- TypeScript strict mode enabled
- ESLint and Prettier configuration
- Comprehensive error handling
- Performance optimizations
- Accessibility features (ARIA labels, keyboard navigation)
- Mobile responsiveness
- Clean, maintainable architecture

### **User Experience Standards**

- Intuitive interface design
- Smooth, professional animations
- Fast loading and responsive interactions
- Clear visual feedback for all actions
- Educational timing optimized for learning
- Professional dark theme aesthetic

### **Performance Requirements**

- Smooth 60fps animations
- Efficient diff calculations
- Optimized re-renders
- Lazy loading where appropriate
- Memory-efficient token caching
- Responsive across devices

## Testing Strategy

### **Component Testing**

- Unit tests for all utility functions
- Component integration tests
- Animation timing verification
- Tokenizer accuracy tests
- Diff algorithm validation

### **User Experience Testing**

- Animation smoothness verification
- Cross-browser compatibility
- Mobile responsiveness testing
- Accessibility compliance
- Performance benchmarking

## Deployment Considerations

### **Build Optimization**

- Vite production build configuration
- Code splitting for optimal loading
- Asset optimization
- Bundle size analysis

### **Hosting Options**

- Vercel (recommended for React/Vite)
- Netlify
- GitHub Pages
- Custom hosting with static files

---

## Migration Notes from Current Implementation

If adapting from an existing codebase:

1. **Remove video recording features** - Focus on core animation functionality
2. **Simplify state management** - Use React hooks instead of complex state libraries
3. **Optimize tokenization** - Current CSS tokenizer needs refinement
4. **Improve animation timing** - Current timing may need adjustment for better UX
5. **Clean up dependencies** - Remove unnecessary packages like html2canvas
6. **Enhance mobile responsiveness** - Current implementation may need mobile optimization

---

_This guide provides a complete blueprint for recreating CodeMorphStudio with a clean, professional architecture focused on educational code animations and beautiful syntax highlighting._
