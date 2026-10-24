/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Role } from '../../types/workflow.ts';
import { RoleSelector } from './RoleSelector.tsx';
import { Shield, BookOpen, Menu, Layers } from 'lucide-react';

interface TopBarProps {
  currentRole: Role;
  onRoleChange: (role: Role) => void;
  onToggleSidebar?: () => void;
  onOpenSpecs: () => void;
  isSpecsOpen: boolean;
}

export const TopBar: React.FC<TopBarProps> = ({
  currentRole,
  onRoleChange,
  onToggleSidebar,
  onOpenSpecs,
  isSpecsOpen,
}) => {
  return (
    <header className="border-b border-slate-800 bg-slate-900/95 backdrop-blur sticky top-0 z-40 px-3 sm:px-6 py-2.5 flex items-center justify-between gap-3">
      {/* Brand & Mobile Toggle */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            aria-label="Toggle navigation sidebar"
            className="p-1.5 rounded-md hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors hidden md:block"
          >
            <Menu className="w-4 h-4" />
          </button>
        )}

        <div className="w-8 h-8 rounded-md bg-blue-600 flex items-center justify-center font-mono font-bold text-sm text-white shadow-sm shadow-blue-500/20">
          DR
        </div>

        <div>
          <div className="flex items-center gap-2">
            <span className="font-bold tracking-tight text-white text-sm sm:text-base">DevRelief</span>
            <span className="hidden sm:inline-block text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-700/50">
              M1 Active
            </span>
          </div>
          <span className="text-[11px] text-slate-400 hidden lg:block -mt-0.5">
            Local-first productivity workbench
          </span>
        </div>
      </div>

      {/* Center: Role Selector Dropdown */}
      <div className="w-44 sm:w-56 shrink-0">
        <RoleSelector currentRole={currentRole} onRoleChange={onRoleChange} variant="compact" />
      </div>

      {/* Right Controls: Mode Badge & Docs Button */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800/80 border border-slate-700/60 text-xs text-slate-300">
          <Shield className="w-3.5 h-3.5 text-emerald-400" />
          <span className="hidden md:inline text-slate-400">Engine:</span>
          <strong className="text-emerald-400 font-medium">Deterministic Core</strong>
        </div>

        <button
          onClick={onOpenSpecs}
          className={`px-2.5 py-1 rounded text-xs font-medium border transition-colors flex items-center gap-1.5 ${
            isSpecsOpen
              ? 'bg-blue-600/20 border-blue-500 text-blue-300'
              : 'bg-slate-800/80 hover:bg-slate-700 border-slate-700 text-slate-300'
          }`}
          aria-label="View M0 Foundation Specifications"
        >
          <BookOpen className="w-3.5 h-3.5 text-blue-400" />
          <span className="hidden sm:inline">M0 Specs</span>
        </button>
      </div>
    </header>
  );
};
