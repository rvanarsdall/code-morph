# 🎬 CodeMorphStudio

**Transform your code into captivating animated presentations**

CodeMorphStudio is a powerful web application that creates stunning animated transitions between different states of code, perfect for teaching programming concepts, creating educational content, or showcasing code evolution in presentations.

![CodeMorphStudio Demo](https://img.shields.io/badge/Status-Active-brightgreen) ![React](https://img.shields.io/badge/React-18+-blue) ![TypeScript](https://img.shields.io/badge/TypeScript-5+-blue) ![Framer Motion](https://img.shields.io/badge/Framer_Motion-Animation-purple)

## ✨ Features

### 🎯 Core Animation Engine

- **Intelligent Token-Level Diffing**: Advanced algorithm that identifies changes at the token level for smooth, natural animations
- **Multi-Phase Animation System**: Sophisticated animation timing with positioning, removal, and addition phases
- **Language-Agnostic Tokenization**: Support for HTML, CSS, JavaScript, TypeScript, Python, and JSON
- **Syntax-Aware Highlighting**: VS Code-inspired color themes with proper syntax highlighting

### 🎮 Interactive Controls

- **Timeline Navigation**: Visual timeline showing all code states with preview thumbnails
- **Playback Controls**: Play, pause, step forward/backward through animations
- **Variable Speed Control**: Adjustable animation speed from 1000ms to 5000ms for different presentation contexts
- **Manual Highlighting**: Add custom highlights and emphasis to specific code sections

### 📁 Project Management

- **Multi-Project Support**: Create and manage multiple animation projects
- **State Management**: Add, edit, delete, and reorder code states within projects
- **Import/Export**: Save projects as JSON files for sharing and backup
- **Auto-Save**: Automatic localStorage persistence across browser sessions

### 🎨 Customization & Settings

- **Beautiful Dark Theme**: Professional dark theme optimized for code presentation
- **Font Size Control**: Adjustable font sizes (12px-24px) for different presentation contexts
- **Line Numbers**: Toggle line number display on/off
- **Manual Highlights**: Custom highlighting system with support for `new`, `changed`, and `emphasis` types
- **Language Detection**: Automatic language detection with manual override options

## 🚀 Getting Started

### Prerequisites

- Node.js 16+ and npm/yarn
- Modern web browser with ES6+ support

### Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/yourusername/CodeMorphStudio.git
   cd CodeMorphStudio
   ```

2. **Install dependencies**

   ```bash
   npm install
   # or
   yarn install
   ```

3. **Start the development server**

   ```bash
   npm run dev
   # or
   yarn dev
   ```

4. **Open your browser**
   Navigate to `http://localhost:5173` to start creating animations!

## 🎓 How to Use

### Creating Your First Animation

1. **Launch the Application**
   - On first launch, click "Create Your First Animation"
   - This creates a new project with default settings

2. **Add Your First Code State**
   - Click the "Add State" button in the header
   - Enter your initial code, select the programming language, and add a descriptive title
   - Click "Save State" to add it to your project

3. **Create the Animation**
   - Add your next code state showing the changes you want to animate
   - The previous state will be auto-filled for easy editing
   - Use the playback controls to preview the animation

4. **Control the Animation**
   - **Play/Pause**: Start or stop the automatic progression through states
   - **Step Controls**: Manually step forward/backward through states
   - **Speed Control**: Adjust animation timing (1000ms - 5000ms)

5. **Enhance with Highlights** (Optional)
   - Add manual highlights to emphasize important changes
   - Choose from highlight types: `new`, `changed`, `emphasis`
   - Use "Manual Highlights Only" mode to show only highlighted sections

### Advanced Features

#### Project Management

- **Multiple Projects**: Switch between different animation projects using the project selector
- **Export Projects**: Download projects as JSON files for backup or sharing
- **Import Projects**: Load previously exported project files
- **Delete Projects**: Remove projects you no longer need

#### Timeline Navigation

- **Visual Timeline**: See all your code states in a visual timeline
- **Quick Navigation**: Click any state to jump directly to it
- **Edit States**: Click the edit button on timeline items to modify existing states
- **Delete States**: Remove states you no longer need

#### Settings Customization

- **Font Size**: Adjust text size for better visibility during presentations
- **Line Numbers**: Toggle line number display based on your preference
- **Theme**: Professional dark theme optimized for code readability

### Example Use Cases

- **Teaching Programming**: Show how code evolves step-by-step during tutorials
- **Code Reviews**: Demonstrate refactoring processes and improvements
- **Technical Presentations**: Create engaging slides for conferences and meetings
- **Documentation**: Visual guides for complex code transformations
- **Live Coding Sessions**: Prepare smooth transitions for live demonstrations

## 🏗️ Technical Architecture

### Core Components

- **App.tsx**: Main application component with state management and project coordination
- **AnimatedCodeDisplay**: Core animation engine with intelligent token-level diffing
- **StateEditor**: Rich code editor modal with syntax highlighting and validation
- **StateTimeline**: Visual timeline component for state navigation and management
- **PlaybackControls**: Animation control interface with play/pause/step functionality
- **ProjectSelector**: Project management dropdown with import/export capabilities

### Animation System

- **Multi-Language Tokenizer**: Custom tokenization system supporting HTML, CSS, JavaScript, Python, and JSON
- **Intelligent Diff Algorithm**: Advanced change detection that handles structural code modifications
- **Smooth Transitions**: Framer Motion-powered animations with educational timing
- **Token-Level Precision**: Animations occur at the individual token level for maximum granularity

### Technical Stack

- **Frontend**: React 18+ with TypeScript for type safety
- **Animation**: Framer Motion for smooth, professional animations
- **Styling**: Tailwind CSS with custom gradient backgrounds and glassmorphism effects
- **State Management**: React hooks with localStorage persistence
- **Code Highlighting**: Custom tokenization system with VS Code-inspired themes
- **Build Tool**: Vite for fast development and optimized production builds
- **Icons**: Lucide React for consistent, beautiful icons

## 🎨 Customization

### Adding New Programming Languages

To add support for a new programming language:

1. **Update the tokenizer** in `src/components/AnimatedCodeDisplay/tokenizer.ts`:

```typescript
// Add language detection
export const detectLanguage = (code: string): string => {
  // Add your language detection logic
  if (/your-language-pattern/.test(code)) return "your-language";
  // ...existing detection logic
};

// Add tokenization function
const tokenizeYourLanguage = (
  code: string,
  sessionId: string,
  localCounterStart: number
): CodeToken[] => {
  // Your custom tokenization logic here
  return tokens;
};
```

2. **Update the tokenizeCode function**:

```typescript
export const tokenizeCode = (code: string, language: string): CodeToken[] => {
  // Add case for your language
  if (language === "your-language") {
    tokens = tokenizeYourLanguage(code, sessionId, localCounter);
  }
  // ...existing logic
};
```

### Custom Color Themes

Modify the color scheme in `src/components/AnimatedCodeDisplay/rendering.ts`:

```typescript
export const getTokenClasses = (type: CodeToken["type"]): string => {
  const colorMap = {
    keyword: "text-purple-400", // Your custom color classes
    string: "text-green-400",
    // Add your custom colors
  };
  return colorMap[type] || "text-gray-300";
};
```

### Animation Timing

Adjust animation timing in `src/components/AnimatedCodeDisplay/types.ts`:

```typescript
export const ANIMATION_TIMINGS = {
  POSITIONING_PHASE_DURATION: 1200, // Time for elements to move into position
  PAUSE_BETWEEN_PHASES: 500, // Pause between animation phases
  ADDING_PHASE_DURATION: 4000, // Time for new elements to appear
  // Customize these values for your needs
};
```

## 🤝 Contributing

We welcome contributions! Here's how you can help:

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Make your changes**: Follow the existing code style and TypeScript patterns
4. **Add tests**: Ensure your changes are well-tested
5. **Commit your changes**: `git commit -m 'Add amazing feature'`
6. **Push to the branch**: `git push origin feature/amazing-feature`
7. **Open a Pull Request**

### Development Guidelines

- Use TypeScript for all new code
- Follow the existing component structure and patterns
- Add proper JSDoc comments for public functions
- Ensure accessibility standards are met (ARIA labels, keyboard navigation)
- Test animations across different browsers and devices
- Maintain the existing code style and formatting

## 📋 Roadmap

### Planned Features

- [ ] **Video Export**: Export animations as MP4/GIF files for easy sharing
- [ ] **Collaboration**: Real-time collaborative editing and sharing
- [ ] **Template Library**: Pre-built animation templates for common scenarios
- [ ] **Git Integration**: Direct integration with GitHub/GitLab repositories
- [ ] **Advanced Themes**: Multiple color theme options and custom theme creation
- [ ] **Mobile Optimization**: Full mobile support with touch-friendly controls
- [ ] **Cloud Sync**: Cloud storage for projects across devices
- [ ] **Plugin System**: Extensible architecture for community plugins

### Performance Improvements

- [ ] **Large File Optimization**: Better handling of large code files (1000+ lines)
- [ ] **Memory Optimization**: Improved token caching and cleanup
- [ ] **Animation Performance**: Hardware acceleration and optimization
- [ ] **Loading Performance**: Code splitting and lazy loading

## 🐛 Known Issues

- Large code files (>1000 lines) may experience slower animation performance
- Some complex CSS animations may not render perfectly in all browsers
- Mobile devices may have reduced animation performance
- Very rapid state changes can occasionally cause animation timing issues

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Framer Motion** for providing the excellent animation library
- **Tailwind CSS** for the utility-first CSS framework
- **Lucide** for the beautiful icon set
- **VS Code** for color theme inspiration
- **The React Community** for excellent tooling and resources
- **All Contributors** who help make this project better

## 📞 Support & Community

- **Issues**: [GitHub Issues](https://github.com/yourusername/CodeMorphStudio/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/CodeMorphStudio/discussions)
- **Feature Requests**: Use GitHub Issues with the "enhancement" label
- **Questions**: Check existing discussions or create a new one

## 🌟 Show Your Support

If you find CodeMorphStudio useful, please consider:

- ⭐ Starring the repository
- 🐛 Reporting bugs and issues
- 💡 Suggesting new features
- 🤝 Contributing code or documentation
- 📢 Sharing with your developer community

---

**Made with ❤️ for developers, educators, and presenters worldwide**

[![GitHub stars](https://img.shields.io/github/stars/yourusername/CodeMorphStudio.svg?style=social&label=Star)](https://github.com/yourusername/CodeMorphStudio)
[![GitHub forks](https://img.shields.io/github/forks/yourusername/CodeMorphStudio.svg?style=social&label=Fork)](https://github.com/yourusername/CodeMorphStudio/fork)
[![GitHub watchers](https://img.shields.io/github/watchers/yourusername/CodeMorphStudio.svg?style=social&label=Watch)](https://github.com/yourusername/CodeMorphStudio)
