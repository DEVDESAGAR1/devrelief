/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { NavView } from './Sidebar.tsx';
import { Compass, Layers, GitCommit, Settings, Sparkles } from 'lucide-react';

interface MobileNavProps {
  currentView: NavView;
  onNavigate: (view: NavView) => void;
}

export const MobileNav: React.FC<MobileNavProps> = ({ currentView, onNavigate }) => {
  const items = [
    { id: 'home' as NavView, label: 'Home', icon: Compass },
    { id: 'ask' as NavView, label: 'Ask', icon: Sparkles },
    { id: 'digest' as NavView, label: 'Runner', icon: GitCommit },
    { id: 'catalogue' as NavView, label: 'Catalogue', icon: Layers },
    { id: 'settings' as NavView, label: 'Settings', icon: Settings },
  ];

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur border-t border-slate-800 px-2 py-1 flex items-center justify-around safe-area-bottom"
      aria-label="Mobile primary navigation"
    >
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = currentView === item.id;

        return (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            aria-current={isActive ? 'page' : undefined}
            className={`flex flex-col items-center justify-center min-w-[56px] min-h-[48px] px-2 py-1 rounded-md text-[10px] font-medium transition-colors ${
              isActive
                ? 'text-blue-400 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Icon className={`w-5 h-5 mb-0.5 ${isActive ? 'text-blue-400' : 'text-slate-400'}`} />
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
};
