import React, { useState, useEffect, useRef } from 'react';
import { DiscordConfig } from '../types';
import { DiscordMessagePreview } from './DiscordMessagePreview';
import {
  Send,
  Check,
  AlertTriangle,
  ShieldCheck,
  Eye,
  EyeOff,
  Bot,
  Sliders,
  Upload,
  Image as ImageIcon,
  Trash2,
  RefreshCw,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';

interface DiscordConfigCardProps {
  config: DiscordConfig;
  onSave: (updated: Partial<DiscordConfig>) => Promise<void>;
  onTest: () => Promise<{ success: boolean; error?: string }>;
}

const COLOR_PRESETS = [
  { name: 'Tiltify Teal', hex: '#00d1b2' },
  { name: 'Discord Blurple', hex: '#5865f2' },
  { name: 'Gold Sun', hex: '#f59e0b' },
  { name: 'Crimson', hex: '#ef4444' },
  { name: 'Emerald', hex: '#10b981' },
  { name: 'Violet', hex: '#8b5cf6' },
];

export const DiscordConfigCard: React.FC<DiscordConfigCardProps> = ({
  config,
  onSave,
  onTest,
}) => {
  const [localConfig, setLocalConfig] = useState<DiscordConfig>(config);
  const [showSecrets, setShowSecrets] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  // Avatar Management State
  const [avatarMode, setAvatarMode] = useState<'upload' | 'url'>('upload');
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Only update localConfig when config changes externally and user has not typed unsaved edits
    if (!isDirty) {
      setLocalConfig(config);
    }
  }, [config, isDirty]);

  const handleInputChange = (field: keyof DiscordConfig, value: any) => {
    setIsDirty(true);
    setLocalConfig((prev) => ({ ...prev, [field]: value }));
  };

  // Upload Custom PNG / Image File
  const handleFileUpload = async (file: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setStatusMessage({ type: 'error', text: 'Please select a valid image file (PNG, JPG, WebP).' });
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setStatusMessage({ type: 'error', text: 'Image exceeds 8MB limit. Please select a smaller PNG file.' });
      return;
    }

    setIsUploadingAvatar(true);
    setStatusMessage(null);

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const dataUrl = reader.result as string;

        // Optimistically set preview
        setLocalConfig((prev) => ({
          ...prev,
          botAvatarUrl: dataUrl,
          customAvatarName: file.name,
        }));

        // Send to backend endpoint
        const res = await fetch('/api/discord/avatar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image: dataUrl,
            fileName: file.name,
          }),
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Failed to upload avatar image');
        }

        setLocalConfig((prev) => ({
          ...prev,
          botAvatarUrl: data.avatarUrl,
          customAvatarName: data.fileName,
        }));

        await onSave({
          botAvatarUrl: data.avatarUrl,
          customAvatarName: data.fileName,
        });

        setStatusMessage({
          type: 'success',
          text: `Custom bot icon "${data.fileName}" uploaded and active!`,
        });
      };

      reader.onerror = () => {
        setStatusMessage({ type: 'error', text: 'Failed to read the selected image file.' });
      };

      reader.readAsDataURL(file);
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Error uploading image.' });
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  // Reset Avatar to Default Tiltify Favicon
  const handleResetAvatar = async () => {
    setIsUploadingAvatar(true);
    try {
      const res = await fetch('/api/discord/avatar', { method: 'DELETE' });
      const data = await res.json();
      const defaultUrl = data.avatarUrl || 'https://tiltify.com/favicon.ico';
      setLocalConfig((prev) => ({
        ...prev,
        botAvatarUrl: defaultUrl,
        customAvatarName: undefined,
      }));
      await onSave({
        botAvatarUrl: defaultUrl,
        customAvatarName: undefined,
      });
      setStatusMessage({ type: 'success', text: 'Reset bot icon to default Tiltify icon.' });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: 'Failed to reset avatar icon.' });
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setStatusMessage(null);
    try {
      await onSave(localConfig);
      setIsDirty(false);
      setStatusMessage({ type: 'success', text: 'Discord settings saved successfully!' });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to save Discord settings.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTest = async () => {
    setIsTesting(true);
    setStatusMessage(null);
    try {
      // First ensure current values are saved
      await onSave(localConfig);
      const res = await onTest();
      if (res.success) {
        setStatusMessage({ type: 'success', text: 'Success! Test notification delivered to your Discord server.' });
      } else {
        setStatusMessage({ type: 'error', text: res.error || 'Failed to send alert to Discord.' });
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Error executing Discord test.' });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left column: Configuration Form */}
        <div className="lg:col-span-7 bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-white text-base">Discord Destination Settings</h3>
                <p className="text-xs text-neutral-400">Configure where and how donation alerts are posted</p>
              </div>
            </div>

            {/* Mode Toggle */}
            <div className="flex items-center p-1 bg-neutral-950 rounded-xl border border-neutral-800 text-xs">
              <button
                type="button"
                onClick={() => handleInputChange('mode', 'webhook')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                  localConfig.mode === 'webhook'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                Webhook (Recommended)
              </button>
              <button
                type="button"
                onClick={() => handleInputChange('mode', 'bot')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                  localConfig.mode === 'bot'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                Bot Token
              </button>
            </div>
          </div>

          {statusMessage && (
            <div
              className={`mb-5 p-3.5 rounded-xl text-xs flex items-start gap-2.5 ${
                statusMessage.type === 'success'
                  ? 'bg-emerald-950/50 border border-emerald-800/60 text-emerald-300'
                  : 'bg-rose-950/50 border border-rose-800/60 text-rose-300'
              }`}
            >
              {statusMessage.type === 'success' ? (
                <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
              ) : (
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
              )}
              <div className="flex-1 font-medium space-y-1.5">
                <div>{statusMessage.text}</div>
                {localConfig.mode === 'bot' && localConfig.webhookUrl && (statusMessage.text.includes('10003') || statusMessage.text.includes('Unknown Channel')) && (
                  <button
                    type="button"
                    onClick={() => {
                      handleInputChange('mode', 'webhook');
                      setStatusMessage({
                        type: 'success',
                        text: 'Switched to Webhook mode! Click "Save Configuration" or "Send Live Discord Test" to send directly.',
                      });
                    }}
                    className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1 rounded-lg text-xs font-medium transition-colors mt-1"
                  >
                    Switch to Webhook (Recommended)
                  </button>
                )}
              </div>
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-4">
            {localConfig.mode === 'webhook' ? (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-neutral-300 uppercase tracking-wider">
                    Discord Webhook URL <span className="text-rose-400">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowSecrets(!showSecrets)}
                    className="text-xs text-neutral-400 hover:text-neutral-200 flex items-center gap-1"
                  >
                    {showSecrets ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    {showSecrets ? 'Mask' : 'Show'}
                  </button>
                </div>
                <input
                  type={showSecrets ? 'text' : 'password'}
                  value={localConfig.webhookUrl}
                  onChange={(e) => handleInputChange('webhookUrl', e.target.value)}
                  placeholder="https://discord.com/api/webhooks/1234567890/abcdef..."
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-sm text-neutral-200 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                  required
                />
                <p className="text-[11px] text-neutral-400 mt-1">
                  Obtain from Discord Channel Settings &rarr; Integrations &rarr; Webhooks &rarr; Copy Webhook URL.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-neutral-300 uppercase tracking-wider">
                      Discord Bot Token <span className="text-rose-400">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowSecrets(!showSecrets)}
                      className="text-xs text-neutral-400 hover:text-neutral-200 flex items-center gap-1"
                    >
                      {showSecrets ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      {showSecrets ? 'Mask' : 'Show'}
                    </button>
                  </div>
                  <input
                    type={showSecrets ? 'text' : 'password'}
                    value={localConfig.botToken}
                    onChange={(e) => handleInputChange('botToken', e.target.value)}
                    placeholder="MTA5OTg2NzA4... (Bot Token)"
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-sm text-neutral-200 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-neutral-300 uppercase tracking-wider block mb-1">
                    Destination Channel ID <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={localConfig.channelId}
                    onChange={(e) => handleInputChange('channelId', e.target.value)}
                    placeholder="e.g. 102938475612345678"
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-sm text-neutral-200 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                    required
                  />
                </div>
              </div>
            )}

            {/* Customization Details */}
            <div className="pt-3 border-t border-neutral-800/80 space-y-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-neutral-300 uppercase tracking-wider">
                <Sliders className="w-3.5 h-3.5 text-indigo-400" />
                Alert Styling & Customization
              </div>

              <div>
                <label className="text-xs text-neutral-400 block mb-1">Bot Username</label>
                <input
                  type="text"
                  value={localConfig.botUsername}
                  onChange={(e) => handleInputChange('botUsername', e.target.value)}
                  placeholder="Tiltify Donation Bot"
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Bot Avatar Icon Section with PNG Upload */}
              <div className="bg-neutral-950/70 border border-neutral-800/80 rounded-xl p-3.5 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-200">
                      <ImageIcon className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Bot Avatar Icon</span>
                      {localConfig.customAvatarName ? (
                        <span className="bg-emerald-950/80 border border-emerald-800/80 text-emerald-400 text-[10px] px-1.5 py-0.5 rounded font-medium">
                          Custom PNG Active
                        </span>
                      ) : (
                        <span className="bg-neutral-900 border border-neutral-800 text-neutral-400 text-[10px] px-1.5 py-0.5 rounded">
                          Default Favicon
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-neutral-400 mt-0.5">
                      Upload your own PNG logo, avatar, or streamer emote instead of the standard Tiltify favicon.
                    </p>
                  </div>

                  {/* Mode switcher: Upload PNG vs External URL */}
                  <div className="flex items-center bg-neutral-900 border border-neutral-800 rounded-lg p-0.5 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setAvatarMode('upload')}
                      className={`px-2.5 py-1 rounded font-medium transition-all flex items-center gap-1.5 ${
                        avatarMode === 'upload'
                          ? 'bg-neutral-800 text-white shadow-sm'
                          : 'text-neutral-400 hover:text-neutral-200'
                      }`}
                    >
                      <Upload className="w-3 h-3 text-indigo-400" />
                      Upload PNG
                    </button>
                    <button
                      type="button"
                      onClick={() => setAvatarMode('url')}
                      className={`px-2.5 py-1 rounded font-medium transition-all flex items-center gap-1.5 ${
                        avatarMode === 'url'
                          ? 'bg-neutral-800 text-white shadow-sm'
                          : 'text-neutral-400 hover:text-neutral-200'
                      }`}
                    >
                      <Sparkles className="w-3 h-3 text-amber-400" />
                      Image URL
                    </button>
                  </div>
                </div>

                <div className="flex items-start gap-3.5 flex-wrap sm:flex-nowrap pt-1">
                  {/* Avatar Circular Preview */}
                  <div className="flex flex-col items-center gap-1 shrink-0">
                    <div className="relative w-14 h-14 rounded-full overflow-hidden border-2 border-neutral-700 bg-neutral-900 shadow-md flex items-center justify-center">
                      <img
                        src={localConfig.botAvatarUrl || 'https://tiltify.com/favicon.ico'}
                        alt="Bot avatar preview"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'https://tiltify.com/favicon.ico';
                        }}
                      />
                      {isUploadingAvatar && (
                        <div className="absolute inset-0 bg-black/75 flex items-center justify-center">
                          <RefreshCw className="w-4 h-4 text-indigo-400 animate-spin" />
                        </div>
                      )}
                    </div>
                    <span className="text-[10px] text-neutral-400 font-mono">1:1 Icon</span>
                  </div>

                  {/* Avatar Controls: Drag & Drop Upload or URL */}
                  <div className="flex-1 min-w-0">
                    {avatarMode === 'upload' ? (
                      <div className="space-y-2">
                        {/* Drag and Drop Zone + Click to browse */}
                        <div
                          onDragOver={handleDragOver}
                          onDragLeave={handleDragLeave}
                          onDrop={handleDrop}
                          onClick={() => fileInputRef.current?.click()}
                          className={`border-2 border-dashed rounded-xl p-3 text-center cursor-pointer transition-all ${
                            isDragging
                              ? 'border-indigo-500 bg-indigo-950/30 text-indigo-300 scale-[0.99]'
                              : 'border-neutral-800 hover:border-neutral-700 bg-neutral-900/40 hover:bg-neutral-900/80'
                          }`}
                        >
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/png,image/jpeg,image/webp,image/gif"
                            className="hidden"
                            onChange={(e) => {
                              if (e.target.files && e.target.files.length > 0) {
                                handleFileUpload(e.target.files[0]);
                              }
                            }}
                          />
                          <div className="flex items-center justify-center gap-2 mb-1 text-xs text-neutral-200">
                            <Upload className={`w-4 h-4 ${isDragging ? 'text-indigo-400 animate-bounce' : 'text-indigo-400'}`} />
                            <span className="font-medium">
                              {isDragging ? 'Drop PNG file to upload' : 'Click to browse or drag & drop PNG'}
                            </span>
                          </div>
                          <p className="text-[10px] text-neutral-400">
                            PNG recommended (supports transparency). Also supports JPG &amp; WebP up to 8MB.
                          </p>
                        </div>

                        {/* Status & Reset bar */}
                        <div className="flex items-center justify-between flex-wrap gap-2 text-xs pt-0.5">
                          {localConfig.customAvatarName ? (
                            <span className="text-neutral-300 text-[11px] truncate flex items-center gap-1.5">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                              <span>Active PNG: <strong className="text-white font-mono">{localConfig.customAvatarName}</strong></span>
                            </span>
                          ) : (
                            <span className="text-neutral-400 text-[11px]">
                              Using default Tiltify favicon
                            </span>
                          )}

                          {(localConfig.customAvatarName || localConfig.botAvatarUrl !== 'https://tiltify.com/favicon.ico') && (
                            <button
                              type="button"
                              onClick={handleResetAvatar}
                              disabled={isUploadingAvatar}
                              className="text-[11px] text-neutral-400 hover:text-rose-400 flex items-center gap-1 transition-colors ml-auto py-0.5 px-1.5 rounded hover:bg-neutral-900"
                            >
                              <Trash2 className="w-3 h-3" />
                              Reset to Default Favicon
                            </button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div>
                          <label className="text-[11px] text-neutral-400 block mb-1">Direct Image URL</label>
                          <input
                            type="text"
                            value={localConfig.botAvatarUrl}
                            onChange={(e) => {
                              handleInputChange('botAvatarUrl', e.target.value);
                              handleInputChange('customAvatarName', undefined);
                            }}
                            placeholder="https://tiltify.com/favicon.ico"
                            className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                          />
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-neutral-400">
                          <span>Direct link to an image file (.png, .jpg, .webp)</span>
                          {localConfig.botAvatarUrl !== 'https://tiltify.com/favicon.ico' && (
                            <button
                              type="button"
                              onClick={() => {
                                handleInputChange('botAvatarUrl', 'https://tiltify.com/favicon.ico');
                                handleInputChange('customAvatarName', undefined);
                              }}
                              className="text-neutral-400 hover:text-rose-400 transition-colors"
                            >
                              Reset to Favicon
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Embed Accent Color */}
              <div>
                <label className="text-xs text-neutral-400 block mb-1.5">Embed Accent Color</label>
                <div className="flex flex-wrap items-center gap-2">
                  {COLOR_PRESETS.map((p) => (
                    <button
                      key={p.hex}
                      type="button"
                      onClick={() => handleInputChange('embedColor', p.hex)}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs border transition-all ${
                        localConfig.embedColor.toLowerCase() === p.hex.toLowerCase()
                          ? 'border-white text-white font-semibold bg-neutral-800'
                          : 'border-neutral-800 text-neutral-400 hover:border-neutral-700'
                      }`}
                    >
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: p.hex }} />
                      <span>{p.name}</span>
                    </button>
                  ))}
                  <input
                    type="color"
                    value={localConfig.embedColor}
                    onChange={(e) => handleInputChange('embedColor', e.target.value)}
                    className="w-8 h-7 rounded bg-neutral-950 border border-neutral-800 cursor-pointer p-0.5"
                    title="Custom color"
                  />
                </div>
              </div>

              {/* Notification Mention */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-neutral-400 block mb-1">Mention Ping</label>
                  <select
                    value={localConfig.mentionType}
                    onChange={(e) => handleInputChange('mentionType', e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="none">None (Silent / No Ping)</option>
                    <option value="here">@here (Online Members)</option>
                    <option value="everyone">@everyone (All Members)</option>
                    <option value="role">Specific Role (Role ID)</option>
                    <option value="user">Specific User (User ID)</option>
                  </select>
                </div>
                {localConfig.mentionType === 'role' && (
                  <div>
                    <label className="text-xs text-neutral-400 block mb-1">Discord Role ID</label>
                    <input
                      type="text"
                      value={localConfig.mentionRoleId}
                      onChange={(e) => handleInputChange('mentionRoleId', e.target.value)}
                      placeholder="e.g. 987654321012345678"
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                    />
                    <p className="text-[10px] text-neutral-400 mt-1">
                      Pings <code className="text-neutral-300 bg-neutral-900 px-1 rounded">&lt;@&amp;role_id&gt;</code>. Copy from Server Settings &gt; Roles.
                    </p>
                  </div>
                )}
                {localConfig.mentionType === 'user' && (
                  <div>
                    <label className="text-xs text-neutral-400 block mb-1">Discord User ID</label>
                    <input
                      type="text"
                      value={localConfig.mentionUserId || ''}
                      onChange={(e) => handleInputChange('mentionUserId', e.target.value)}
                      placeholder="e.g. 123456789012345678"
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                    />
                    <p className="text-[10px] text-neutral-400 mt-1">
                      Pings <code className="text-neutral-300 bg-neutral-900 px-1 rounded">&lt;@user_id&gt;</code> directly. Right-click any user in Discord and click &apos;Copy User ID&apos; (requires Developer Mode).
                    </p>
                  </div>
                )}
              </div>

              {/* Toggles */}
              <div className="space-y-3 pt-2 text-xs border-t border-neutral-800/80">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">Alert Content & Rewards Options</div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="flex items-center gap-2 cursor-pointer text-neutral-300">
                    <input
                      type="checkbox"
                      checked={localConfig.includeComment}
                      onChange={(e) => handleInputChange('includeComment', e.target.checked)}
                      className="rounded bg-neutral-950 border-neutral-800 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                    />
                    <span>Show donor message / comment</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer text-neutral-300">
                    <input
                      type="checkbox"
                      checked={localConfig.includeCampaignDetails}
                      onChange={(e) => handleInputChange('includeCampaignDetails', e.target.checked)}
                      className="rounded bg-neutral-950 border-neutral-800 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                    />
                    <span>Show campaign progress</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer text-neutral-300">
                    <input
                      type="checkbox"
                      checked={localConfig.includeRewardDetails !== false}
                      onChange={(e) => handleInputChange('includeRewardDetails', e.target.checked)}
                      className="rounded bg-neutral-950 border-neutral-800 text-teal-500 focus:ring-teal-500 w-4 h-4"
                    />
                    <span className="flex items-center gap-1.5">
                      <span>Include selected reward details</span>
                      <span className="text-[10px] bg-teal-950/80 text-teal-300 px-1.5 py-0.5 rounded border border-teal-800/50">🎁 Rewards</span>
                    </span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer text-neutral-300">
                    <input
                      type="checkbox"
                      checked={localConfig.includeDeliveryAddress !== false}
                      onChange={(e) => handleInputChange('includeDeliveryAddress', e.target.checked)}
                      className="rounded bg-neutral-950 border-neutral-800 text-teal-500 focus:ring-teal-500 w-4 h-4"
                    />
                    <span className="flex items-center gap-1.5">
                      <span>Include delivery & shipping info</span>
                      <span className="text-[10px] bg-indigo-950/80 text-indigo-300 px-1.5 py-0.5 rounded border border-indigo-800/50">📦 Shipping</span>
                    </span>
                  </label>
                </div>

                {localConfig.includeDeliveryAddress !== false && (
                  <div className="pl-6 pt-1">
                    <label className="flex items-center gap-2 cursor-pointer text-neutral-400 text-xs">
                      <input
                        type="checkbox"
                        checked={localConfig.spoilerDeliveryInfo !== false}
                        onChange={(e) => handleInputChange('spoilerDeliveryInfo', e.target.checked)}
                        className="rounded bg-neutral-950 border-neutral-800 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                      />
                      <span>Mask shipping address with spoiler tags <code className="text-neutral-300 bg-neutral-900 px-1 rounded">||address||</code> (protects donor privacy in Discord)</span>
                    </label>
                  </div>
                )}
              </div>

              {/* 🔨 Tiltify Auction House End Notifications & Fulfillment */}
              <div className="space-y-3 pt-3 border-t border-neutral-800/80">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-400 uppercase tracking-wider">
                    <span>🔨 Auction House End Notifications & Prize Fulfillment</span>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-neutral-200">
                    <input
                      type="checkbox"
                      checked={localConfig.enableAuctionAlerts !== false}
                      onChange={(e) => handleInputChange('enableAuctionAlerts', e.target.checked)}
                      className="rounded bg-neutral-950 border-neutral-800 text-amber-500 focus:ring-amber-500 w-4 h-4"
                    />
                    <span>Enable Auction Alerts</span>
                  </label>
                </div>

                <p className="text-[11px] text-neutral-400">
                  When an auction ends, the bot sends an alert with winning bid, item title, and winner fulfillment information (email address for digital prizes or physical shipping address).
                </p>

                {localConfig.enableAuctionAlerts !== false && (
                  <div className="space-y-3 bg-neutral-950/60 border border-amber-500/20 rounded-xl p-3.5 text-xs">
                    <div>
                      <label className="flex items-center gap-2 cursor-pointer text-neutral-200 font-medium">
                        <input
                          type="checkbox"
                          checked={localConfig.onlyNotifyPrizeAuctions === true}
                          onChange={(e) => handleInputChange('onlyNotifyPrizeAuctions', e.target.checked)}
                          className="rounded bg-neutral-950 border-neutral-800 text-amber-500 focus:ring-amber-500 w-4 h-4"
                        />
                        <span>Only alert if winner requires physical prize shipping or email delivery</span>
                      </label>
                      <p className="text-[11px] text-neutral-400 pl-6 mt-0.5">
                        Filters out auctions that do not have physical prizes to ship or digital codes to email.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      <div>
                        <label className="text-neutral-400 block mb-1">Auction Message Text / Prefix</label>
                        <input
                          type="text"
                          value={localConfig.auctionMessagePrefix || ''}
                          onChange={(e) => handleInputChange('auctionMessagePrefix', e.target.value)}
                          placeholder="🔨 AUCTION ENDED! Winning bid and prize fulfillment details:"
                          className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                        />
                      </div>

                      <div>
                        <label className="text-neutral-400 block mb-1">Auction Embed Accent Color</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={localConfig.auctionEmbedColor || '#F59E0B'}
                            onChange={(e) => handleInputChange('auctionEmbedColor', e.target.value)}
                            className="w-8 h-8 rounded bg-neutral-950 border border-neutral-800 cursor-pointer p-0.5"
                          />
                          <input
                            type="text"
                            value={localConfig.auctionEmbedColor || '#F59E0B'}
                            onChange={(e) => handleInputChange('auctionEmbedColor', e.target.value)}
                            placeholder="#F59E0B"
                            className="flex-1 bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-200 font-mono"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Buttons */}
            <div className="flex items-center gap-3 pt-4 border-t border-neutral-800">
              <button
                type="submit"
                disabled={isSaving}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-colors shadow-sm"
              >
                {isSaving ? 'Saving...' : 'Save Configuration'}
              </button>

              <button
                type="button"
                onClick={handleTest}
                disabled={isTesting || (!localConfig.webhookUrl && !localConfig.botToken)}
                className="flex items-center gap-2 bg-neutral-800 hover:bg-neutral-700 disabled:opacity-40 text-neutral-200 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors border border-neutral-700"
              >
                <Send className="w-4 h-4 text-indigo-400" />
                {isTesting ? 'Sending Test...' : 'Send Live Discord Test'}
              </button>
            </div>
          </form>
        </div>

        {/* Right column: Real-Time Preview */}
        <div className="lg:col-span-5 flex flex-col justify-between space-y-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-2 flex items-center justify-between">
              <span>Live Visual Embed Preview</span>
              <span className="text-[11px] text-neutral-500">Updates as you edit</span>
            </div>
            <DiscordMessagePreview config={localConfig} />
          </div>

          <div className="bg-neutral-950 border border-neutral-800/80 rounded-xl p-4 text-xs text-neutral-400 space-y-2">
            <div className="font-semibold text-neutral-200 flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-teal-400" />
              Embed Highlights
            </div>
            <p>
              When a supporter donates on Tiltify, this custom card is instantly posted into your server text channel.
            </p>
            <p>
              Colors, donor tags, currencies, and custom messages are automatically formatted cleanly for desktop & mobile Discord apps.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
