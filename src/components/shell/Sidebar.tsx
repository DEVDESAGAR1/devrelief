/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Role, ROLE_DEFINITIONS } from '../../types/workflow.ts';
import {
  Compass,
  Layers,
  FileText,
  Settings,
  ChevronLeft,
  ChevronRight,
  Shield,
  Sparkles,
  GitCommit,
} from 'lucide-react';

export type NavView = 'home' | 'ask' | 'catalogue' | 'digest' | 'settings';

interface SidebarProps {
  currentView: NavView;
  onNavigate: (view: NavView) => void;
  currentRole: Role;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onNavigate,
  currentRole,
  isCollapsed,
  onToggleCollapse,
}) => {
  const roleDef = ROLE_DEFINITIONS[currentRole];

  const navItems = [
    {
      id: 'home' as NavView,
      label: 'Command Center',
      shortLabel: 'Home',
      icon: Compass,
      description: 'Screen A — Role overview & quick tasks',
    },
    {
      id: 'ask' as NavView,
      label: 'Ask DevRelief',
      shortLabel: 'Ask',
      icon: Sparkles,
      badge: 'M2',
      description: 'Screen B — Multimodal evidence canvas',
    },
    {
      id: 'digest' as NavView,
      label: 'Workflow Runner',
      shortLabel: 'Runner',
      icon: GitCommit,
      badge: '10 WFs',
      description: 'Screen D — 10 implemented workflows across 5 delivery roles',
    },
    {
      id: 'catalogue' as NavView,
      label: 'Workflow Catalogue',
      shortLabel: 'Workflows',
      icon: Layers,
      description: 'Screen C — 5-role directory',
    },
    {
      id: 'settings' as NavView,
      label: 'Settings & Privacy',
      shortLabel: 'Settings',
      icon: Settings,
      description: 'Screen F — Local engine configuration',
    },
  ];

  return (
    <aside
      className={`hidden md:flex flex-col border-r border-slate-800 bg-slate-900/70 transition-all duration-200 shrink-0 ${
        isCollapsed ? 'w-16' : 'w-60'
      }`}
      aria-label="Desktop primary sidebar"
    >
      {/* Role Banner */}
      {!isCollapsed ? (
        <div className="p-3 border-b border-slate-800/80 bg-slate-900/90">
          <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1">
            Active Role Filter
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-400"></span>
            <span className="text-xs font-semibold text-white truncate">{roleDef.name}</span>
          </div>
        </div>
      ) : (
        <div className="py-3 border-b border-slate-800/80 flex justify-center">
          <span className="w-2 h-2 rounded-full bg-blue-400" title={roleDef.name}></span>
        </div>
      )}

      {/* Navigation Items */}
      <nav className="flex-1 p-2 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              title={isCollapsed ? item.label : undefined}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-xs font-medium transition-colors text-left ${
                isActive
                  ? 'bg-blue-600/20 text-blue-400 border border-blue-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {!isCollapsed && (
                <div className="flex-1 min-w-0 flex items-center justify-between">
                  <span className="truncate">{item.label}</span>
                  {item.badge && (
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-400 border border-emerald-800/50">
                      {item.badge}
                    </span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </nav>

      {/* Collapse Toggle & Footer Privacy Strip */}
      <div className="p-2 border-t border-slate-800/80 space-y-2">
        {!isCollapsed && (
          <div className="px-2.5 py-2 rounded bg-slate-950/80 border border-slate-800 text-[11px] text-slate-400">
            <div className="flex items-center gap-1.5 text-slate-300 font-medium mb-0.5">
              <Shield className="w-3 h-3 text-emerald-400" />
              <span>Local-First Boundary</span>
            </div>
            <p className="text-[10px] text-slate-500 leading-tight">
              0 network telemetry. 100% deterministic on-device processing.
            </p>
          </div>
        )}

        <button
          onClick={onToggleCollapse}
          className="w-full flex items-center justify-center p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors text-xs"
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>
    </aside>
  );
};
