/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Role, ROLE_DEFINITIONS } from '../../types/workflow.ts';
import { Code2, BookOpen, Users, CheckCircle2, FolderGit2, ChevronDown } from 'lucide-react';

interface RoleSelectorProps {
  currentRole: Role;
  onRoleChange: (role: Role) => void;
  variant?: 'compact' | 'expanded';
}

const ROLE_ICONS: Record<Role, React.ComponentType<{ className?: string }>> = {
  developer: Code2,
  product_owner: BookOpen,
  scrum_master: Users,
  qa_engineer: CheckCircle2,
  engineering_manager: FolderGit2,
};

export const RoleSelector: React.FC<RoleSelectorProps> = ({
  currentRole,
  onRoleChange,
  variant = 'compact',
}) => {
  const roles: Role[] = [
    'developer',
    'product_owner',
    'scrum_master',
    'qa_engineer',
    'engineering_manager',
  ];

  if (variant === 'expanded') {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-5 gap-2" role="radiogroup" aria-label="Select delivery role">
        {roles.map((roleKey) => {
          const def = ROLE_DEFINITIONS[roleKey];
          const Icon = ROLE_ICONS[roleKey];
          const isSelected = currentRole === roleKey;

          return (
            <button
              key={roleKey}
              role="radio"
              aria-checked={isSelected}
              onClick={() => onRoleChange(roleKey)}
              className={`p-3 rounded-lg border text-left transition-all flex flex-col justify-between ${
                isSelected
                  ? 'bg-blue-600/15 border-blue-500 text-white shadow-sm'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <div
                  className={`p-1.5 rounded ${
                    isSelected ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <span className="font-semibold text-xs text-white truncate">{def.shortLabel}</span>
              </div>
              <p className="text-[11px] text-slate-400 line-clamp-2 leading-tight">{def.name}</p>
            </button>
          );
        })}
      </div>
    );
  }

  // Compact dropdown / select variant
  return (
    <div className="relative inline-block w-full">
      <label htmlFor="role-select" className="sr-only">
        Active Delivery Role
      </label>
      <div className="relative">
        <select
          id="role-select"
          value={currentRole}
          onChange={(e) => onRoleChange(e.target.value as Role)}
          className="w-full appearance-none bg-slate-900/90 border border-slate-700/80 rounded-md py-1.5 pl-8 pr-8 text-xs font-medium text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
        >
          {roles.map((r) => (
            <option key={r} value={r}>
              {ROLE_DEFINITIONS[r].name}
            </option>
          ))}
        </select>
        <div className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-blue-400">
          {React.createElement(ROLE_ICONS[currentRole], { className: 'w-3.5 h-3.5' })}
        </div>
        <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
          <ChevronDown className="w-3.5 h-3.5" />
        </div>
      </div>
    </div>
  );
};
