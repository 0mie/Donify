import React, { useState, useRef, useEffect } from 'react';
import { BotStatus } from '../types';
import { Bot, Radio, HelpCircle, BellRing, Lock, ShieldCheck, ShieldAlert, KeyRound, LogOut, ChevronDown, HardDrive } from 'lucide-react';

interface NavbarProps {
  status: BotStatus;
  hasPassword: boolean;
  onOpenGuide: () => void;
  onOpenBackup: () => void;
  onQuickTest: () => void;
  onSetupPasscode: () => void;
  onChangePasscode: () => void;
  onLock: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  status,
  hasPassword,
  onOpenGuide,
  onOpenBackup,
  onQuickTest,
  onSetupPasscode,
  onChangePasscode,
  onLock,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="border-b border-neutral-800 bg-neutral-900/80 backdrop-blur-md sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Logo and Name */}
        <div className="flex items-center gap-3">
          <div className="flex items-center">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-teal-500 to-indigo-600 p-0.5 shadow-md flex items-center justify-center">
              <div className="w-full h-full bg-neutral-950 rounded-[10px] flex items-center justify-center">
                <Bot className="w-5 h-5 text-teal-400" />
              </div>
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-white text-base tracking-tight">Tiltify &rarr; Discord Bot</h1>
              <span className="bg-teal-500/10 border border-teal-500/30 text-teal-400 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                Live
              </span>
            </div>
            <p className="text-xs text-neutral-400 hidden sm:block">
              Real-time donation alerts from Tiltify API directly into your Discord server
            </p>
          </div>
        </div>

        {/* Live Status Indicators & Quick Actions */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          {/* Security / Passcode Status Dropdown */}
          <div className="relative" ref={menuRef}>
            {hasPassword ? (
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="flex items-center gap-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-medium transition-colors"
                title="Admin security lock is active"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden sm:inline">Passcode Locked</span>
                <ChevronDown className="w-3 h-3 text-neutral-400" />
              </button>
            ) : (
              <button
                onClick={onSetupPasscode}
                className="flex items-center gap-1.5 bg-amber-950/60 hover:bg-amber-900/60 text-amber-300 border border-amber-800/80 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-medium transition-colors animate-pulse hover:animate-none"
                title="Your Render URL is unprotected! Click to set an Admin Passcode."
              >
                <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                <span>Set Passcode</span>
              </button>
            )}

            {menuOpen && hasPassword && (
              <div className="absolute right-0 mt-2 w-48 bg-neutral-900 border border-neutral-800 rounded-xl shadow-xl py-1.5 z-40 text-xs">
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    onChangePasscode();
                  }}
                  className="w-full px-3 py-2 text-left text-neutral-200 hover:bg-neutral-800 flex items-center gap-2 transition-colors"
                >
                  <KeyRound className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Change Passcode</span>
                </button>
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    onLock();
                  }}
                  className="w-full px-3 py-2 text-left text-red-300 hover:bg-neutral-800 flex items-center gap-2 transition-colors border-t border-neutral-800/60"
                >
                  <LogOut className="w-3.5 h-3.5 text-red-400" />
                  <span>Lock Dashboard</span>
                </button>
              </div>
            )}
          </div>

          {/* Discord Status Badge */}
          <div
            className={`hidden md:flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${
              status.discordConfigured
                ? 'bg-emerald-950/60 border-emerald-800/80 text-emerald-300'
                : 'bg-amber-950/60 border-amber-800/80 text-amber-300'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                status.discordConfigured ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
              }`}
            />
            <span>{status.discordConfigured ? 'Discord Ready' : 'Discord Unconfigured'}</span>
          </div>

          {/* Poller Badge */}
          <div
            className={`hidden lg:flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${
              status.isPolling
                ? 'bg-teal-950/60 border-teal-800/80 text-teal-300'
                : 'bg-neutral-900 border-neutral-800 text-neutral-400'
            }`}
          >
            <Radio className={`w-3.5 h-3.5 ${status.isPolling ? 'animate-spin text-teal-400' : ''}`} />
            <span>{status.isPolling ? 'Poller Active' : 'Webhook Mode'}</span>
          </div>

          {/* Quick Test Alert Button */}
          <button
            onClick={onQuickTest}
            className="flex items-center gap-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-white px-3 py-1.5 rounded-xl text-xs font-medium border border-neutral-700 transition-colors shadow-sm"
            title="Send an immediate test alert to Discord"
          >
            <BellRing className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Test Alert</span>
          </button>

          {/* Backup & Persistence Button */}
          <button
            onClick={onOpenBackup}
            className="flex items-center gap-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-white px-3 py-1.5 rounded-xl text-xs font-medium border border-neutral-700 transition-colors shadow-sm"
            title="Backup settings & Render persistence"
          >
            <HardDrive className="w-3.5 h-3.5 text-teal-400" />
            <span className="hidden sm:inline">Backup & Sync</span>
          </button>

          {/* Setup Guide Button */}
          <button
            onClick={onOpenGuide}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white px-3.5 py-1.5 rounded-xl text-xs font-medium transition-colors shadow-sm"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Setup Guide</span>
          </button>
        </div>
      </div>
    </header>
  );
};

