import React, { useState } from 'react';
import { DiscordConfig, TiltifyConfig } from '../types';
import { X, Copy, Check, Download, Upload, ShieldCheck, Database, HardDrive, RefreshCw } from 'lucide-react';

interface BackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  discordConfig: DiscordConfig;
  tiltifyConfig: TiltifyConfig;
  onImportConfig: (discord: DiscordConfig, tiltify: TiltifyConfig) => Promise<boolean>;
}

export const BackupModal: React.FC<BackupModalProps> = ({
  isOpen,
  onClose,
  discordConfig,
  tiltifyConfig,
  onImportConfig,
}) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  if (!isOpen) return null;

  const currentConfigPayload = {
    discord: discordConfig,
    tiltify: tiltifyConfig,
  };

  const stringifiedConfig = JSON.stringify(currentConfigPayload);

  const handleCopy = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const handleDownload = () => {
    const blob = new Blob([JSON.stringify(currentConfigPayload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `donify-config-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        setIsImporting(true);
        setImportStatus(null);
        const parsed = JSON.parse(evt.target?.result as string);
        if (!parsed.discord && !parsed.tiltify) {
          throw new Error('Invalid Donify configuration format.');
        }
        const success = await onImportConfig(parsed.discord || discordConfig, parsed.tiltify || tiltifyConfig);
        if (success) {
          setImportStatus('✅ Configuration imported and saved successfully!');
        } else {
          setImportStatus('❌ Server failed to save imported configuration.');
        }
      } catch (err: any) {
        setImportStatus(`❌ Import error: ${err.message || 'Could not parse JSON file'}`);
      } finally {
        setIsImporting(false);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-neutral-400 hover:text-white p-1 rounded-lg transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="p-2.5 rounded-xl bg-teal-500/10 border border-teal-500/30 text-teal-400">
            <HardDrive className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Backup & Render Persistence</h2>
            <p className="text-xs text-neutral-400">
              Keep your customized dashboard settings permanent across all code redeploys
            </p>
          </div>
        </div>

        {/* Why Settings Disappear Explanation */}
        <div className="bg-neutral-950 border border-neutral-800/80 rounded-xl p-4 mb-5 text-xs text-neutral-300 space-y-2">
          <div className="flex items-center gap-2 font-semibold text-neutral-100">
            <Database className="w-4 h-4 text-indigo-400" />
            <span>Why Render Resets Local Storage on GitHub Deploys</span>
          </div>
          <p className="text-neutral-400 leading-relaxed">
            Render runs your bot in an ephemeral cloud container. When you push new code to GitHub, Render starts a fresh container. Donify now protects your settings in two automatic ways:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
            <div className="bg-neutral-900/90 border border-neutral-800 p-2.5 rounded-lg flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-medium text-emerald-300 block">Browser Auto-Restore</span>
                <span className="text-[11px] text-neutral-400">Your browser automatically preserves your settings and syncs them to Render if it starts blank.</span>
              </div>
            </div>
            <div className="bg-neutral-900/90 border border-neutral-800 p-2.5 rounded-lg flex items-start gap-2">
              <RefreshCw className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-medium text-teal-300 block">Git Config Tracking</span>
                <span className="text-[11px] text-neutral-400">Your baseline configuration is saved into <code className="text-neutral-200">data/app-config.json</code> in your repository.</span>
              </div>
            </div>
          </div>
        </div>

        {/* Permanent Render Persistence via Environment Variable */}
        <div className="bg-gradient-to-br from-indigo-950/40 via-neutral-900 to-neutral-950 border border-indigo-800/50 rounded-xl p-4 mb-5">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h3 className="text-sm font-semibold text-white flex items-center gap-1.5">
                <span>Permanently Lock Settings in Render</span>
                <span className="text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-full font-bold">Recommended</span>
              </h3>
              <p className="text-xs text-neutral-400 mt-0.5">
                Add this single variable in Render (Settings ➔ Environment) to ensure Render never forgets your configuration.
              </p>
            </div>
          </div>

          <div className="space-y-3 mt-3">
            <div>
              <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider block mb-1">
                Variable Name:
              </span>
              <div className="flex items-center gap-2">
                <code className="bg-neutral-950 border border-neutral-800 px-3 py-1.5 rounded-lg text-xs font-mono text-indigo-300 flex-1">
                  DONIFY_CONFIG
                </code>
                <button
                  onClick={() => handleCopy('varName', 'DONIFY_CONFIG')}
                  className="bg-neutral-800 hover:bg-neutral-700 text-neutral-200 px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
                >
                  {copiedKey === 'varName' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedKey === 'varName' ? 'Copied' : 'Copy Name'}</span>
                </button>
              </div>
            </div>

            <div>
              <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider block mb-1">
                Variable Value (Your Current Settings):
              </span>
              <div className="relative">
                <textarea
                  readOnly
                  rows={3}
                  value={stringifiedConfig}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-2.5 text-[11px] font-mono text-neutral-300 resize-none focus:outline-none"
                />
                <button
                  onClick={() => handleCopy('varValue', stringifiedConfig)}
                  className="absolute bottom-2.5 right-2.5 bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors shadow-md"
                >
                  {copiedKey === 'varValue' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedKey === 'varValue' ? 'Copied Value!' : 'Copy Value'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* File Backup (Download / Upload) */}
        <div className="border-t border-neutral-800 pt-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-neutral-400 text-center sm:text-left">
            Export a full JSON backup to your computer or import one anytime.
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={handleDownload}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 px-3 py-2 rounded-xl text-xs font-medium border border-neutral-700 transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-teal-400" />
              <span>Download .json</span>
            </button>
            <label className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 px-3 py-2 rounded-xl text-xs font-medium border border-neutral-700 cursor-pointer transition-colors">
              <Upload className="w-3.5 h-3.5 text-indigo-400" />
              <span>{isImporting ? 'Importing...' : 'Import .json'}</span>
              <input
                type="file"
                accept=".json,application/json"
                onChange={handleFileUpload}
                className="hidden"
                disabled={isImporting}
              />
            </label>
          </div>
        </div>

        {importStatus && (
          <div className="mt-3 text-xs p-2.5 rounded-lg bg-neutral-950 border border-neutral-800 text-center font-medium">
            {importStatus}
          </div>
        )}
      </div>
    </div>
  );
};
