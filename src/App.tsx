/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Role, WorkflowId } from './types/workflow.ts';
import { TopBar } from './components/shell/TopBar.tsx';
import { Sidebar, NavView } from './components/shell/Sidebar.tsx';
import { MobileNav } from './components/shell/MobileNav.tsx';
import { CommandCenterView } from './components/views/CommandCenterView.tsx';
import { AskWorkspaceView } from './components/views/AskWorkspaceView.tsx';
import { WorkflowCatalogueView } from './components/views/WorkflowCatalogueView.tsx';
import { WorkflowRunnerView } from './components/views/WorkflowRunnerView.tsx';
import { SettingsView } from './components/views/SettingsView.tsx';
import { SpecificationPortalView } from './components/views/SpecificationPortalView.tsx';

export default function App() {
  const [currentRole, setCurrentRole] = useState<Role>('developer');
  const [currentView, setCurrentView] = useState<NavView>('home');
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<WorkflowId>('WF-DEV-01');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isSpecsOpen, setIsSpecsOpen] = useState(false);

  const handleRoleChange = (role: Role) => {
    setCurrentRole(role);
  };

  const handleNavigate = (view: NavView) => {
    setCurrentView(view);
    setIsSpecsOpen(false);
  };

  const handleSelectWorkflow = (wfId: WorkflowId) => {
    setSelectedWorkflowId(wfId);
    setCurrentView('digest');
    setIsSpecsOpen(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-blue-600 selection:text-white overflow-x-hidden">
      {/* Top Application Bar */}
      <TopBar
        currentRole={currentRole}
        onRoleChange={handleRoleChange}
        onToggleSidebar={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        onOpenSpecs={() => setIsSpecsOpen(!isSpecsOpen)}
        isSpecsOpen={isSpecsOpen}
      />

      {/* Main Body Layout (Sidebar + Workbench Canvas) */}
      <div className="flex-1 flex overflow-hidden">
        {/* Desktop Collapsible Navigation Sidebar */}
        <Sidebar
          currentView={currentView}
          onNavigate={handleNavigate}
          currentRole={currentRole}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        />

        {/* Primary View Container */}
        <main
          className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 pb-20 md:pb-8 w-full max-w-full"
          id="main-content"
          tabIndex={-1}
        >
          {isSpecsOpen ? (
            <SpecificationPortalView onClose={() => setIsSpecsOpen(false)} />
          ) : (
            <>
              {currentView === 'home' && (
                <CommandCenterView
                  currentRole={currentRole}
                  onNavigate={handleNavigate}
                  onOpenSpecs={() => setIsSpecsOpen(true)}
                />
              )}

              {currentView === 'ask' && <AskWorkspaceView />}

              {currentView === 'catalogue' && (
                <WorkflowCatalogueView
                  currentRole={currentRole}
                  onNavigate={handleNavigate}
                  onSelectWorkflow={handleSelectWorkflow}
                  onOpenSpecs={() => setIsSpecsOpen(true)}
                />
              )}

              {currentView === 'digest' && (
                <WorkflowRunnerView initialWorkflowId={selectedWorkflowId} />
              )}

              {currentView === 'settings' && <SettingsView />}
            </>
          )}
        </main>
      </div>

      {/* Mobile Ergonomic Bottom Navigation */}
      <MobileNav currentView={currentView} onNavigate={handleNavigate} />
    </div>
  );
}
