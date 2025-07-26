import React, { useState, useRef, useEffect } from "react";
import { Plus, Download, Upload, Trash2, Edit, Check } from "lucide-react";

interface Project {
  id: string;
  name: string;
  states: Array<any>; // Using Array<any> instead of any[]
  currentStateIndex: number;
  settings: Record<string, any>; // Using Record instead of any
}

interface ProjectSelectorProps {
  projects: Project[];
  currentProjectId: string | null;
  onProjectChange: (projectId: string) => void;
  onNewProject: () => void;
  onExportProject: () => void;
  onImportProject: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onDeleteProject: (projectId: string) => void;
  onRenameProject?: (projectId: string, newName: string) => void;
}

export const ProjectSelector: React.FC<ProjectSelectorProps> = ({
  projects,
  currentProjectId,
  onProjectChange,
  onNewProject,
  onExportProject,
  onImportProject,
  onDeleteProject,
  onRenameProject,
}) => {
  const currentProject = projects.find((p) => p.id === currentProjectId);
  const [editingProject, setEditingProject] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);

  // Focus input when editing starts
  useEffect(() => {
    if (editingProject && editInputRef.current) {
      editInputRef.current.focus();
    }
  }, [editingProject]);

  const startEditing = (projectId: string, currentName: string) => {
    setEditingProject(projectId);
    setEditName(currentName);
  };

  const saveProjectName = () => {
    if (editingProject && onRenameProject && editName.trim()) {
      onRenameProject(editingProject, editName.trim());
      setEditingProject(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      saveProjectName();
    } else if (e.key === "Escape") {
      setEditingProject(null);
    }
  };

  return (
    <div className="flex items-center space-x-4">
      <div className="flex items-center space-x-2">
        {editingProject === currentProjectId ? (
          <div className="flex items-center">
            <input
              ref={editInputRef}
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={handleKeyDown}
              className="bg-gray-800/80 text-white px-4 py-2 rounded-lg border border-yellow-500 focus:outline-none backdrop-blur-sm min-w-[200px]"
              aria-label="Project name"
              placeholder="Project name"
            />
            <button
              onClick={saveProjectName}
              className="ml-2 p-1.5 bg-yellow-500 text-black rounded-lg hover:bg-yellow-400 transition-colors"
              title="Save project name"
            >
              <Check className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center">
            <select
              value={currentProjectId || ""}
              onChange={(e) => onProjectChange(e.target.value)}
              className="bg-gray-800/80 text-white px-4 py-2 rounded-lg border border-gray-600 focus:border-yellow-500 focus:outline-none backdrop-blur-sm min-w-[200px]"
              title="Select project"
            >
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name} ({project.states.length} states)
                </option>
              ))}
            </select>

            {currentProject && (
              <button
                onClick={() =>
                  startEditing(currentProject.id, currentProject.name)
                }
                className="ml-2 p-1.5 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 hover:text-white transition-colors"
                title="Edit project name"
              >
                <Edit className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        {currentProject && projects.length > 1 && (
          <button
            onClick={() => onDeleteProject(currentProject.id)}
            className="p-2 text-red-400 hover:text-red-300 transition-colors"
            title="Delete current project"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="flex items-center space-x-2">
        <button
          onClick={onExportProject}
          className="p-2 text-gray-400 hover:text-yellow-400 transition-colors"
          title="Export project"
        >
          <Download className="w-5 h-5" />
        </button>

        <label
          className="p-2 text-gray-400 hover:text-yellow-400 transition-colors cursor-pointer"
          title="Import project"
        >
          <Upload className="w-5 h-5" />
          <input
            type="file"
            accept=".json"
            onChange={onImportProject}
            className="hidden"
          />
        </label>

        <button
          onClick={onNewProject}
          className="bg-gradient-to-r from-yellow-500 to-orange-600 hover:from-yellow-600 hover:to-orange-700 text-white px-4 py-2 rounded-lg font-semibold transition-all flex items-center"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Project
        </button>
      </div>
    </div>
  );
};
