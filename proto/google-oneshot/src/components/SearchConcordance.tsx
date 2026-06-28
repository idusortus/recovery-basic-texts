import React from 'react';
import { Search, Info, Landmark, BookOpen, Clipboard, Share2, Filter, X, ChevronRight, Check, Download, Calendar, ShieldCheck, ArrowRight, ExternalLink } from 'lucide-react';
import { searchCorpus, GroupedResults, Source, formatDateLabel, getMonthName, getDailyReflection, Passage, interpolateLink } from '../utils/search';

interface SearchConcordanceProps {
  initialQuery?: string;
  onQueryChange?: (q: string) => void;
  sources: Source[];
  onNavigate: (view: string, params?: Record<string, string>) => void;
}

export default function SearchConcordance({
  initialQuery = '',
  onQueryChange,
  sources,
  onNavigate,
}: SearchConcordanceProps) {
  const [query, setQuery] = React.useState(initialQuery);
  const [selectedSources, setSelectedSources] = React.useState<string[]>(sources.map(s => s.id));
  const [results, setResults] = React.useState<GroupedResults[]>([]);
  const [isSearching, setIsSearching] = React.useState(false);
  const [dailyTeaser, setDailyTeaser] = React.useState<Passage | null>(null);
  const [copiedId, setCopiedId] = React.useState<string | null>(null);
  const [sharedId, setSharedId] = React.useState<string | null>(null);
  const [deferredPrompt, setDeferredPrompt] = React.useState<any>(null);

  // Monitor PWA installation availability
  React.useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      alert("This app is already installed or your browser doesn't trigger PWA installations automatically. You can add it to your home screen using your browser's 'Add to Home Screen' option!");
      return;
    }
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  // Autofocus search input on desktop
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => {
    if (window.innerWidth > 768 && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, []);

  // Sync state if initialQuery changes
  React.useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  // Load today's Daily Reflection teaser for the dashboard
  React.useEffect(() => {
    async function loadTodayTeaser() {
      const today = new Date();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      const teaser = await getDailyReflection(`${mm}-${dd}`);
      setDailyTeaser(teaser);
    }
    loadTodayTeaser();
  }, []);

  // Execute search whenever query or source selection changes
  React.useEffect(() => {
    let active = true;
    async function runSearch() {
      if (!query.trim()) {
        setResults([]);
        return;
      }
      setIsSearching(true);
      try {
        const searchResults = await searchCorpus(query, selectedSources);
        if (active) {
          setResults(searchResults);
        }
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        if (active) {
          setIsSearching(false);
        }
      }
    }

    const timer = setTimeout(runSearch, 150); // slight debounce
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query, selectedSources]);

  const handleQuerySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onQueryChange) {
      onQueryChange(query);
    }
  };

  const handleTopicClick = (topic: string) => {
    setQuery(topic);
    if (onQueryChange) {
      onQueryChange(topic);
    }
  };

  const toggleSourceFilter = (sourceId: string) => {
    setSelectedSources(prev => {
      const isSelected = prev.includes(sourceId);
      if (isSelected) {
        // Keep at least one selected
        if (prev.length === 1) return prev;
        return prev.filter(id => id !== sourceId);
      } else {
        return [...prev, sourceId];
      }
    });
  };

  // Copy result text + citation to clipboard
  const handleCopyResult = (result: any) => {
    const { passage, source } = result;
    let citation = `${source.shortTitle}, ${passage.title}`;
    if (passage.pageRef) {
      citation += `, Ref: ${passage.pageRef}`;
    }
    const fullCopiedText = `"${passage.text}"\n— ${citation} (via basictexts.org)`;
    navigator.clipboard.writeText(fullCopiedText);
    setCopiedId(passage.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Share individual result
  const handleShareResult = async (result: any) => {
    const { passage, source } = result;
    const shareUrl = `${window.location.origin}/search?q=${encodeURIComponent(query)}&passage=${passage.id}`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: `basictexts.org | ${source.shortTitle} passage`,
          text: `"${passage.text}" — ${source.shortTitle}, ${passage.title}`,
          url: shareUrl
        });
        setSharedId(passage.id);
        setTimeout(() => setSharedId(null), 2000);
      } catch (e) {
        console.log('Share failed or canceled', e);
      }
    } else {
      // Clipboard fallback
      navigator.clipboard.writeText(shareUrl);
      setSharedId(passage.id);
      setTimeout(() => setSharedId(null), 2000);
    }
  };

  const popularChips = [
    'Acceptance', 'Resentment', 'Fear', 'Gratitude', 'Humility',
    'God', 'Honesty', 'Anger', 'Ego', 'Self'
  ];

  // Total result count
  const totalResultsCount = results.reduce((sum, g) => sum + g.count, 0);

  return (
    <div id="search-concordance-view" className="max-w-6xl mx-auto px-4 py-8 space-y-8 animate-fade-in">
      {/* 1. Header/Logo on Home screen only when no query is present */}
      {!query.trim() && (
        <div id="welcome-header" className="text-center space-y-4 py-6">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-[#2C4A6E]/10 dark:bg-slate-850 text-[#2C4A6E] dark:text-amber-500 border border-[#2C4A6E]/20 dark:border-slate-700 text-xs font-semibold tracking-wide">
            <Landmark className="w-3.5 h-3.5" />
            Free, Open-Source & PWA Installable
          </span>
          <h1 className="font-serif text-4xl sm:text-5xl font-bold tracking-tight text-[#2C4A6E] dark:text-slate-50 leading-none">
            Find what you're looking for in AA literature.
          </h1>
          <p className="text-stone-500 dark:text-slate-400 text-sm sm:text-base max-w-xl mx-auto leading-relaxed">
            Search any word, phrase, or topic to instantly discover every occurrence across the Big Book, 12 Steps, 12 Traditions, and Daily Reflections.
          </p>
        </div>
      )}

      {/* 2. Prominent Search Bar section */}
      <div id="search-bar-container" className="space-y-4">
        <form onSubmit={handleQuerySubmit} className="relative">
          <div className="relative flex items-center bg-[#F8F7F4] dark:bg-slate-900 border border-stone-200 focus-within:border-[#2C4A6E] dark:border-slate-800 dark:focus-within:border-[#2C4A6E] rounded-sm shadow-inner transition-all overflow-hidden h-14">
            <Search className="w-5 h-5 ml-4 text-stone-400 dark:text-slate-600 flex-shrink-0" />
            <input
              id="concordance-search-input"
              ref={searchInputRef}
              type="text"
              value={query}
              onChange={e => {
                setQuery(e.target.value);
                if (onQueryChange) onQueryChange(e.target.value);
              }}
              placeholder="Search phrases, keywords, or page numbers (e.g., 'acceptance')"
              className="w-full h-full py-4 px-3 text-stone-900 dark:text-slate-50 bg-transparent text-sm sm:text-base focus:outline-none placeholder-stone-400 dark:placeholder-slate-600"
            />
            
            {/* CMD + K & Clear Section */}
            <div className="flex items-center gap-2 mr-3 flex-shrink-0">
              {!query && (
                <span className="hidden sm:inline-block px-1.5 py-0.5 bg-white dark:bg-slate-800 border border-stone-200 dark:border-slate-750 rounded text-[10px] font-mono text-stone-400 dark:text-slate-500">
                  CMD + K
                </span>
              )}
              {query && (
                <button
                  id="clear-search-btn"
                  type="button"
                  onClick={() => {
                    setQuery('');
                    if (onQueryChange) onQueryChange('');
                  }}
                  className="p-1.5 text-stone-400 hover:text-stone-600 dark:text-slate-600 dark:hover:text-slate-400 rounded hover:bg-stone-200/50 dark:hover:bg-slate-800 transition-colors"
                  title="Clear search"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </form>

        {/* 3. Toggle Sources Filter Bar */}
        <div id="source-filters" className="space-y-2">
          <p className="text-[10px] font-semibold text-stone-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
            <Filter className="w-3 h-3 text-[#2C4A6E] dark:text-slate-500" />
            Filter Sources:
          </p>
          <div className="flex flex-wrap gap-2">
            {sources.map(source => {
              const isSelected = selectedSources.includes(source.id);
              return (
                <button
                  id={`filter-badge-${source.id}`}
                  key={source.id}
                  onClick={() => toggleSourceFilter(source.id)}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-all focus:outline-none border ${
                    isSelected
                      ? 'bg-[#2C4A6E] text-white border-[#2C4A6E] dark:bg-slate-800 dark:text-[#C8902A] dark:border-slate-700'
                      : 'bg-white dark:bg-slate-900/40 border-stone-200 dark:border-slate-800 text-stone-500 dark:text-slate-400 hover:bg-stone-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: isSelected ? '#ffffff' : source.color }}
                  />
                  {source.shortTitle}
                  {isSelected && <Check className="w-3 h-3 ml-0.5 text-white/90 dark:text-[#C8902A]" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* 4. Quick-access Topic Chips */}
        {!query.trim() && (
          <div id="quick-topics" className="space-y-2 pt-2">
            <p className="text-[10px] font-semibold text-stone-400 dark:text-slate-500 uppercase tracking-widest">
              Popular Recovery Searches:
            </p>
            <div className="flex flex-wrap gap-1.5">
              {popularChips.map(chip => (
                <button
                  id={`chip-${chip.toLowerCase()}`}
                  key={chip}
                  onClick={() => handleTopicClick(chip)}
                  className="px-2.5 py-1 text-xs font-medium text-stone-700 hover:text-[#2C4A6E] hover:bg-[#FFF4DC] hover:border-[#C8902A]/30 border border-stone-200 dark:border-slate-800 bg-white dark:text-slate-300 dark:bg-slate-900 dark:hover:bg-slate-800 rounded transition-all focus:outline-none shadow-sm"
                >
                  {chip}
                </button>
              ))}
              <button
                id="view-all-topics-btn"
                onClick={() => onNavigate('topics')}
                className="px-2.5 py-1 text-xs font-semibold text-[#2C4A6E] dark:text-[#C8902A] hover:underline inline-flex items-center gap-0.5"
              >
                Browse All A-Z
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 5. Geometric Balance 3-Column Dashboard Grid (on empty search only) */}
      {!query.trim() && (
        <div id="home-dashboard-grid" className="grid grid-cols-1 md:grid-cols-12 gap-6 pt-4">
          
          {/* Column 1: Library Status (col-span-3) */}
          <div className="md:col-span-3 border border-stone-200 dark:border-slate-800 p-6 flex flex-col justify-between bg-white dark:bg-slate-900/20 rounded shadow-sm">
            <div className="space-y-4">
              <h2 className="text-[10px] font-bold uppercase tracking-[0.15em] text-stone-400 dark:text-slate-500">
                Library Status
              </h2>
              <ul className="space-y-3.5 text-xs text-stone-600 dark:text-slate-300">
                <li className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span>Alcoholics Anonymous</span>
                  </div>
                  <span className="font-mono text-[9px] text-stone-400 dark:text-slate-500">FULL-TEXT</span>
                </li>
                <li className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    <span>12 Steps & 12 Trad.</span>
                  </div>
                  <span className="font-mono text-[9px] text-stone-400 dark:text-slate-500">CONCORDANCE</span>
                </li>
                <li className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span>Daily Reflections</span>
                  </div>
                  <span className="font-mono text-[9px] text-stone-400 dark:text-slate-500">FULL-TEXT</span>
                </li>
              </ul>
            </div>

            <div className="bg-[#2C4A6E]/5 dark:bg-slate-800/20 border border-stone-200 dark:border-slate-800 p-3 mt-6 rounded text-[11px] leading-relaxed text-stone-500 dark:text-slate-400">
              <span className="font-semibold text-[#2C4A6E] dark:text-amber-500">Disclaimer:</span> basictexts is a free community-sourced index. Respect copyrighted material. Always purchase official editions.
            </div>
          </div>

          {/* Column 2: Today's Reflection (col-span-6) */}
          <div className="md:col-span-6 flex flex-col space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-[10px] font-bold uppercase tracking-[0.15em] text-stone-400 dark:text-slate-500">
                Today's Reflection
              </h2>
              <span className="text-xs font-serif italic text-[#2C4A6E] dark:text-[#C8902A] font-medium">
                {dailyTeaser ? formatDateLabel(new Date().toISOString().substring(5, 10)) : ''}
              </span>
            </div>
            
            <div className="bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-800 p-6 shadow-sm flex flex-col rounded justify-between h-full min-h-[250px]">
              {dailyTeaser ? (
                <div className="space-y-4 flex flex-col justify-between h-full">
                  <div>
                    <h3 className="font-serif text-lg sm:text-xl font-bold text-stone-900 dark:text-slate-100 mb-2">
                      {dailyTeaser.title}
                    </h3>
                    <p className="font-serif text-sm sm:text-base text-stone-700 dark:text-slate-300 italic leading-relaxed line-clamp-4">
                      &ldquo;... {dailyTeaser.text} ...&rdquo;
                    </p>
                  </div>
                  
                  <div className="flex items-center justify-between border-t border-stone-100 dark:border-slate-800/40 pt-4 mt-2">
                    <span className="font-mono text-[10px] text-stone-400 dark:text-slate-500">
                      Ref: {dailyTeaser.pageRef}
                    </span>
                    <button
                      id="view-full-reflection-btn"
                      onClick={() => onNavigate('reflection')}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#2C4A6E] hover:text-[#2C4A6E]/80 dark:text-amber-500 dark:hover:text-amber-400 cursor-pointer"
                    >
                      Read full reflection
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-stone-400 text-xs italic">Loading daily reflection teaser...</p>
              )}
            </div>
          </div>

          {/* Column 3: Tools & Navigation (col-span-3) */}
          <div className="md:col-span-3 border border-stone-200 dark:border-slate-800 p-6 bg-white dark:bg-slate-900/20 rounded shadow-sm flex flex-col justify-between">
            <div className="space-y-4">
              <h2 className="text-[10px] font-bold uppercase tracking-[0.15em] text-stone-400 dark:text-slate-500">
                Tools & PWA
              </h2>
              
              <div className="grid grid-cols-1 gap-2">
                <button
                  id="browse-by-date-btn"
                  onClick={() => onNavigate('reflection')}
                  className="w-full flex items-center justify-between px-3 py-2 border border-stone-200 dark:border-slate-800 hover:border-[#2C4A6E] dark:hover:border-amber-500 rounded text-left text-xs font-medium text-stone-700 dark:text-slate-200 bg-white dark:bg-slate-900/50 hover:bg-[#FFF4DC]/20 dark:hover:bg-slate-850/40 transition-colors cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 text-[#2C4A6E] dark:text-[#C8902A]" />
                    Browse by Date
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-stone-400" />
                </button>
                
                <button
                  id="browse-all-topics-tool-btn"
                  onClick={() => onNavigate('topics')}
                  className="w-full flex items-center justify-between px-3 py-2 border border-stone-200 dark:border-slate-800 hover:border-[#2C4A6E] dark:hover:border-amber-500 rounded text-left text-xs font-medium text-stone-700 dark:text-slate-200 bg-white dark:bg-slate-900/50 hover:bg-[#FFF4DC]/20 dark:hover:bg-slate-850/40 transition-colors cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <BookOpen className="w-3.5 h-3.5 text-[#2C4A6E] dark:text-[#C8902A]" />
                    Browse A-Z Topics
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-stone-400" />
                </button>

                <button
                  id="about-sources-tool-btn"
                  onClick={() => onNavigate('sources')}
                  className="w-full flex items-center justify-between px-3 py-2 border border-stone-200 dark:border-slate-800 hover:border-[#2C4A6E] dark:hover:border-amber-500 rounded text-left text-xs font-medium text-stone-700 dark:text-slate-200 bg-white dark:bg-slate-900/50 hover:bg-[#FFF4DC]/20 dark:hover:bg-slate-850/40 transition-colors cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <Info className="w-3.5 h-3.5 text-[#2C4A6E] dark:text-[#C8902A]" />
                    Legal & Copyright
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-stone-400" />
                </button>
              </div>
            </div>

            {/* PWA Launcher Block */}
            <div className="mt-6 pt-4 border-t border-stone-100 dark:border-slate-800/60 space-y-2">
              <div className="flex items-center gap-1.5">
                <div className="w-5 h-5 bg-[#2C4A6E] text-white flex items-center justify-center font-serif italic text-xs rounded-sm">
                  bt
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-stone-800 dark:text-slate-200">basictexts PWA</h4>
                  <p className="text-[9px] text-stone-400 dark:text-slate-500">v1.0.0 • Offline Ready</p>
                </div>
              </div>
              <button
                id="pwa-install-trigger"
                onClick={handleInstallClick}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-[#2C4A6E] hover:bg-[#2C4A6E]/90 dark:bg-slate-800 dark:hover:bg-slate-700 text-white dark:text-[#C8902A] text-xs font-semibold rounded-sm transition-colors shadow-sm focus:outline-none cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                Install App Offline
              </button>
            </div>
          </div>

        </div>
      )}

      {/* 6. Active Search Results Area */}
      {query.trim() && (
        <div id="search-results-section" className="space-y-8">
          {/* Results Summary Header */}
          <div className="flex items-center justify-between border-b border-stone-200 dark:border-slate-800 pb-2">
            <p className="text-xs sm:text-sm text-stone-500 dark:text-slate-400">
              {isSearching ? (
                <span>Searching concordance...</span>
              ) : (
                <span>Found <strong>{totalResultsCount}</strong> occurrence{totalResultsCount !== 1 ? 's' : ''} across selected sources</span>
              )}
            </p>
          </div>

          {/* Grouped results loop */}
          {results.length > 0 ? (
            results.map(group => (
              <div
                id={`source-group-${group.source.id}`}
                key={group.source.id}
                className="space-y-4"
              >
                {/* Group Header badge */}
                <div className="sticky top-[64px] z-10 py-2 bg-stone-100/90 dark:bg-slate-950/90 backdrop-blur-sm flex items-center justify-between border-b border-stone-200/80 dark:border-slate-900 px-3 rounded-lg">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: group.source.color }}
                    />
                    <h2 className="font-serif font-bold text-sm sm:text-base text-[#2C4A6E] dark:text-slate-100">
                      {group.source.title}
                    </h2>
                  </div>
                  <span className="text-[10px] font-mono font-bold bg-[#2C4A6E] text-white dark:bg-slate-800 dark:text-[#C8902A] px-2 py-0.5 rounded-sm">
                    {group.count} match{group.count !== 1 ? 'es' : ''}
                  </span>
                </div>

                {/* Result cards inside group */}
                <div className="grid gap-4">
                  {group.results.map(result => (
                    <div
                      id={`result-${result.passage.id}`}
                      key={result.passage.id}
                      className="bg-white dark:bg-slate-900/35 border border-stone-200 dark:border-slate-800/80 hover:border-[#2C4A6E] dark:hover:border-amber-500/30 rounded p-5 shadow-sm space-y-3 transition-all"
                    >
                      {/* Title & Page references row */}
                      <div className="flex items-center justify-between text-xs font-semibold text-stone-500 dark:text-slate-400 border-b border-stone-100 dark:border-slate-800/40 pb-2">
                        <span className="font-serif text-[#2C4A6E] dark:text-slate-300">
                          {result.passage.chapterRef || 'Literature'} • {result.passage.title}
                        </span>
                        {result.passage.pageRef && (
                          <span className="font-mono text-[10px] bg-stone-100 dark:bg-slate-800 text-stone-600 dark:text-slate-400 px-1.5 py-0.5 rounded-sm">
                            Ref: {result.passage.pageRef}
                          </span>
                        )}
                      </div>

                      {/* Text content paragraph */}
                      <p
                        className="literature-text text-stone-850 dark:text-slate-200 text-sm sm:text-base leading-relaxed pl-1"
                        dangerouslySetInnerHTML={{ __html: result.highlightedText }}
                      />

                      {/* Footer Actions / Links */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                        {/* Source copyright warnings and official links */}
                        <div>
                          {group.source.displayMode === 'concordance-only' ? (
                            <a
                              id={`official-link-${result.passage.id}`}
                              href={interpolateLink(group.source.linkTemplate, { date: result.passage.date || '' })}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-[#2C4A6E] hover:text-[#2C4A6E]/85 dark:text-amber-500 dark:hover:text-amber-400 font-semibold"
                            >
                              Read full passage at aa.org
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          ) : group.source.freeUrl ? (
                            <a
                              id={`free-link-${result.passage.id}`}
                              href={interpolateLink(group.source.linkTemplate, { page: result.passage.pageRef || '' })}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-stone-500 dark:text-slate-400 hover:underline"
                            >
                              View source text
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          ) : null}
                        </div>

                        {/* Copy / Share buttons */}
                        <div className="flex items-center gap-2 sm:self-end">
                          <button
                            id={`copy-btn-${result.passage.id}`}
                            onClick={() => handleCopyResult(result)}
                            className="p-1.5 rounded bg-stone-50 hover:bg-[#FFF4DC]/30 dark:bg-slate-950 dark:hover:bg-slate-800 border border-stone-200/60 dark:border-slate-800/60 text-stone-500 hover:text-[#C8902A] dark:text-slate-400 dark:hover:text-slate-200 transition-colors focus:outline-none flex items-center gap-1 text-[10px] font-semibold"
                            title="Copy passage to clipboard"
                          >
                            {copiedId === result.passage.id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Clipboard className="w-3.5 h-3.5" />}
                            <span>{copiedId === result.passage.id ? 'Copied' : 'Copy'}</span>
                          </button>

                          <button
                            id={`share-btn-${result.passage.id}`}
                            onClick={() => handleShareResult(result)}
                            className="p-1.5 rounded bg-stone-50 hover:bg-[#FFF4DC]/30 dark:bg-slate-950 dark:hover:bg-slate-800 border border-stone-200/60 dark:border-slate-800/60 text-stone-500 hover:text-[#C8902A] dark:text-slate-400 dark:hover:text-slate-200 transition-colors focus:outline-none flex items-center gap-1 text-[10px] font-semibold"
                            title="Share deep link to this result"
                          >
                            <Share2 className="w-3.5 h-3.5" />
                            <span>{sharedId === result.passage.id ? 'Shared' : 'Share'}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          ) : (
            !isSearching && (
              <div id="no-results-card" className="text-center py-12 px-4 bg-white dark:bg-slate-950 rounded border border-stone-200 dark:border-slate-900 space-y-4 shadow-sm">
                <p className="text-stone-600 dark:text-slate-400 font-serif italic text-base">
                  No concordant matches found for &ldquo;{query}&rdquo;
                </p>
                <div className="max-w-md mx-auto text-xs text-stone-500 dark:text-slate-400 space-y-2 leading-relaxed">
                  <p>
                    Check for spelling errors, use shorter keyword roots, or try one of the following terms:
                  </p>
                  <div className="flex flex-wrap justify-center gap-1 pt-1">
                    {['Acceptance', 'Promises', 'Sponsorship', 'Resentment', 'Fear', 'Spiritual'].map(rec => (
                      <button
                        key={rec}
                        onClick={() => handleTopicClick(rec)}
                        className="px-2 py-1 bg-[#F8F7F4] dark:bg-slate-900 hover:bg-[#FFF4DC] hover:text-[#C8902A] rounded border border-stone-200 dark:border-slate-800 font-medium cursor-pointer"
                      >
                        {rec}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}
