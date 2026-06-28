import React from 'react';
import { BookOpen, Search, Calendar, Landmark, Info, Sun, Moon, Menu, X, Wifi, WifiOff } from 'lucide-react';

interface NavigationProps {
  currentView: string;
  onNavigate: (view: string, params?: Record<string, string>) => void;
  isDark: boolean;
  onToggleTheme: () => void;
  isOnline: boolean;
}

export default function Navigation({
  currentView,
  onNavigate,
  isDark,
  onToggleTheme,
  isOnline,
}: NavigationProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  const navItems = [
    { id: 'search', label: 'Concordance', icon: Search },
    { id: 'reflection', label: 'Daily Reflection', icon: Calendar },
    { id: 'topics', label: 'Topics', icon: BookOpen },
    { id: 'sources', label: 'Sources', icon: Landmark },
    { id: 'about', label: 'About', icon: Info },
  ];

  return (
    <nav id="nav-bar" className="sticky top-0 z-50 border-b border-stone-200 dark:border-slate-800 bg-stone-50/90 dark:bg-slate-950/90 backdrop-blur-md transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Logo */}
          <div className="flex items-center">
            <button
              id="nav-logo"
              onClick={() => onNavigate('search')}
              className="flex items-center gap-2 group text-left focus:outline-none"
            >
              <span className="flex items-center justify-center w-8 h-8 rounded-sm bg-[#2C4A6E] dark:bg-slate-800 text-white font-serif italic text-xl border border-stone-200/40 dark:border-slate-700 shadow-sm group-hover:scale-105 transition-transform">
                bt
              </span>
              <div>
                <span className="font-serif font-semibold text-lg tracking-tight text-stone-900 dark:text-slate-100">
                  basictexts<span className="text-[#2C4A6E] dark:text-amber-500 font-sans font-normal text-sm">.org</span>
                </span>
                <p className="text-[10px] text-stone-500 dark:text-slate-400 font-sans -mt-1 font-medium tracking-wide uppercase">
                  AA Concordance
                </p>
              </div>
            </button>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-1 lg:space-x-2">
            {navItems.map(item => {
              const Icon = item.icon;
              const isActive = currentView === item.id;
              return (
                <button
                  id={`nav-item-${item.id}`}
                  key={item.id}
                  onClick={() => {
                    onNavigate(item.id);
                    setIsOpen(false);
                  }}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-[#2C4A6E] text-white dark:bg-slate-800 dark:text-[#C8902A] border-b border-stone-300 dark:border-slate-700'
                      : 'text-stone-600 dark:text-slate-300 hover:bg-stone-100 dark:hover:bg-slate-900 hover:text-stone-950 dark:hover:text-slate-50'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </button>
              );
            })}

            <div className="h-4 w-px bg-stone-200 dark:bg-slate-800 mx-2" />

            {/* Connection status badge */}
            <div
              id="connection-badge"
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                isOnline
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-900/30'
                  : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200/50 dark:border-amber-900/30'
              }`}
              title={isOnline ? 'Online mode active' : 'Offline cache active'}
            >
              {isOnline ? (
                <>
                  <Wifi className="w-3.5 h-3.5" />
                  <span className="hidden lg:inline">Online</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3.5 h-3.5 animate-pulse" />
                  <span>Offline Index</span>
                </>
              )}
            </div>

            {/* Theme Toggle */}
            <button
              id="theme-toggle-desktop"
              onClick={onToggleTheme}
              className="p-2 ml-1 rounded-md text-stone-500 hover:text-stone-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-stone-100 dark:hover:bg-slate-900 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              aria-label="Toggle theme"
            >
              {isDark ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>

          {/* Mobile menu button & Theme toggle */}
          <div className="flex items-center md:hidden gap-1">
            {/* Connection Indicator */}
            <div
              className={`flex items-center gap-0.5 px-2 py-1 rounded-full text-[10px] font-medium ${
                isOnline
                  ? 'bg-emerald-100/60 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400'
                  : 'bg-amber-100/60 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 animate-pulse'
              }`}
            >
              {isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
            </div>

            <button
              id="theme-toggle-mobile"
              onClick={onToggleTheme}
              className="p-2 rounded-md text-stone-500 dark:text-slate-400 hover:bg-stone-100 dark:hover:bg-slate-900 transition-colors"
              aria-label="Toggle theme"
            >
              {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
            </button>

            <button
              id="mobile-menu-btn"
              onClick={() => setIsOpen(!isOpen)}
              className="p-2 rounded-md text-stone-600 dark:text-slate-300 hover:bg-stone-100 dark:hover:bg-slate-900 focus:outline-none"
              aria-expanded={isOpen}
            >
              {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isOpen && (
        <div id="mobile-menu" className="md:hidden border-t border-stone-200 dark:border-slate-900 bg-stone-50 dark:bg-slate-950 px-2 pt-2 pb-4 space-y-1">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
              <button
                id={`mobile-nav-item-${item.id}`}
                key={item.id}
                onClick={() => {
                  onNavigate(item.id);
                  setIsOpen(false);
                }}
                className={`flex items-center gap-3 w-full px-4 py-3 rounded text-base font-medium transition-colors ${
                  isActive
                    ? 'bg-[#2C4A6E] text-white dark:bg-slate-800 dark:text-[#C8902A]'
                    : 'text-stone-700 dark:text-slate-300 hover:bg-stone-100 dark:hover:bg-slate-900'
                }`}
              >
                <Icon className="w-5 h-5" />
                {item.label}
              </button>
            );
          })}
        </div>
      )}
    </nav>
  );
}
