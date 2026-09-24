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
  Palette,
  Layout,
  Type,
  ImagePlus,
  BarChart3,
  Info,
  Link2,
} from 'lucide-react';

interface DiscordConfigCardProps {
  config: DiscordConfig;
  campaignName?: string;
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

interface ThemePreset {
  id: string;
  name: string;
  accent: string;
  secondary: string;
  tagline: string;
  titleTemplate: string;
  descTemplate: string;
  layout: 'modern' | 'compact' | 'minimal';
  progressStyle: 'blocks' | 'line' | 'stars' | 'percentage';
}

const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'tiltify-cyan',
    name: 'Tiltify Teal',
    accent: '#00d1b2',
    secondary: '#0f766e',
    tagline: 'Signature Tiltify cyan with full goal tracker',
    titleTemplate: '🎉 New Donation: {amount}!',
    descTemplate: '**{donor}** contributed to the campaign!',
    layout: 'modern',
    progressStyle: 'blocks',
  },
  {
    id: 'discord-blurple',
    name: 'Discord Blurple',
    accent: '#5865f2',
    secondary: '#4338ca',
    tagline: 'Official Discord gaming palette with sleek line bar',
    titleTemplate: '💖 {donor} supported the stream with {amount}!',
    descTemplate: 'Thank you for supporting **{campaign}**!',
    layout: 'modern',
    progressStyle: 'line',
  },
  {
    id: 'cyber-violet',
    name: 'Hype Violet',
    accent: '#8b5cf6',
    secondary: '#7c3aed',
    tagline: 'High-energy esports / Twitch hype with stars',
    titleTemplate: '✨ HYPE ALERT! {donor} dropped {amount}!',
    descTemplate: 'Huge shoutout to **{donor}** for the incredible support! 🔥',
    layout: 'modern',
    progressStyle: 'stars',
  },
  {
    id: 'emerald-pride',
    name: 'Emerald Charity',
    accent: '#10b981',
    secondary: '#047857',
    tagline: 'Fresh philanthropy green with milestone celebration',
    titleTemplate: '🌱 Charity Gift: {amount} from {donor}',
    descTemplate: '**{donor}** contributed towards our cause goal!',
    layout: 'modern',
    progressStyle: 'blocks',
  },
  {
    id: 'gold-crown',
    name: 'Gold VIP',
    accent: '#f59e0b',
    secondary: '#b45309',
    tagline: 'Golden champion donor celebration style',
    titleTemplate: '👑 VIP DONATION: {amount}!',
    descTemplate: '**{donor}** just made a major milestone gift!',
    layout: 'modern',
    progressStyle: 'stars',
  },
  {
    id: 'clean-minimal',
    name: 'Minimal Clean',
    accent: '#64748b',
    secondary: '#334155',
    tagline: 'Clean essential donor & amount, no clutter',
    titleTemplate: '{donor} • {amount}',
    descTemplate: 'Donated to {campaign}',
    layout: 'minimal',
    progressStyle: 'percentage',
  },
];

