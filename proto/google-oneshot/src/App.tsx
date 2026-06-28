import React from 'react';
import Navigation from './components/Navigation';
import SearchConcordance from './components/SearchConcordance';
import TodayReflection from './components/TodayReflection';
import BrowseTopics from './components/BrowseTopics';
import SourcesList from './components/SourcesList';
import AboutView from './components/AboutView';
import { getSources, Source } from './utils/search';

export default function App() {
  // Navigation & Routing state
  const [currentView, setCurrentView] = React.useState<string>('search');
  const [queryParams, setQueryParams] = React.useState<Record<string, string>>({});
  
  // Theme state (system default, stored in localStorage)
  const [isDark, setIsDark] = React.useState<boolean>(() => {
    const saved = localStorage.getItem('basictexts-theme');
    if (saved) return saved === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  // Online connection tracking
  const [isOnline, setIsOnline] = React.useState<boolean>(navigator.onLine);

  // Loaded sources database
  const [sources, setSources] = React.useState<Source[]>([]);

  // 1. Listeners for Online/Offline connectivity
  React.useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // 2. Load basic source metadata on start
  React.useEffect(() => {
    async function fetchMetadata() {
      const dbSources = await getSources();
      setSources(dbSources);
    }
    fetchMetadata();
  }, []);

  // 3. Hydrate client-side theme
  React.useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.add('light');
      root.classList.remove('dark');
    }
  }, [isDark]);

  // Toggle theme action
  const toggleTheme = () => {
    setIsDark(prev => {
      const newValue = !prev;
      localStorage.setItem('basictexts-theme', newValue ? 'dark' : 'light');
      return newValue;
    });
  };

  // 4. Custom Zero-Dependency Routing Engine with URL History Syncing
  const parseUrlState = React.useCallback(() => {
    const path = window.location.pathname;
    const search = window.location.search;
    const params = new URLSearchParams(search);
    const paramsObj: Record<string, string> = {};
    params.forEach((val, key) => {
      paramsObj[key] = val;
    });

    setQueryParams(paramsObj);

    if (path === '/reflection' || path.startsWith('/reflection')) {
      setCurrentView('reflection');
    } else if (path === '/topics' || path.startsWith('/topics')) {
      setCurrentView('topics');
    } else if (path === '/sources' || path.startsWith('/sources')) {
      setCurrentView('sources');
    } else if (path === '/about' || path.startsWith('/about')) {
      setCurrentView('about');
    } else {
      setCurrentView('search');
    }
  }, []);

  // Listen to browser popstate (back/forward buttons)
  React.useEffect(() => {
    parseUrlState();
    window.addEventListener('popstate', parseUrlState);
    return () => {
      window.removeEventListener('popstate', parseUrlState);
    };
  }, [parseUrlState]);

  // Main navigation action
  const navigate = (view: string, params: Record<string, string> = {}) => {
    let newPath = '/';
    let queryStr = '';

    if (view === 'reflection') {
      newPath = '/reflection';
      if (params.date) queryStr = `?date=${params.date}`;
    } else if (view === 'topics') {
      newPath = '/topics';
    } else if (view === 'sources') {
      newPath = '/sources';
    } else if (view === 'about') {
      newPath = '/about';
    } else {
      newPath = '/';
      if (params.q) queryStr = `?q=${encodeURIComponent(params.q)}`;
    }

    const fullUrl = newPath + queryStr;
    
    // Update browser history (silently fallback if window environment is restricted)
    try {
      window.history.pushState({ view, params }, '', fullUrl);
    } catch (e) {
      console.warn('History navigation restricted inside sandbox frame:', e);
    }

    setCurrentView(view);
    setQueryParams(params);
  };

  const handleSelectTopicFromChips = (topic: string) => {
    navigate('search', { q: topic });
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F8F7F4] text-[#1A1A1A] dark:bg-slate-950 dark:text-slate-200 transition-colors duration-200 selection:bg-[#FFF4DC] dark:selection:bg-amber-950/50 selection:text-[#C8902A] dark:selection:text-amber-200">
      
      {/* Navigation header */}
      <Navigation
        currentView={currentView}
        onNavigate={(view, params) => navigate(view, params)}
        isDark={isDark}
        onToggleTheme={toggleTheme}
        isOnline={isOnline}
      />

      {/* Main viewport container */}
      <main className="flex-grow">
        {currentView === 'search' && (
          <SearchConcordance
            initialQuery={queryParams.q || ''}
            onQueryChange={q => {
              // Update URL query silently without re-triggering component mount
              const newUrl = q.trim() ? `/?q=${encodeURIComponent(q)}` : '/';
              try {
                window.history.replaceState(null, '', newUrl);
              } catch (e) {}
              setQueryParams(prev => ({ ...prev, q }));
            }}
            sources={sources}
            onNavigate={(view, params) => navigate(view, params)}
          />
        )}

        {currentView === 'reflection' && (
          <TodayReflection
            initialDate={queryParams.date}
            sources={sources}
            onNavigate={(view, params) => navigate(view, params)}
          />
        )}

        {currentView === 'topics' && (
          <BrowseTopics
            onSelectTopic={handleSelectTopicFromChips}
          />
        )}

        {currentView === 'sources' && (
          <SourcesList
            sources={sources}
          />
        )}

        {currentView === 'about' && (
          <AboutView />
        )}
      </main>

      {/* Minimalistic, humble footer */}
      <footer id="main-footer" className="border-t border-stone-200 dark:border-slate-900 bg-stone-100/50 dark:bg-slate-950/50 py-6 transition-colors duration-200 text-center">
        <div className="max-w-7xl mx-auto px-4 text-[11px] sm:text-xs text-stone-500 dark:text-slate-500 space-y-2">
          <p className="font-medium">
            basictexts.org — A free, open-source Alcoholics Anonymous Literature Concordance.
          </p>
          <p className="max-w-2xl mx-auto leading-relaxed text-[10px] sm:text-[11px] text-stone-400 dark:text-slate-600">
            This application is not associated with, endorsed by, or affiliated with Alcoholics Anonymous World Services, Inc. or any other recovery service committee. All recovery citations are provided under Fair Use for research and personal study.
          </p>
        </div>
      </footer>
    </div>
  );
}
