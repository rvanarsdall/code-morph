import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Settings, Zap, Code2 } from "lucide-react";
import { AnimatedCodeDisplay } from "./components/AnimatedCodeDisplay";
import { StateEditor } from "./components/StateEditor";
import { StateTimeline } from "./components/StateTimeline";
import { PlaybackControls } from "./components/PlaybackControls";
import { ProjectSelector } from "./components/ProjectSelector";

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

interface Project {
  id: string;
  name: string;
  states: CodeState[];
  currentStateIndex: number;
  settings: {
    theme: string;
    fontSize: number;
    lineNumbers: boolean;
    animationSpeed: number;
  };
}

const STORAGE_KEY = "code-presentation-projects";

function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1500);
  const [showSettings, setShowSettings] = useState(false);

  // State Editor
  const [editorState, setEditorState] = useState<{
    isOpen: boolean;
    mode: "create" | "edit";
    state?: CodeState;
    index?: number;
  }>({
    isOpen: false,
    mode: "create",
  });

  const currentProject = projects.find((p) => p.id === currentProjectId);
  const currentState = currentProject?.states[currentProject.currentStateIndex];
  const previousState =
    currentProject?.states[currentProject.currentStateIndex - 1];

  // Load projects from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsedProjects = JSON.parse(saved);
        setProjects(parsedProjects);
        if (parsedProjects.length > 0) {
          setCurrentProjectId(parsedProjects[0].id);
        }
      } catch (error) {
        console.error("Error loading projects:", error);
      }
    }
  }, []);

  // Save projects to localStorage
  useEffect(() => {
    if (projects.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
    }
  }, [projects]);

  // Auto-play functionality
  useEffect(() => {
    if (!isPlaying || !currentProject || isAnimating) return;

    const interval = setInterval(() => {
      if (currentProject.currentStateIndex < currentProject.states.length - 1) {
        setIsAnimating(true);
        setProjects((prev) =>
          prev.map((p) =>
            p.id === currentProjectId
              ? { ...p, currentStateIndex: p.currentStateIndex + 1 }
              : p
          )
        );
      } else {
        setIsPlaying(false);
      }
    }, playbackSpeed);

    return () => clearInterval(interval);
  }, [isPlaying, currentProject, currentProjectId, playbackSpeed, isAnimating]);

  const createNewProject = () => {
    const newProject: Project = {
      id: Date.now().toString(),
      name: `Project ${projects.length + 1}`,
      states: [],
      currentStateIndex: 0,
      settings: {
        theme: "oneDark",
        fontSize: 16,
        lineNumbers: true,
        animationSpeed: 1000,
      },
    };
    setProjects((prev) => [...prev, newProject]);
    setCurrentProjectId(newProject.id);
  };

  const deleteProject = (projectId: string) => {
    if (projects.length <= 1) return; // Don't delete the last project

    setProjects((prev) => {
      const filtered = prev.filter((p) => p.id !== projectId);
      if (projectId === currentProjectId) {
        setCurrentProjectId(filtered[0]?.id || null);
      }
      return filtered;
    });
  };

  const handleStateSave = (stateData: Omit<CodeState, "id" | "timestamp">) => {
    if (!currentProject) return;

    if (
      editorState.mode === "edit" &&
      editorState.state &&
      editorState.index !== undefined
    ) {
      // Update existing state
      const updatedState: CodeState = {
        ...editorState.state,
        ...stateData,
        timestamp: Date.now(),
      };

      setProjects((prev) =>
        prev.map((p) =>
          p.id === currentProjectId
            ? {
                ...p,
                states: p.states.map((s, i) =>
                  i === editorState.index ? updatedState : s
                ),
              }
            : p
        )
      );
    } else {
      // Create new state
      const newState: CodeState = {
        id: Date.now().toString(),
        ...stateData,
        timestamp: Date.now(),
      };

      setProjects((prev) =>
        prev.map((p) =>
          p.id === currentProjectId
            ? { ...p, states: [...p.states, newState] }
            : p
        )
      );
    }

    setEditorState({ isOpen: false, mode: "create" });
  };

  const handleStateEdit = (state: CodeState, index: number) => {
    setEditorState({
      isOpen: true,
      mode: "edit",
      state,
      index,
    });
  };

  const deleteState = (stateId: string) => {
    if (!currentProject) return;

    setProjects((prev) =>
      prev.map((p) =>
        p.id === currentProjectId
          ? {
              ...p,
              states: p.states.filter((s) => s.id !== stateId),
              currentStateIndex: Math.max(
                0,
                Math.min(p.currentStateIndex, p.states.length - 2)
              ),
            }
          : p
      )
    );
  };

  const goToState = (index: number) => {
    if (isAnimating || !currentProject) return;

    setIsAnimating(true);
    setProjects((prev) =>
      prev.map((p) =>
        p.id === currentProjectId ? { ...p, currentStateIndex: index } : p
      )
    );
  };

  const handleAnimationComplete = () => {
    setIsAnimating(false);
  };

  const exportProject = () => {
    if (!currentProject) return;

    const dataStr = JSON.stringify(currentProject, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${currentProject.name.replace(/\s+/g, "_")}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const importProject = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target?.result as string);
        const newId = Date.now().toString();
        const newProject = { ...imported, id: newId };
        setProjects((prev) => [...prev, newProject]);
        setCurrentProjectId(newId);
      } catch (error) {
        alert("Error importing project file");
      }
    };
    reader.readAsText(file);
    event.target.value = ""; // Reset input
  };

  const updateProjectSettings = (settings: Partial<Project["settings"]>) => {
    setProjects((prev) =>
      prev.map((p) =>
        p.id === currentProjectId
          ? { ...p, settings: { ...p.settings, ...settings } }
          : p
      )
    );
  };

  // Get the previous state for autofill functionality
  const getPreviousStateForEditor = () => {
    if (!currentProject || currentProject.states.length === 0) return undefined;
    return currentProject.states[currentProject.states.length - 1];
  };

  if (projects.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-indigo-900 to-purple-900 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="mb-8">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5 }}
            >
              <Zap className="w-24 h-24 mx-auto text-yellow-400 mb-4" />
              <h1 className="text-5xl font-bold text-white mb-4 bg-gradient-to-r from-yellow-400 to-orange-500 bg-clip-text text-transparent">
                Code Morph Studio
              </h1>
              <p className="text-gray-300 text-xl max-w-2xl mx-auto leading-relaxed">
                Create stunning animated code presentations where your code
                transforms and evolves in real-time. Perfect for teaching
                programming concepts with visual impact.
              </p>
            </motion.div>
          </div>
          <motion.button
            onClick={createNewProject}
            className="bg-gradient-to-r from-yellow-500 to-orange-600 hover:from-yellow-600 hover:to-orange-700 text-white px-8 py-4 rounded-xl font-semibold transition-all transform hover:scale-105 flex items-center mx-auto shadow-2xl"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Plus className="w-5 h-5 mr-2" />
            Create Your First Animation
          </motion.button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-indigo-900 to-purple-900">
      {/* Header */}
      <div className="bg-black/30 backdrop-blur-xl border-b border-white/10">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Zap className="w-8 h-8 text-yellow-400" />
              <h1 className="text-2xl font-bold bg-gradient-to-r from-yellow-400 to-orange-500 bg-clip-text text-transparent">
                Code Morph Studio
              </h1>
              <ProjectSelector
                projects={projects}
                currentProjectId={currentProjectId}
                onProjectChange={setCurrentProjectId}
                onNewProject={createNewProject}
                onExportProject={exportProject}
                onImportProject={importProject}
                onDeleteProject={deleteProject}
              />
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="p-2 text-gray-400 hover:text-yellow-400 transition-colors"
              >
                <Settings className="w-5 h-5" />
              </button>
              <button
                onClick={() => setEditorState({ isOpen: true, mode: "create" })}
                className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white px-4 py-2 rounded-lg font-semibold transition-all flex items-center"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add State
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-8">
        {/* Main Content */}
        <div className="bg-gray-800/40 backdrop-blur-xl rounded-2xl p-6 border border-gray-700/50 shadow-2xl">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-white flex items-center">
              <Code2 className="w-6 h-6 mr-2 text-yellow-400" />
              Live Code Animation
            </h2>

            <PlaybackControls
              isPlaying={isPlaying}
              onPlayPause={() => setIsPlaying(!isPlaying)}
              onPrevious={() =>
                goToState(
                  Math.max(0, (currentProject?.currentStateIndex || 0) - 1)
                )
              }
              onNext={() =>
                goToState(
                  Math.min(
                    (currentProject?.states.length || 1) - 1,
                    (currentProject?.currentStateIndex || 0) + 1
                  )
                )
              }
              onSpeedChange={setPlaybackSpeed}
              playbackSpeed={playbackSpeed}
              canPlay={!!currentProject && currentProject.states.length > 0}
              canGoBack={
                !!currentProject && currentProject.currentStateIndex > 0
              }
              canGoForward={
                !!currentProject &&
                currentProject.currentStateIndex <
                  currentProject.states.length - 1
              }
              isAnimating={isAnimating}
            />
          </div>

          {/* Code Display Area */}
          <div className="relative bg-gray-900/80 backdrop-blur-sm rounded-xl overflow-hidden min-h-[500px] border border-gray-800">
            {currentState ? (
              <>
                <div className="px-6 py-3 bg-gray-800/60 text-sm text-gray-300 border-b border-gray-700 flex items-center justify-between">
                  <span>{currentState.title}</span>
                  <div className="flex items-center space-x-4">
                    <span className="text-yellow-400 font-semibold">
                      {currentState.language.toUpperCase()}
                    </span>
                    <span className="text-xs text-gray-500">
                      {currentProject!.currentStateIndex + 1} /{" "}
                      {currentProject!.states.length}
                    </span>
                  </div>
                </div>
                <div className="p-6">
                  <AnimatedCodeDisplay
                    currentCode={currentState.code}
                    previousCode={previousState?.code || ""}
                    language={currentState.language}
                    fontSize={currentProject!.settings.fontSize}
                    showLineNumbers={currentProject!.settings.lineNumbers}
                    isAnimating={isAnimating}
                    onAnimationComplete={handleAnimationComplete}
                    manualHighlights={currentState.manualHighlights}
                    useManualHighlightsOnly={
                      currentState.useManualHighlightsOnly
                    }
                    onStartAnimation={() => setIsAnimating(true)}
                  />
                </div>
              </>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-gray-500">
                <div className="text-center">
                  <Zap className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p className="text-lg">
                    Ready to create your first code animation!
                  </p>
                  <p className="text-sm mt-2">
                    Click "Add State" to get started
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Settings Panel */}
          <AnimatePresence>
            {showSettings && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-6 pt-6 border-t border-gray-700"
              >
                <h3 className="text-lg font-semibold text-white mb-4">
                  Display Settings
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Font Size
                    </label>
                    <input
                      type="range"
                      min="12"
                      max="24"
                      value={currentProject?.settings.fontSize}
                      onChange={(e) =>
                        updateProjectSettings({
                          fontSize: parseInt(e.target.value),
                        })
                      }
                      className="w-full accent-yellow-500"
                    />
                    <span className="text-sm text-gray-400">
                      {currentProject?.settings.fontSize}px
                    </span>
                  </div>

                  <div>
                    <label className="flex items-center text-sm font-medium text-gray-300">
                      <input
                        type="checkbox"
                        checked={currentProject?.settings.lineNumbers}
                        onChange={(e) =>
                          updateProjectSettings({
                            lineNumbers: e.target.checked,
                          })
                        }
                        className="mr-2 accent-yellow-500"
                      />
                      Show line numbers
                    </label>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* States Timeline */}
        {currentProject && (
          <div className="mt-8">
            <StateTimeline
              states={currentProject.states}
              currentStateIndex={currentProject.currentStateIndex}
              onStateSelect={goToState}
              onStateEdit={handleStateEdit}
              onStateDelete={deleteState}
              isAnimating={isAnimating}
            />
          </div>
        )}
      </div>

      {/* State Editor Modal */}
      <AnimatePresence>
        {editorState.isOpen && (
          <StateEditor
            state={editorState.state}
            previousState={
              editorState.mode === "create"
                ? getPreviousStateForEditor()
                : undefined
            }
            isOpen={editorState.isOpen}
            onSave={handleStateSave}
            onCancel={() => setEditorState({ isOpen: false, mode: "create" })}
            mode={editorState.mode}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;