export const DiscordConfigCard: React.FC<DiscordConfigCardProps> = ({
  config,
  campaignName,
  onSave,
  onTest,
}) => {
  const [localConfig, setLocalConfig] = useState<DiscordConfig>(config);
  const [showSecrets, setShowSecrets] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [formTab, setFormTab] = useState<'appearance' | 'connection' | 'auctions'>('appearance');

  // Avatar Management State
  const [avatarMode, setAvatarMode] = useState<'upload' | 'url'>('upload');
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Thumbnail Media Management State
  const [thumbnailMode, setThumbnailMode] = useState<'upload' | 'url'>(() => {
    return (config.customThumbnailName || (config.embedThumbnailUrl && config.embedThumbnailUrl.includes('/api/discord/thumbnail')))
      ? 'upload'
      : (config.embedThumbnailUrl ? 'url' : 'upload');
  });
  const [isUploadingThumbnail, setIsUploadingThumbnail] = useState(false);
  const [isDraggingThumbnail, setIsDraggingThumbnail] = useState(false);
  const thumbnailInputRef = useRef<HTMLInputElement>(null);

  // Banner Media Management State
  const [bannerMode, setBannerMode] = useState<'upload' | 'url'>(() => {
    return (config.customBannerName || (config.embedBannerUrl && config.embedBannerUrl.includes('/api/discord/banner')))
      ? 'upload'
      : (config.embedBannerUrl ? 'url' : 'upload');
  });
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);
  const [isDraggingBanner, setIsDraggingBanner] = useState(false);
  const bannerInputRef = useRef<HTMLInputElement>(null);

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

  const applyThemePreset = (preset: ThemePreset) => {
    setIsDirty(true);
    setLocalConfig((prev) => ({
      ...prev,
      embedColor: preset.accent,
      embedLayout: preset.layout,
      embedTitleTemplate: preset.titleTemplate,
      embedDescriptionTemplate: preset.descTemplate,
      progressBarCharStyle: preset.progressStyle,
    }));
  };

  const insertTag = (field: 'embedTitleTemplate' | 'embedDescriptionTemplate' | 'auctionTitleTemplate', tag: string) => {
    setIsDirty(true);
    setLocalConfig((prev) => {
      const cur = (prev[field] as string) || '';
      return {
        ...prev,
        [field]: cur ? `${cur} {${tag}}` : `{${tag}}`,
      };
    });
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
        const token = localStorage.getItem('tiltify_admin_token');
        const res = await fetch('/api/discord/avatar', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
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
      const token = localStorage.getItem('tiltify_admin_token');
      const res = await fetch('/api/discord/avatar', {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
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

  // --- Embed Thumbnail Upload & Handlers ---
  const handleUploadThumbnail = async (file: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setStatusMessage({ type: 'error', text: 'Please select a valid image file (PNG, JPG, WebP, GIF).' });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setStatusMessage({ type: 'error', text: 'Image exceeds 10MB limit. Please select a smaller file.' });
      return;
    }

    setIsUploadingThumbnail(true);
    setStatusMessage(null);

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const dataUrl = reader.result as string;

        setLocalConfig((prev) => ({
          ...prev,
          embedThumbnailUrl: dataUrl,
          customThumbnailName: file.name,
        }));

        const token = localStorage.getItem('tiltify_admin_token');
        const res = await fetch('/api/discord/thumbnail', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            image: dataUrl,
            fileName: file.name,
          }),
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Failed to upload thumbnail image');
        }

        setLocalConfig((prev) => ({
          ...prev,
          embedThumbnailUrl: data.thumbnailUrl,
          customThumbnailName: data.fileName,
        }));

        await onSave({
          embedThumbnailUrl: data.thumbnailUrl,
          customThumbnailName: data.fileName,
        });

        setStatusMessage({
          type: 'success',
          text: `Custom thumbnail "${data.fileName}" uploaded and active!`,
        });
      };

      reader.onerror = () => {
        setStatusMessage({ type: 'error', text: 'Failed to read thumbnail image file.' });
      };

      reader.readAsDataURL(file);
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Error uploading thumbnail.' });
    } finally {
      setIsUploadingThumbnail(false);
    }
  };

  const handleResetThumbnail = async () => {
    setIsUploadingThumbnail(true);
    try {
      const token = localStorage.getItem('tiltify_admin_token');
      await fetch('/api/discord/thumbnail', {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      setLocalConfig((prev) => ({
        ...prev,
        embedThumbnailUrl: '',
        customThumbnailName: undefined,
      }));
      await onSave({
        embedThumbnailUrl: '',
        customThumbnailName: undefined,
      });
      setStatusMessage({ type: 'success', text: 'Embed thumbnail removed.' });
    } catch {
      setStatusMessage({ type: 'error', text: 'Failed to clear thumbnail.' });
    } finally {
      setIsUploadingThumbnail(false);
    }
  };

  const handleThumbnailDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingThumbnail(true);
  };

  const handleThumbnailDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingThumbnail(false);
  };

  const handleThumbnailDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingThumbnail(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleUploadThumbnail(e.dataTransfer.files[0]);
    }
  };

  // --- Embed Banner Upload & Handlers ---
  const handleUploadBanner = async (file: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setStatusMessage({ type: 'error', text: 'Please select a valid image file (PNG, JPG, WebP, GIF).' });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setStatusMessage({ type: 'error', text: 'Banner image exceeds 10MB limit. Please select a smaller file.' });
      return;
    }

    setIsUploadingBanner(true);
    setStatusMessage(null);

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const dataUrl = reader.result as string;

        setLocalConfig((prev) => ({
          ...prev,
          embedBannerUrl: dataUrl,
          customBannerName: file.name,
        }));

        const token = localStorage.getItem('tiltify_admin_token');
        const res = await fetch('/api/discord/banner', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            image: dataUrl,
            fileName: file.name,
          }),
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Failed to upload banner image');
        }

        setLocalConfig((prev) => ({
          ...prev,
          embedBannerUrl: data.bannerUrl,
          customBannerName: data.fileName,
        }));

        await onSave({
          embedBannerUrl: data.bannerUrl,
          customBannerName: data.fileName,
        });

        setStatusMessage({
          type: 'success',
          text: `Custom banner "${data.fileName}" uploaded and active!`,
        });
      };

      reader.onerror = () => {
        setStatusMessage({ type: 'error', text: 'Failed to read banner image file.' });
      };

      reader.readAsDataURL(file);
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Error uploading banner.' });
    } finally {
      setIsUploadingBanner(false);
    }
  };

  const handleResetBanner = async () => {
    setIsUploadingBanner(true);
    try {
      const token = localStorage.getItem('tiltify_admin_token');
      await fetch('/api/discord/banner', {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      setLocalConfig((prev) => ({
        ...prev,
        embedBannerUrl: '',
        customBannerName: undefined,
      }));
      await onSave({
        embedBannerUrl: '',
        customBannerName: undefined,
      });
      setStatusMessage({ type: 'success', text: 'Embed banner removed.' });
    } catch {
      setStatusMessage({ type: 'error', text: 'Failed to clear banner.' });
    } finally {
      setIsUploadingBanner(false);
    }
  };

  const handleBannerDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingBanner(true);
  };

  const handleBannerDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingBanner(false);
  };

  const handleBannerDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingBanner(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleUploadBanner(e.dataTransfer.files[0]);
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
                {localConfig.mode === 'webhook' && localConfig.webhookUrl?.includes('discord.com') && (statusMessage.text.includes('1015') || statusMessage.text.includes('discordapp.com') || statusMessage.text.includes('429')) && (
                  <button
                    type="button"
                    onClick={() => {
                      const updated = localConfig.webhookUrl.replace('discord.com', 'discordapp.com');
                      handleInputChange('webhookUrl', updated);
                      setStatusMessage({
                        type: 'success',
                        text: 'Changed domain to discordapp.com! Click "Save Configuration" to apply.',
                      });
                    }}
                    className="inline-flex items-center gap-1.5 bg-amber-600 hover:bg-amber-500 text-white px-3 py-1 rounded-lg text-xs font-medium transition-colors mt-1"
                  >
                    Bypass Cloudflare Block (Switch to discordapp.com)
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Section Navigation Subtabs */}
          <div className="grid grid-cols-3 gap-1.5 p-1 bg-neutral-950 rounded-xl border border-neutral-800 text-xs mb-5">
            <button
              type="button"
              onClick={() => setFormTab('appearance')}
              className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg font-medium transition-all ${
                formTab === 'appearance'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Palette className="w-3.5 h-3.5" />
              <span className="truncate">Visual Customizer</span>
            </button>
            <button
              type="button"
              onClick={() => setFormTab('connection')}
              className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg font-medium transition-all ${
                formTab === 'connection'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Bot className="w-3.5 h-3.5" />
              <span className="truncate">Bot &amp; Webhook</span>
            </button>
            <button
              type="button"
              onClick={() => setFormTab('auctions')}
              className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg font-medium transition-all ${
                formTab === 'auctions'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <span>🔨</span>
              <span className="truncate">Auctions &amp; Prizes</span>
            </button>
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            {/* 🎨 VISUAL CUSTOMIZER TAB */}
            {formTab === 'appearance' && (
              <div className="space-y-5">
                {/* 1. Quick Theme Presets */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-semibold text-neutral-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Theme &amp; Style Presets</span>
                    </label>
                    <span className="text-[10px] text-neutral-400">1-Click Themes</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {THEME_PRESETS.map((preset) => {
                      const isSelected =
                        localConfig.embedColor.toLowerCase() === preset.accent.toLowerCase() &&
                        (localConfig.embedLayout || 'modern') === preset.layout;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => applyThemePreset(preset)}
                          className={`text-left p-2.5 rounded-xl border transition-all relative overflow-hidden group ${
                            isSelected
                              ? 'border-indigo-500 bg-indigo-950/40 shadow-sm'
                              : 'border-neutral-800 bg-neutral-950/60 hover:border-neutral-700 hover:bg-neutral-950'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span
                              className="w-3 h-3 rounded-full shrink-0 shadow-sm"
                              style={{ backgroundColor: preset.accent }}
                            />
                            <span className="font-semibold text-white text-xs truncate">{preset.name}</span>
                          </div>
                          <p className="text-[10px] text-neutral-400 line-clamp-1">{preset.tagline}</p>
                          {isSelected && (
                            <div className="absolute top-2 right-2 text-indigo-400">
                              <CheckCircle2 className="w-3 h-3" />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Embed Layout Selector */}
                <div className="pt-2 border-t border-neutral-800/80">
                  <label className="text-xs font-semibold text-neutral-300 uppercase tracking-wider block mb-2 flex items-center gap-1.5">
                    <Layout className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Notification Layout Mode</span>
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => handleInputChange('embedLayout', 'modern')}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        localConfig.embedLayout === 'modern' || !localConfig.embedLayout
                          ? 'border-indigo-500 bg-indigo-950/30 text-white'
                          : 'border-neutral-800 bg-neutral-950/60 text-neutral-400 hover:border-neutral-700 hover:text-neutral-200'
                      }`}
                    >
                      <div className="font-semibold mb-0.5 text-xs text-white">🎴 Modern Card</div>
                      <div className="text-[10px] text-neutral-400">Full rich visual cards with goal tracker and all details</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleInputChange('embedLayout', 'compact')}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        localConfig.embedLayout === 'compact'
                          ? 'border-indigo-500 bg-indigo-950/30 text-white'
                          : 'border-neutral-800 bg-neutral-950/60 text-neutral-400 hover:border-neutral-700 hover:text-neutral-200'
                      }`}
                    >
                      <div className="font-semibold mb-0.5 text-xs text-white">⚡ Compact</div>
                      <div className="text-[10px] text-neutral-400">Streamlined vertical spacing for high-volume streams</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleInputChange('embedLayout', 'minimal')}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        localConfig.embedLayout === 'minimal'
                          ? 'border-indigo-500 bg-indigo-950/30 text-white'
                          : 'border-neutral-800 bg-neutral-950/60 text-neutral-400 hover:border-neutral-700 hover:text-neutral-200'
                      }`}
                    >
                      <div className="font-semibold mb-0.5 text-xs text-white">📄 Minimalist</div>
                      <div className="text-[10px] text-neutral-400">Uncluttered: only donor, amount, and message</div>
                    </button>
                  </div>
                </div>

                {/* 3. Embed Accent Color */}
                <div className="pt-2 border-t border-neutral-800/80">
                  <label className="text-xs font-semibold text-neutral-300 uppercase tracking-wider block mb-2 flex items-center gap-1.5">
                    <Palette className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Embed Accent Color (Left Border)</span>
                  </label>
                  <div className="flex flex-wrap items-center gap-2">
                    {COLOR_PRESETS.map((p) => (
                      <button
                        key={p.hex}
                        type="button"
                        onClick={() => handleInputChange('embedColor', p.hex)}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs border transition-all ${
                          localConfig.embedColor.toLowerCase() === p.hex.toLowerCase()
                            ? 'border-white text-white font-semibold bg-neutral-800'
                            : 'border-neutral-800 text-neutral-400 hover:border-neutral-700'
                        }`}
                      >
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: p.hex }} />
                        <span>{p.name}</span>
                      </button>
                    ))}
                    <div className="flex items-center gap-1.5 bg-neutral-950 border border-neutral-800 rounded-lg p-1">
                      <input
                        type="color"
                        value={localConfig.embedColor}
                        onChange={(e) => handleInputChange('embedColor', e.target.value)}
                        className="w-7 h-6 rounded bg-neutral-950 border-0 cursor-pointer"
                        title="Custom color"
                      />
                      <input
                        type="text"
                        value={localConfig.embedColor}
                        onChange={(e) => handleInputChange('embedColor', e.target.value)}
                        className="w-20 bg-transparent text-xs text-neutral-200 font-mono focus:outline-none px-1"
                      />
                    </div>
                  </div>
                </div>

                {/* 4. Custom Templates: Title & Description */}
                <div className="pt-2 border-t border-neutral-800/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-neutral-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Type className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Card Title &amp; Description Templates</span>
                    </label>
                    <span className="text-[10px] text-neutral-400">Dynamic variables supported</span>
                  </div>

                  {/* Title Template */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs text-neutral-400">Embed Title Template</label>
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-neutral-500">Insert:</span>
                        <button
                          type="button"
                          onClick={() => insertTag('embedTitleTemplate', 'amount')}
                          className="text-[10px] bg-neutral-800 hover:bg-neutral-700 text-teal-300 px-1.5 py-0.5 rounded font-mono"
                        >
                          +{'{amount}'}
                        </button>
                        <button
                          type="button"
                          onClick={() => insertTag('embedTitleTemplate', 'donor')}
                          className="text-[10px] bg-neutral-800 hover:bg-neutral-700 text-indigo-300 px-1.5 py-0.5 rounded font-mono"
                        >
                          +{'{donor}'}
                        </button>
                        <button
                          type="button"
                          onClick={() => insertTag('embedTitleTemplate', 'campaign')}
                          className="text-[10px] bg-neutral-800 hover:bg-neutral-700 text-amber-300 px-1.5 py-0.5 rounded font-mono"
                        >
                          +{'{campaign}'}
                        </button>
                      </div>
                    </div>
                    <input
                      type="text"
                      value={localConfig.embedTitleTemplate ?? '🎉 New Donation: {amount}!'}
                      onChange={(e) => handleInputChange('embedTitleTemplate', e.target.value)}
                      placeholder="🎉 New Donation: {amount}!"
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  {/* Description Template */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs text-neutral-400">Embed Subtitle / Description Template</label>
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-neutral-500">Insert:</span>
                        <button
                          type="button"
                          onClick={() => insertTag('embedDescriptionTemplate', 'donor')}
                          className="text-[10px] bg-neutral-800 hover:bg-neutral-700 text-indigo-300 px-1.5 py-0.5 rounded font-mono"
                        >
                          +{'{donor}'}
                        </button>
                        <button
                          type="button"
                          onClick={() => insertTag('embedDescriptionTemplate', 'amount')}
                          className="text-[10px] bg-neutral-800 hover:bg-neutral-700 text-teal-300 px-1.5 py-0.5 rounded font-mono"
                        >
                          +{'{amount}'}
                        </button>
                        <button
                          type="button"
                          onClick={() => insertTag('embedDescriptionTemplate', 'campaign')}
                          className="text-[10px] bg-neutral-800 hover:bg-neutral-700 text-amber-300 px-1.5 py-0.5 rounded font-mono"
                        >
                          +{'{campaign}'}
                        </button>
                      </div>
                    </div>
                    <input
                      type="text"
                      value={localConfig.embedDescriptionTemplate ?? '**{donor}** contributed to the campaign!'}
                      onChange={(e) => handleInputChange('embedDescriptionTemplate', e.target.value)}
                      placeholder="**{donor}** contributed to the campaign!"
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                {/* 5. Campaign Goal Progress Bar Character Style */}
                <div className="pt-2 border-t border-neutral-800/80">
                  <label className="text-xs font-semibold text-neutral-300 uppercase tracking-wider block mb-2 flex items-center gap-1.5">
                    <BarChart3 className="w-3.5 h-3.5 text-amber-400" />
                    <span>Goal Progress Bar Character Style</span>
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    {[
                      { id: 'blocks', label: 'Blocks', preview: '[▓▓▓░░░]' },
                      { id: 'line', label: 'Solid Line', preview: '[━━━━───]' },
                      { id: 'stars', label: 'Stars', preview: '[★★★☆☆☆]' },
                      { id: 'percentage', label: 'Percent Only', preview: '72.5% reached' },
                    ].map((style) => (
                      <button
                        key={style.id}
                        type="button"
                        onClick={() => handleInputChange('progressBarCharStyle', style.id)}
                        className={`p-2.5 rounded-xl border text-center transition-all ${
                          (localConfig.progressBarCharStyle || 'blocks') === style.id
                            ? 'border-amber-500 bg-amber-950/30 text-amber-300 font-semibold'
                            : 'border-neutral-800 bg-neutral-950/60 text-neutral-400 hover:border-neutral-700'
                        }`}
                      >
                        <div className="text-xs text-white mb-0.5">{style.label}</div>
                        <div className="text-[10px] font-mono text-neutral-400">{style.preview}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 6. Rich Media: Thumbnail & Banner Image */}
                <div className="pt-2 border-t border-neutral-800/80 space-y-4">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <label className="text-xs font-semibold text-neutral-200 uppercase tracking-wider flex items-center gap-1.5">
                        <ImagePlus className="w-4 h-4 text-teal-400" />
                        <span>Embed Media &amp; Artwork (Custom Upload or URL)</span>
                      </label>
                      <p className="text-[11px] text-neutral-400 mt-0.5">
                        Upload your own custom images directly from your computer or provide web URLs. Review the recommended dimensions below for optimal Discord display.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* CARD 1: Embed Thumbnail (Top-Right) */}
                    <div className="bg-neutral-950/80 border border-neutral-800/90 rounded-2xl p-4 space-y-3.5 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-2.5">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-lg bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400 font-bold text-xs">
                              1
                            </div>
                            <div>
                              <span className="font-semibold text-xs text-white block">Embed Thumbnail (Top Right)</span>
                              <span className="text-[10px] text-neutral-400 block">Upper-right corner badge</span>
                            </div>
                          </div>

                          {/* Mode Switcher */}
                          <div className="flex items-center bg-neutral-900 border border-neutral-800 rounded-lg p-0.5 text-[11px]">
                            <button
                              type="button"
                              onClick={() => setThumbnailMode('upload')}
                              className={`px-2.5 py-1 rounded font-medium transition-all flex items-center gap-1.5 ${
                                thumbnailMode === 'upload'
                                  ? 'bg-neutral-800 text-white shadow-sm'
                                  : 'text-neutral-400 hover:text-neutral-200'
                              }`}
                            >
                              <Upload className="w-3 h-3 text-teal-400" />
                              Upload PC
                            </button>
                            <button
                              type="button"
                              onClick={() => setThumbnailMode('url')}
                              className={`px-2.5 py-1 rounded font-medium transition-all flex items-center gap-1.5 ${
                                thumbnailMode === 'url'
                                  ? 'bg-neutral-800 text-white shadow-sm'
                                  : 'text-neutral-400 hover:text-neutral-200'
                              }`}
                            >
                              <Link2 className="w-3 h-3 text-indigo-400" />
                              Web URL
                            </button>
                          </div>
                        </div>

                        {/* Recommended Size & Dimension Specifications Badge */}
                        <div className="bg-teal-950/20 border border-teal-800/40 rounded-xl p-2.5 text-[11px] text-teal-200/90 space-y-1.5 mb-3">
                          <div className="flex items-center gap-1.5 font-semibold text-teal-300">
                            <Info className="w-3.5 h-3.5 shrink-0" />
                            <span>Recommended Size &amp; Specifications:</span>
                          </div>
                          <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10px] text-neutral-300 pl-5">
                            <div>• <strong>Aspect Ratio:</strong> 1:1 (Square)</div>
                            <div>• <strong>Render Size:</strong> 80×80 px</div>
                            <div>• <strong>Max Upload:</strong> 256×256 px</div>
                            <div>• <strong>Formats:</strong> PNG, JPG, WebP, GIF (&le;10MB)</div>
                          </div>
                          <p className="text-[10px] text-neutral-400 pl-5">
                            Discord displays this as a square badge in the upper right. Best for streamer logos, charity badges, or campaign emotes.
                          </p>
                        </div>

                        {thumbnailMode === 'upload' ? (
                          <div className="space-y-2.5">
                            <div
                              onDragOver={handleThumbnailDragOver}
                              onDragLeave={handleThumbnailDragLeave}
                              onDrop={handleThumbnailDrop}
                              onClick={() => thumbnailInputRef.current?.click()}
                              className={`border-2 border-dashed rounded-xl p-3 text-center cursor-pointer transition-all ${
                                isDraggingThumbnail
                                  ? 'border-teal-500 bg-teal-950/30 text-teal-300 scale-[0.99]'
                                  : 'border-neutral-800 hover:border-neutral-700 bg-neutral-900/40 hover:bg-neutral-900/70'
                              }`}
                            >
                              <input
                                ref={thumbnailInputRef}
                                type="file"
                                accept="image/png,image/jpeg,image/webp,image/gif"
                                className="hidden"
                                onChange={(e) => {
                                  if (e.target.files && e.target.files.length > 0) {
                                    handleUploadThumbnail(e.target.files[0]);
                                  }
                                }}
                              />
                              <div className="flex items-center justify-center gap-2 mb-1 text-xs text-neutral-200">
                                <Upload className={`w-4 h-4 ${isDraggingThumbnail ? 'text-teal-400 animate-bounce' : 'text-teal-400'}`} />
                                <span className="font-medium">
                                  {isDraggingThumbnail ? 'Drop image file here' : 'Click to browse or drag & drop image'}
                                </span>
                              </div>
                              <p className="text-[10px] text-neutral-400">
                                PNG (supports transparency), JPG, WebP, or GIF up to 10MB.
                              </p>
                            </div>

                            {/* Thumbnail Preview & Status */}
                            {localConfig.embedThumbnailUrl ? (
                              <div className="flex items-center gap-3 p-2 bg-neutral-900/70 border border-neutral-800 rounded-xl">
                                <div className="relative w-14 h-14 rounded-lg overflow-hidden bg-neutral-950 border border-neutral-700 shrink-0">
                                  <img
                                    src={localConfig.embedThumbnailUrl}
                                    alt="Thumbnail preview"
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                      (e.target as HTMLImageElement).src = 'https://tiltify.com/favicon.ico';
                                    }}
                                  />
                                  {isUploadingThumbnail && (
                                    <div className="absolute inset-0 bg-black/75 flex items-center justify-center">
                                      <RefreshCw className="w-4 h-4 text-teal-400 animate-spin" />
                                    </div>
                                  )}
                                </div>
                                <div className="flex-1 min-w-0 text-xs">
                                  <div className="flex items-center gap-1.5 text-white font-medium truncate">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                                    <span className="truncate">{localConfig.customThumbnailName || 'Custom Thumbnail Active'}</span>
                                  </div>
                                  <span className="text-[10px] text-neutral-400 block font-mono">1:1 Square Thumbnail</span>
                                </div>
                                <button
                                  type="button"
                                  onClick={handleResetThumbnail}
                                  disabled={isUploadingThumbnail}
                                  className="p-1.5 text-neutral-400 hover:text-rose-400 hover:bg-neutral-800 rounded-lg transition-colors shrink-0"
                                  title="Remove custom thumbnail"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <div className="text-[11px] text-neutral-500 italic text-center py-1">
                                No custom thumbnail selected (blank by default).
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <label className="text-[11px] text-neutral-400">Direct Image URL</label>
                                {localConfig.embedThumbnailUrl && (
                                  <button
                                    type="button"
                                    onClick={() => handleInputChange('embedThumbnailUrl', '')}
                                    className="text-[10px] text-neutral-500 hover:text-neutral-300"
                                  >
                                    Clear
                                  </button>
                                )}
                              </div>
                              <input
                                type="url"
                                value={localConfig.embedThumbnailUrl || ''}
                                onChange={(e) => handleInputChange('embedThumbnailUrl', e.target.value)}
                                placeholder="https://example.com/logo.png"
                                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-200 placeholder-neutral-600 focus:outline-none focus:ring-2 focus:ring-teal-500 font-mono"
                              />
                            </div>
                            {localConfig.embedThumbnailUrl && (
                              <div className="flex items-center gap-2.5 p-2 bg-neutral-900/60 border border-neutral-800/80 rounded-xl">
                                <div className="w-10 h-10 rounded-md overflow-hidden bg-neutral-950 border border-neutral-700 shrink-0">
                                  <img
                                    src={localConfig.embedThumbnailUrl}
                                    alt="Thumbnail preview"
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                      (e.target as HTMLImageElement).src = 'https://tiltify.com/favicon.ico';
                                    }}
                                  />
                                </div>
                                <div className="text-[11px] text-neutral-300 truncate font-mono flex-1">
                                  {localConfig.embedThumbnailUrl}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* CARD 2: Embed Banner Artwork (Wide Bottom) */}
                    <div className="bg-neutral-950/80 border border-neutral-800/90 rounded-2xl p-4 space-y-3.5 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-2.5">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold text-xs">
                              2
                            </div>
                            <div>
                              <span className="font-semibold text-xs text-white block">Embed Banner Artwork (Wide Bottom)</span>
                              <span className="text-[10px] text-neutral-400 block">Full-width bottom showcase</span>
                            </div>
                          </div>

                          {/* Mode Switcher */}
                          <div className="flex items-center bg-neutral-900 border border-neutral-800 rounded-lg p-0.5 text-[11px]">
                            <button
                              type="button"
                              onClick={() => setBannerMode('upload')}
                              className={`px-2.5 py-1 rounded font-medium transition-all flex items-center gap-1.5 ${
                                bannerMode === 'upload'
                                  ? 'bg-neutral-800 text-white shadow-sm'
                                  : 'text-neutral-400 hover:text-neutral-200'
                              }`}
                            >
                              <Upload className="w-3 h-3 text-indigo-400" />
                              Upload PC
                            </button>
                            <button
                              type="button"
                              onClick={() => setBannerMode('url')}
                              className={`px-2.5 py-1 rounded font-medium transition-all flex items-center gap-1.5 ${
                                bannerMode === 'url'
                                  ? 'bg-neutral-800 text-white shadow-sm'
                                  : 'text-neutral-400 hover:text-neutral-200'
                              }`}
                            >
                              <Link2 className="w-3 h-3 text-teal-400" />
                              Web URL
                            </button>
                          </div>
                        </div>

                        {/* Recommended Size & Dimension Specifications Badge */}
                        <div className="bg-indigo-950/20 border border-indigo-800/40 rounded-xl p-2.5 text-[11px] text-indigo-200/90 space-y-1.5 mb-3">
                          <div className="flex items-center gap-1.5 font-semibold text-indigo-300">
                            <Info className="w-3.5 h-3.5 shrink-0" />
                            <span>Recommended Size &amp; Specifications:</span>
                          </div>
                          <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10px] text-neutral-300 pl-5">
                            <div>• <strong>Aspect Ratio:</strong> 16:9 Landscape</div>
                            <div>• <strong>Recommended:</strong> 1200×675 px (or 960×540 px)</div>
                            <div>• <strong>Min Dimensions:</strong> 400×225 px</div>
                            <div>• <strong>Formats:</strong> PNG, JPG, WebP, GIF (&le;10MB)</div>
                          </div>
                          <p className="text-[10px] text-neutral-400 pl-5">
                            Discord displays this wide artwork banner across the entire bottom of the embed card. Best for campaign posters, marathon headers, or milestone art.
                          </p>
                        </div>

                        {bannerMode === 'upload' ? (
                          <div className="space-y-2.5">
                            <div
                              onDragOver={handleBannerDragOver}
                              onDragLeave={handleBannerDragLeave}
                              onDrop={handleBannerDrop}
                              onClick={() => bannerInputRef.current?.click()}
                              className={`border-2 border-dashed rounded-xl p-3 text-center cursor-pointer transition-all ${
                                isDraggingBanner
                                  ? 'border-indigo-500 bg-indigo-950/30 text-indigo-300 scale-[0.99]'
                                  : 'border-neutral-800 hover:border-neutral-700 bg-neutral-900/40 hover:bg-neutral-900/70'
                              }`}
                            >
                              <input
                                ref={bannerInputRef}
                                type="file"
                                accept="image/png,image/jpeg,image/webp,image/gif"
                                className="hidden"
                                onChange={(e) => {
                                  if (e.target.files && e.target.files.length > 0) {
                                    handleUploadBanner(e.target.files[0]);
                                  }
                                }}
                              />
                              <div className="flex items-center justify-center gap-2 mb-1 text-xs text-neutral-200">
                                <Upload className={`w-4 h-4 ${isDraggingBanner ? 'text-indigo-400 animate-bounce' : 'text-indigo-400'}`} />
                                <span className="font-medium">
                                  {isDraggingBanner ? 'Drop banner file here' : 'Click to browse or drag & drop banner'}
                                </span>
                              </div>
                              <p className="text-[10px] text-neutral-400">
                                16:9 landscape image recommended (PNG, JPG, WebP, GIF up to 10MB).
                              </p>
                            </div>

                            {/* Banner Preview & Status */}
                            {localConfig.embedBannerUrl ? (
                              <div className="space-y-2 p-2.5 bg-neutral-900/70 border border-neutral-800 rounded-xl">
                                <div className="relative w-full aspect-[16/9] max-h-36 rounded-lg overflow-hidden bg-neutral-950 border border-neutral-700">
                                  <img
                                    src={localConfig.embedBannerUrl}
                                    alt="Banner preview"
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                      (e.target as HTMLElement).style.display = 'none';
                                    }}
                                  />
                                  {isUploadingBanner && (
                                    <div className="absolute inset-0 bg-black/75 flex items-center justify-center">
                                      <RefreshCw className="w-5 h-5 text-indigo-400 animate-spin" />
                                    </div>
                                  )}
                                </div>
                                <div className="flex items-center justify-between gap-2 text-xs pt-0.5">
                                  <div className="flex items-center gap-1.5 text-white font-medium truncate">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                                    <span className="truncate">{localConfig.customBannerName || 'Custom Banner Active'}</span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={handleResetBanner}
                                    disabled={isUploadingBanner}
                                    className="text-[11px] text-neutral-400 hover:text-rose-400 flex items-center gap-1 transition-colors px-2 py-1 rounded hover:bg-neutral-800 shrink-0"
                                    title="Remove custom banner"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                    <span>Remove Banner</span>
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="text-[11px] text-neutral-500 italic text-center py-1">
                                No custom banner selected (blank by default).
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <label className="text-[11px] text-neutral-400">Direct Banner URL</label>
                                {localConfig.embedBannerUrl && (
                                  <button
                                    type="button"
                                    onClick={() => handleInputChange('embedBannerUrl', '')}
                                    className="text-[10px] text-neutral-500 hover:text-neutral-300"
                                  >
                                    Clear
                                  </button>
                                )}
                              </div>
                              <input
                                type="url"
                                value={localConfig.embedBannerUrl || ''}
                                onChange={(e) => handleInputChange('embedBannerUrl', e.target.value)}
                                placeholder="https://example.com/banner.png"
                                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-200 placeholder-neutral-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                              />
                            </div>
                            {localConfig.embedBannerUrl && (
                              <div className="space-y-1.5 p-2 bg-neutral-900/60 border border-neutral-800/80 rounded-xl">
                                <div className="w-full aspect-[16/9] max-h-28 rounded-md overflow-hidden bg-neutral-950 border border-neutral-700">
                                  <img
                                    src={localConfig.embedBannerUrl}
                                    alt="Banner preview"
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                      (e.target as HTMLElement).style.display = 'none';
                                    }}
                                  />
                                </div>
                                <div className="text-[10px] text-neutral-400 truncate font-mono">
                                  {localConfig.embedBannerUrl}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 7. Footer Branding & Timestamp */}
                <div className="pt-2 border-t border-neutral-800/80 space-y-3">
                  <label className="text-xs font-semibold text-neutral-300 uppercase tracking-wider block flex items-center gap-1.5">
                    <ImageIcon className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Footer Branding &amp; Timestamp</span>
                  </label>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="text-neutral-400 block mb-1">Footer Name / Attribution</label>
                      <input
                        type="text"
                        value={localConfig.footerText ?? 'Tiltify Donation Alerts'}
                        onChange={(e) => handleInputChange('footerText', e.target.value)}
                        placeholder="Tiltify Donation Alerts"
                        className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-neutral-400">Footer Icon Image URL</label>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleInputChange('footerIconUrl', '')}
                            className="text-[10px] text-teal-400 hover:text-teal-300 transition-colors"
                          >
                            Reset
                          </button>
                          {localConfig.botAvatarUrl && (
                            <>
                              <span className="text-neutral-600">•</span>
                              <button
                                type="button"
                                onClick={() => handleInputChange('footerIconUrl', localConfig.botAvatarUrl)}
                                className="text-[10px] text-indigo-400 hover:text-indigo-300 transition-colors"
                              >
                                Use Avatar
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                      <input
                        type="text"
                        value={localConfig.footerIconUrl || ''}
                        onChange={(e) => handleInputChange('footerIconUrl', e.target.value)}
                        placeholder="Leave blank for Tiltify icon, or image URL..."
                        className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                      />
                    </div>
                  </div>

                  <div className="pt-1">
                    <label className="flex items-center gap-2 cursor-pointer text-neutral-300 text-xs">
                      <input
                        type="checkbox"
                        checked={localConfig.showEmbedTimestamp !== false}
                        onChange={(e) => handleInputChange('showEmbedTimestamp', e.target.checked)}
                        className="rounded bg-neutral-950 border-neutral-800 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                      />
                      <span>Show donation timestamp in embed footer (e.g. &quot;Today at 12:00 PM&quot;)</span>
                    </label>
                  </div>
                </div>

                {/* 8. Field Toggles */}
                <div className="pt-2 border-t border-neutral-800/80 space-y-3">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                    Displayed Fields &amp; Content Toggles
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
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
                      <span>Show campaign name</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer text-neutral-300">
                      <input
                        type="checkbox"
                        checked={localConfig.includeCampaignProgress !== false}
                        onChange={(e) => handleInputChange('includeCampaignProgress', e.target.checked)}
                        className="rounded bg-neutral-950 border-neutral-800 text-amber-500 focus:ring-amber-500 w-4 h-4"
                      />
                      <span>Show goal progress &amp; total raised</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer text-neutral-300">
                      <input
                        type="checkbox"
                        checked={localConfig.includeRewardDetails !== false}
                        onChange={(e) => handleInputChange('includeRewardDetails', e.target.checked)}
                        className="rounded bg-neutral-950 border-neutral-800 text-teal-500 focus:ring-teal-500 w-4 h-4"
                      />
                      <span>Include selected reward details</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer text-neutral-300">
                      <input
                        type="checkbox"
                        checked={localConfig.includeDeliveryAddress !== false}
                        onChange={(e) => handleInputChange('includeDeliveryAddress', e.target.checked)}
                        className="rounded bg-neutral-950 border-neutral-800 text-teal-500 focus:ring-teal-500 w-4 h-4"
                      />
                      <span>Include delivery &amp; shipping info</span>
                    </label>
                  </div>

                  {localConfig.includeDeliveryAddress !== false && (
                    <div className="pl-6 pt-1 text-xs">
                      <label className="flex items-center gap-2 cursor-pointer text-neutral-400">
                        <input
                          type="checkbox"
                          checked={localConfig.spoilerDeliveryInfo !== false}
                          onChange={(e) => handleInputChange('spoilerDeliveryInfo', e.target.checked)}
                          className="rounded bg-neutral-950 border-neutral-800 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                        />
                        <span>Mask shipping address with spoiler tags <code className="text-neutral-300 bg-neutral-900 px-1 rounded">||address||</code></span>
                      </label>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 🔌 BOT & WEBHOOK CONNECTION TAB */}
            {formTab === 'connection' && (
              <div className="space-y-4">
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

                {/* Bot Identity */}
                <div className="pt-3 border-t border-neutral-800/80 space-y-4">
                  <div className="flex items-center gap-2 text-xs font-semibold text-neutral-300 uppercase tracking-wider">
                    <Sliders className="w-3.5 h-3.5 text-indigo-400" />
                    Bot Identity &amp; Notification Settings
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
                          Pings <code className="text-neutral-300 bg-neutral-900 px-1 rounded">&lt;@user_id&gt;</code> directly.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Message prefix */}
                  <div>
                    <label className="text-xs text-neutral-400 block mb-1">Custom Message Text Prefix</label>
                    <input
                      type="text"
                      value={localConfig.customMessagePrefix ?? ''}
                      onChange={(e) => handleInputChange('customMessagePrefix', e.target.value)}
                      placeholder="🎉 NEW DONATION RECEIVED! (Optional text above the embed)"
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* 🔨 AUCTIONS & PRIZES TAB */}
            {formTab === 'auctions' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-400 uppercase tracking-wider">
                    <span>🔨 Auction House End Notifications &amp; Prize Fulfillment</span>
                  </div>
                  <span className="text-[10px] bg-amber-950/80 text-amber-300 px-2 py-0.5 rounded border border-amber-800/50">
                    Tiltify v5 Auctions
                  </span>
                </div>
                <p className="text-xs text-neutral-400">
                  Notify your Discord community when a Tiltify auction completes, celebrate the winning bidder, and alert moderators with fulfillment details.
                </p>

                <div className="pt-1">
                  <label className="flex items-center gap-2 cursor-pointer text-neutral-200 font-medium text-xs">
                    <input
                      type="checkbox"
                      checked={localConfig.enableAuctionAlerts !== false}
                      onChange={(e) => handleInputChange('enableAuctionAlerts', e.target.checked)}
                      className="rounded bg-neutral-950 border-neutral-800 text-amber-500 focus:ring-amber-500 w-4 h-4"
                    />
                    <span>Post notifications when Tiltify auctions end</span>
                  </label>
                </div>

                {localConfig.enableAuctionAlerts !== false && (
                  <div className="space-y-3 pt-2 pl-2 border-l-2 border-amber-500/30">
                    <div>
                      <label className="flex items-center gap-2 cursor-pointer text-neutral-300 text-xs">
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

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 text-xs">
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

                    <div>
                      <div className="flex items-center justify-between mb-1 text-xs">
                        <label className="text-neutral-400">Auction Title Template</label>
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-neutral-500">Insert:</span>
                          <button
                            type="button"
                            onClick={() => insertTag('auctionTitleTemplate', 'item')}
                            className="text-[10px] bg-neutral-800 hover:bg-neutral-700 text-amber-300 px-1.5 py-0.5 rounded font-mono"
                          >
                            +{'{item}'}
                          </button>
                          <button
                            type="button"
                            onClick={() => insertTag('auctionTitleTemplate', 'winner')}
                            className="text-[10px] bg-neutral-800 hover:bg-neutral-700 text-indigo-300 px-1.5 py-0.5 rounded font-mono"
                          >
                            +{'{winner}'}
                          </button>
                          <button
                            type="button"
                            onClick={() => insertTag('auctionTitleTemplate', 'amount')}
                            className="text-[10px] bg-neutral-800 hover:bg-neutral-700 text-teal-300 px-1.5 py-0.5 rounded font-mono"
                          >
                            +{'{amount}'}
                          </button>
                        </div>
                      </div>
                      <input
                        type="text"
                        value={localConfig.auctionTitleTemplate ?? '🔨 Auction Won: {item}!'}
                        onChange={(e) => handleInputChange('auctionTitleTemplate', e.target.value)}
                        placeholder="🔨 Auction Won: {item}!"
                        className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>

                    <div>
                      <label className="text-neutral-400 block mb-1 text-xs">Auction Footer Text</label>
                      <input
                        type="text"
                        value={localConfig.auctionFooterText ?? 'Tiltify Auction House • Winner Fulfillment'}
                        onChange={(e) => handleInputChange('auctionFooterText', e.target.value)}
                        placeholder="Tiltify Auction House • Winner Fulfillment"
                        className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

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
            <DiscordMessagePreview
              config={localConfig}
              sampleDonation={{
                donorName: "Alex Rivera",
                donorEmail: "alex.rivera@example.com",
                amount: 50.0,
                currency: "USD",
                comment: "Keep up the amazing stream for this cause! Proud of this community! 🎉",
                campaignName: campaignName?.trim() || "Charity Gaming Marathon 2026",
                reward: {
                  name: "Champion Signed Poster & T-Shirt",
                  description: "Limited edition charity t-shirt with official stream signature.",
                  quantity: 1,
                  deliveryType: "shipping",
                  donorEmail: "alex.rivera@example.com",
                  shippingAddress: {
                    recipientName: "Alex Rivera",
                    addressLine1: "100 Maple Ave, Suite 3B",
                    city: "Austin",
                    region: "TX",
                    postalCode: "78701",
                    country: "United States",
                  },
                  customOptions: {
                    "T-Shirt Size": "Adult L",
                    "Notes": "Please leave package by front gate",
                  },
                },
              }}
            />
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
