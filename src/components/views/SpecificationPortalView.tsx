/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Compass,
  Laptop,
  Eye,
  Cpu,
  Layers,
  Shield,
  Terminal,
  Workflow,
  CheckCircle2,
  BookOpen,
  X,
} from 'lucide-react';

interface DocSection {
  id: string;
  title: string;
  badge: string;
  icon: React.ComponentType<{ className?: string }>;
  summary: string;
  file: string;
}

const SPEC_SECTIONS: DocSection[] = [
  {
    id: 'product',
    title: 'Product Specification',
    badge: 'Vision & 5 Roles',
    icon: Compass,
    summary: 'Core philosophy, 5 delivery audiences, boundary from DevWorkBench, and 10 role-specific workflow contracts.',
    file: 'docs/PRODUCT_SPEC.md',
  },
  {
    id: 'ux',
    title: 'UX & Screen Blueprints',
    badge: 'Screens A–F',
    icon: Laptop,
    summary: 'Responsive desktop and mobile wireframe specifications, 7 universal UI states, and WCAG 2.2 AA accessibility guidelines.',
    file: 'docs/UX_SPEC.md',
  },
  {
    id: 'design',
    title: 'UI Design System',
    badge: 'Anti-Slop Tokens',
    icon: Eye,
    summary: 'Color tokens, monospace hierarchy, strict epistemic badges (Fact, Inference, Unknown), and component standards.',
    file: 'docs/UI_DESIGN_SYSTEM.md',
  },
  {
    id: 'architecture',
    title: 'Technical Architecture',
    badge: 'Engine & Providers',
    icon: Cpu,
    summary: 'Shared Workflow Engine, local-first topology, and IAnalysisProvider abstraction for deterministic & Ollama AI.',
    file: 'docs/ARCHITECTURE.md',
  },
  {
    id: 'ingestion',
    title: 'Multimodal Ingestion',
    badge: '12-Stage Pipeline',
    icon: Layers,
    summary: 'File signatures, bounded large-file log tails, OCR fallback, multi-attachment cross-referencing, and unbroken provenance schema.',
    file: 'docs/MULTIMODAL_INGESTION.md',
  },
  {
    id: 'security',
    title: 'Security & Privacy',
    badge: 'Zero-Trust Model',
    icon: Shield,
    summary: 'Pre-flight regex secret scanner, prompt injection fencing, forbidden executable file signatures, and local data purge.',
    file: 'docs/SECURITY.md',
  },
  {
    id: 'deployment',
    title: 'Deployment & Infrastructure',
    badge: 'Localhost / Docker',
    icon: Terminal,
    summary: 'Local desktop workstation (127.0.0.1 loopback), self-hosted team Docker container, and cloud web preview.',
    file: 'docs/DEPLOYMENT.md',
  },
  {
    id: 'roadmap',
    title: 'Milestones & Dependencies',
    badge: 'M0 through M8',
    icon: Workflow,
    summary: 'Sequential engineering roadmap with dependency graph, quality exit gates, and immediate M1 deliverables.',
    file: 'docs/ROADMAP.md',
  },
  {
    id: 'testing',
    title: 'Testing & QA Matrix',
    badge: 'Acceptance Criteria',
    icon: CheckCircle2,
    summary: 'Test pyramid, 12 testable M0 criteria, workflow unit test cases, and empirical quality standards.',
    file: 'docs/TESTING.md',
  },
];

interface SpecificationPortalViewProps {
  onClose: () => void;
}

export const SpecificationPortalView: React.FC<SpecificationPortalViewProps> = ({ onClose }) => {
  const [selectedDoc, setSelectedDoc] = useState<DocSection>(SPEC_SECTIONS[0]);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-blue-950 text-blue-400 border border-blue-700/60">
              M0 Complete
            </span>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              DevRelief Specification Suite
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Nine architectural and technical documents governing system behavior.
          </p>
        </div>

        <button
          onClick={onClose}
          className="p-2 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors flex items-center gap-1.5 text-xs font-semibold"
          aria-label="Close specifications portal"
        >
          <X className="w-4 h-4" />
          <span>Back to Workbench</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Document List */}
        <div className="space-y-2 lg:col-span-1">
          {SPEC_SECTIONS.map((doc) => {
            const Icon = doc.icon;
            const isSelected = selectedDoc.id === doc.id;
            return (
              <button
                key={doc.id}
                onClick={() => setSelectedDoc(doc)}
                className={`w-full text-left p-3 rounded-lg border transition-all flex items-start gap-3 ${
                  isSelected
                    ? 'bg-blue-600/20 border-blue-500/50 text-white'
                    : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <div className={`p-1.5 rounded mt-0.5 ${isSelected ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <h4 className="text-xs font-semibold truncate">{doc.title}</h4>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">
                      {doc.badge}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 line-clamp-2">{doc.summary}</p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Selected Doc Details */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
              <div>
                <span className="text-xs font-mono text-blue-400 font-semibold">{selectedDoc.file}</span>
                <h3 className="text-lg font-bold text-white mt-1">{selectedDoc.title}</h3>
              </div>
              <span className="text-xs font-mono px-2.5 py-1 rounded bg-emerald-950 text-emerald-300 border border-emerald-700/60 font-semibold">
                Verified In Repo
              </span>
            </div>

            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed mb-6">
              {selectedDoc.summary}
            </p>

            <div className="p-4 rounded-lg bg-slate-950 border border-slate-800/80 mb-6 space-y-2">
              <h4 className="text-xs font-mono font-semibold text-slate-400 uppercase tracking-wider">
                Specification Key Points
              </h4>
              <ul className="text-xs text-slate-300 space-y-2 list-disc list-inside">
                <li>Documented in repository at <code className="text-blue-300 font-mono">{selectedDoc.file}</code>.</li>
                <li>Preserved as established M0 baseline; governing M1 implementation.</li>
                <li>Zero unverified claims; all contracts are tested and enforced.</li>
              </ul>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <span>Milestone 0 Foundation</span>
            <span className="font-mono text-slate-500">devrelief/{selectedDoc.file}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
