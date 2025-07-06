import React from 'react';
import { motion } from 'framer-motion';
import { Trash2, Edit, Play } from 'lucide-react';

interface CodeState {
  id: string;
  code: string;
  language: string;
  title: string;
  timestamp: number;
}

interface StateTimelineProps {
  states: CodeState[];
  currentStateIndex: number;
  onStateSelect: (index: number) => void;
  onStateEdit: (state: CodeState, index: number) => void;
  onStateDelete: (stateId: string) => void;
  isAnimating: boolean;
}

export const StateTimeline: React.FC<StateTimelineProps> = ({
  states,
  currentStateIndex,
  onStateSelect,
  onStateEdit,
  onStateDelete,
  isAnimating
}) => {
  if (states.length === 0) return null;

  return (
    <div className="bg-gray-800/40 backdrop-blur-xl rounded-2xl p-6 border border-gray-700/50 shadow-2xl">
      <h3 className="text-lg font-semibold text-white mb-4">Animation Timeline</h3>
      <div className="flex flex-wrap gap-3">
        {states.map((state, index) => (
          <motion.div
            key={state.id}
            className={`relative group flex items-center space-x-2 px-4 py-3 rounded-lg cursor-pointer transition-all ${
              index === currentStateIndex
                ? 'bg-gradient-to-r from-yellow-500 to-orange-600 text-white shadow-lg'
                : 'bg-gray-700/50 text-gray-300 hover:bg-gray-600/50'
            }`}
            onClick={() => !isAnimating && onStateSelect(index)}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <div className="flex items-center space-x-2">
              <Play className="w-3 h-3" />
              <div className="flex flex-col">
                <span className="text-sm font-medium">{state.title}</span>
                <span className="text-xs opacity-75">{state.language.toUpperCase()}</span>
              </div>
            </div>
            
            <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onStateEdit(state, index);
                }}
                className="p-1 text-blue-400 hover:text-blue-300 transition-colors"
                title="Edit state"
              >
                <Edit className="w-3 h-3" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onStateDelete(state.id);
                }}
                className="p-1 text-red-400 hover:text-red-300 transition-colors"
                title="Delete state"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};