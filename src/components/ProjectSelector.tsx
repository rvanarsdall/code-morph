import React from 'react';
import { Plus, Download, Upload, Trash2 } from 'lucide-react';

interface Project {
  id: string;
  name: string;
  states: any[];
  currentStateIndex: number;
  settings: any;
}

interface ProjectSelectorProps {
  projects: Project[];
  currentProjectId: string | null;
  onProjectChange: (projectId: string) => void;
  onNewProject: () => void;
  onExportProject: () => void;
  onImportProject: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onDeleteProject: (projectId: string) => void;
}

export const ProjectSelector: React.FC<ProjectSelectorProps> = ({
  projects,
  currentProjectId,
  onProjectChange,
  onNewProject,
  onExportProject,
  onImportProject,
  onDeleteProject
}) => {
  const currentProject = projects.find(p => p.id === currentProjectId);

  return (
    <div className="flex items-center space-x-4">
      <div className="flex items-center space-x-2">
        <select
          value={currentProjectId || ''}
          onChange={(e) => onProjectChange(e.target.value)}
          className="bg-gray-800/80 text-white px-4 py-2 rounded-lg border border-gray-600 focus:border-yellow-500 focus:outline-none backdrop-blur-sm min-w-[200px]"
        >
          {projects.map(project => (
            <option key={project.id} value={project.id}>
              {project.name} ({project.states.length} states)
            </option>
          ))}
        </select>
        
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
        
        <label className="p-2 text-gray-400 hover:text-yellow-400 transition-colors cursor-pointer" title="Import project">
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