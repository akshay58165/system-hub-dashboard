import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Layers, 
  Globe, 
  Clock, 
  GitBranch, 
  Plus, 
  Server, 
  AlertTriangle, 
  CheckCircle, 
  TrendingUp, 
  Cpu, 
  LineChart, 
  Loader2, 
  Flame,
  ArrowUpRight,
  Sparkles,
  Search
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  LineChart as RechartLine, 
  Line, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid 
} from 'recharts';
import { VercelProject, VercelDeployment, SystemEvent } from '../types';

interface VercelViewProps {
  projects: VercelProject[];
  onAddEvent: (evt: SystemEvent) => void;
  onUpdateProject: (projectId: string, updatedProject: Partial<VercelProject>) => void;
}

export default function VercelView({ projects, onAddEvent, onUpdateProject }: VercelViewProps) {
  const [selectedProjectId, setSelectedProjectId] = useState(projects[0]?.id || '');
  const [activeDeploymentId, setActiveDeploymentId] = useState<string | null>(null);
  const [liveLogs, setLiveLogs] = useState<string[]>([]);
  const [deployStep, setDeployStep] = useState(0);

  const selectedProject = projects.find(p => p.id === selectedProjectId) || projects[0];

  const handleTriggerDeploy = () => {
    if (activeDeploymentId) return; // one deployment build at a time

    // 1. Generate a new queued deployment
    const newDeploymentId = `vdep-manual-${Date.now()}`;
    const newDeployment: VercelDeployment = {
      id: newDeploymentId,
      url: `${selectedProject.name}-manual-${Math.random().toString(36).substring(2, 7)}.vercel.app`,
      branch: selectedProject.gitBranch,
      commitMessage: 'manual deploy: manual sync triggered from Developer Console',
      status: 'building',
      createdAt: new Date().toISOString(),
      creator: 'typeakshay@gmail.com',
      logs: ['Deploy started via manual dashboard trigger...'],
    };

    const updatedDeployments = [newDeployment, ...selectedProject.deployments];
    
    onUpdateProject(selectedProject.id, {
      status: 'building',
      deployments: updatedDeployments,
    });

    setActiveDeploymentId(newDeploymentId);
    setLiveLogs([
      'Queuing build runner...',
      'Allocating hardware node: vpc-node-us-east-4a',
      'Cloning code repository target from Git server...',
      'Detected lockfile configuration: package-lock.json',
    ]);
    setDeployStep(0);

    onAddEvent({
      id: `evt-v-dep-${Date.now()}`,
      source: 'vercel',
      type: 'info',
      message: `Vercel: Commenced manual deployment for project "${selectedProject.name}" on branch "${selectedProject.gitBranch}"`,
      timestamp: new Date().toISOString(),
    });
  };

  // Live streaming logs
  useEffect(() => {
    if (!activeDeploymentId) return;

    const buildSteps = [
      'Compiling React + Vite core assets using @tailwindcss/vite compiler...',
      'Minifying index bundles, tree-shaking dead components...',
      'Generated static html nodes, index assets map parsed.',
      'Checking API Serverless endpoints: /api/auth/session, /api/checkout...',
      'Generating routing configurations & response security headers...',
      'Publishing build assets to Vercel global edge server locations...',
      'Validating SSL certificate configurations...',
      'Deployment live! Production routing rule updated successfully.'
    ];

    if (deployStep < buildSteps.length) {
      const timer = setTimeout(() => {
        setLiveLogs(prev => [...prev, `[BUILD] ${buildSteps[deployStep]}`]);
        setDeployStep(prev => prev + 1);
      }, 1100);
      return () => clearTimeout(timer);
    } else {
      // Completed successfully!
      const timer = setTimeout(() => {
        const updatedDeployments = selectedProject.deployments.map(dep => {
          if (dep.id === activeDeploymentId) {
            return {
              ...dep,
              status: 'ready' as const,
              duration: '1m 8s',
              url: `${selectedProject.name}-prod.vercel.app`
            };
          }
          return dep;
        });

        onUpdateProject(selectedProject.id, {
          status: 'ready',
          updatedAt: new Date().toISOString(),
          domain: `${selectedProject.name}-prod.vercel.app`,
          deployments: updatedDeployments,
        });

        setActiveDeploymentId(null);

        onAddEvent({
          id: `evt-v-dep-sc-${Date.now()}`,
          source: 'vercel',
          type: 'success',
          message: `Vercel: Deployment for "${selectedProject.name}" is now LIVE at ${selectedProject.name}-prod.vercel.app`,
          timestamp: new Date().toISOString(),
        });
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [activeDeploymentId, deployStep]);

  return (
    <div className="space-y-6">
      {/* Selector banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-neutral-950 border border-neutral-800 rounded-xl p-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-neutral-900 border border-neutral-800 rounded-lg text-neutral-300">
            <Layers className="h-5 w-5 text-blue-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-neutral-100 font-mono">vercel.com/typeakshay</h2>
            <p className="text-xs text-neutral-400">Manage hosting endpoints, edge domains, serverless logs, and user traffic.</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          {projects.map(proj => (
            <button
              key={proj.id}
              onClick={() => setSelectedProjectId(proj.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono border transition ${
                selectedProjectId === proj.id
                  ? 'bg-neutral-800 border-neutral-600 text-white'
                  : 'bg-neutral-900 border-neutral-850 text-neutral-400 hover:text-neutral-200 hover:border-neutral-700'
              }`}
            >
              {proj.name}
            </button>
          ))}
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Side (Deployment Control) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Active project card */}
          <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-5 relative overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold font-mono text-white tracking-tight flex items-center gap-2">
                  {selectedProject.name}
                  <span className={`h-2.5 w-2.5 rounded-full ${
                    selectedProject.status === 'ready' ? 'bg-emerald-500 animate-pulse' :
                    selectedProject.status === 'building' ? 'bg-blue-400 animate-spin' :
                    'bg-neutral-600'
                  }`} />
                </h3>
                <div className="flex items-center gap-2 mt-1 text-xs text-neutral-400 font-mono">
                  <Globe className="h-3.5 w-3.5 text-neutral-500" />
                  <a href={`https://${selectedProject.domain}`} target="_blank" rel="noreferrer" className="hover:text-blue-400 transition flex items-center gap-0.5">
                    {selectedProject.domain}
                    <ArrowUpRight className="h-3 w-3" />
                  </a>
                </div>
              </div>

              <button 
                onClick={handleTriggerDeploy}
                disabled={activeDeploymentId !== null || selectedProject.status === 'building'}
                className="px-3.5 py-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-black font-semibold rounded-lg text-xs font-mono flex items-center gap-1.5 transition self-start sm:self-auto"
              >
                {activeDeploymentId ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Deploying...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5 fill-black" />
                    <span>Deploy Latest Code</span>
                  </>
                )}
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-5 border-t border-neutral-900">
              <div className="p-3 bg-neutral-900 rounded-lg">
                <span className="text-[10px] uppercase font-semibold text-neutral-500 tracking-wider font-mono">Framework</span>
                <span className="text-xs font-bold font-mono text-white mt-1 block">
                  {selectedProject.framework}
                </span>
              </div>

              <div className="p-3 bg-neutral-900 rounded-lg">
                <span className="text-[10px] uppercase font-semibold text-neutral-500 tracking-wider font-mono">Production branch</span>
                <span className="text-xs font-bold font-mono text-white mt-1 flex items-center gap-1">
                  <GitBranch className="h-3 w-3 text-blue-400" />
                  {selectedProject.gitBranch}
                </span>
              </div>

              <div className="p-3 bg-neutral-900 rounded-lg">
                <span className="text-[10px] uppercase font-semibold text-neutral-500 tracking-wider font-mono">Updated</span>
                <span className="text-xs font-bold font-mono text-white mt-1 block">
                  {new Date(selectedProject.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>

              <div className="p-3 bg-neutral-900 rounded-lg">
                <span className="text-[10px] uppercase font-semibold text-neutral-500 tracking-wider font-mono">Edge Latency</span>
                <span className="text-xs font-bold font-mono text-emerald-400 mt-1 block">
                  14ms (Optimal)
                </span>
              </div>
            </div>
          </div>

          {/* Traffic chart for selected project */}
          <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-neutral-200 mb-4">Traffic Statistics</h3>
            <div className="h-60 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <RechartLine data={selectedProject.analytics.traffic} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                  <XAxis dataKey="date" stroke="#525252" fontSize={10} fontStyle="italic" />
                  <YAxis stroke="#525252" fontSize={10} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#171717', borderColor: '#262626', borderRadius: '8px' }}
                    labelStyle={{ color: '#a3a3a3', fontSize: '11px' }}
                  />
                  <CartesianGrid stroke="#262626" strokeDasharray="3 3" />
                  <Line type="monotone" dataKey="views" name="Pageviews" stroke="#3b82f6" strokeWidth={2.5} activeDot={{ r: 6 }} />
                  <Line type="monotone" dataKey="visitors" name="Unique Visitors" stroke="#10b981" strokeWidth={2.5} />
                </RechartLine>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Logs Terminal */}
          <AnimatePresence>
            {(activeDeploymentId || liveLogs.length > 0) && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="bg-neutral-950 border border-neutral-800 rounded-xl overflow-hidden"
              >
                <div className="bg-neutral-900 border-b border-neutral-800 px-4 py-2 flex items-center justify-between font-mono text-xs text-neutral-400">
                  <div className="flex items-center gap-2">
                    <Loader2 className={`h-4 w-4 text-blue-400 ${activeDeploymentId ? 'animate-spin' : ''}`} />
                    <span>Vercel Deploy Build Engine Logs</span>
                  </div>
                  {activeDeploymentId ? (
                    <span className="text-blue-400 animate-pulse font-bold text-[10px] uppercase">BUILDING</span>
                  ) : (
                    <span className="text-emerald-400 font-bold text-[10px] uppercase">DEPLOY READY</span>
                  )}
                </div>
                <div className="p-4 bg-neutral-950 font-mono text-xs text-neutral-400 h-56 overflow-y-auto space-y-1">
                  {liveLogs.map((log, i) => (
                    <div key={i} className={`whitespace-pre-wrap ${log.includes('live') || log.includes('successfully') ? 'text-emerald-400 font-bold' : log.includes('[BUILD]') ? 'text-neutral-400' : 'text-neutral-500'}`}>
                      {log}
                    </div>
                  ))}
                  {activeDeploymentId && <span className="inline-block h-3.5 w-2 bg-neutral-300 animate-pulse" />}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right Side (Deployments History / Serverless Functions) */}
        <div className="space-y-6">
          {/* History */}
          <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-neutral-200 mb-4">Deployment History</h3>
            <div className="space-y-4 max-h-72 overflow-y-auto pr-1">
              {selectedProject.deployments.map(dep => (
                <div key={dep.id} className="p-3 bg-neutral-900/60 border border-neutral-850 rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-neutral-500 truncate max-w-[120px]">{dep.url}</span>
                    <span className={`px-1.5 py-0.2 rounded font-mono text-[9px] uppercase font-semibold ${
                      dep.status === 'ready' ? 'bg-emerald-950/85 text-emerald-400 border border-emerald-900' :
                      dep.status === 'building' ? 'bg-blue-950/85 text-blue-400 border border-blue-900 animate-pulse' :
                      'bg-neutral-800 text-neutral-400'
                    }`}>
                      {dep.status}
                    </span>
                  </div>
                  
                  <p className="text-[11px] text-neutral-300 font-mono break-all font-semibold leading-snug">
                    {dep.commitMessage}
                  </p>

                  <div className="flex items-center justify-between text-[10px] text-neutral-500 font-mono pt-1">
                    <span>by {dep.creator}</span>
                    <span>{new Date(dep.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Serverless Functions performance list */}
          <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-neutral-200">Serverless APIs</h3>
              <Server className="h-4 w-4 text-neutral-500" />
            </div>

            <div className="space-y-3">
              {selectedProject.serverlessFunctions.length === 0 ? (
                <p className="text-xs text-neutral-500 italic font-mono text-center py-4">No serverless functions hosted</p>
              ) : (
                selectedProject.serverlessFunctions.map(func => (
                  <div key={func.id} className="p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-mono font-semibold text-neutral-200">{func.path}</span>
                      {func.errors > 20 ? (
                        <span className="px-1.5 py-0.2 bg-rose-950 text-rose-400 text-[8px] font-mono font-semibold uppercase rounded">High Errors</span>
                      ) : (
                        <span className="px-1.5 py-0.2 bg-emerald-950 text-emerald-400 text-[8px] font-mono font-semibold uppercase rounded">Stable</span>
                      )}
                    </div>

                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-neutral-850 text-center font-mono text-[10px] text-neutral-500">
                      <div>
                        <span className="block text-neutral-500">Invocations</span>
                        <span className="font-semibold text-neutral-300 mt-0.5 block">{func.invocations.toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="block text-neutral-500">Errors</span>
                        <span className={`font-semibold mt-0.5 block ${func.errors > 0 ? 'text-rose-400' : 'text-neutral-300'}`}>{func.errors}</span>
                      </div>
                      <div>
                        <span className="block text-neutral-500">Latency</span>
                        <span className="font-semibold text-neutral-300 mt-0.5 block">{func.avgDurationMs}ms</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
