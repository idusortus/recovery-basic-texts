import React from 'react';
import { Calendar, ExternalLink, Share2, Clipboard, ArrowLeft, ArrowRight } from 'lucide-react';
import { getDailyReflection, formatDateLabel, getMonthName, interpolateLink, Passage, Source } from '../utils/search';

interface TodayReflectionProps {
  initialDate?: string; // MM-DD format
  sources: Source[];
  onNavigate: (view: string, params?: Record<string, string>) => void;
}

export default function TodayReflection({ initialDate, sources, onNavigate }: TodayReflectionProps) {
  // Get today's local date MM-DD
  const getTodayString = () => {
    const today = new Date();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${mm}-${dd}`;
  };

  const [selectedDate, setSelectedDate] = React.useState(initialDate || getTodayString());
  const [reflection, setReflection] = React.useState<Passage | null>(null);
  const [copied, setCopied] = React.useState(false);
  const [shared, setShared] = React.useState(false);

  // Load reflection whenever selectedDate changes
  React.useEffect(() => {
    async function load() {
      const data = await getDailyReflection(selectedDate);
      setReflection(data);
    }
    load();
  }, [selectedDate]);

  // Sync date picker with date state
  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.value) {
      const [_, m, d] = e.target.value.split('-'); // input date is YYYY-MM-DD
      setSelectedDate(`${m}-${d}`);
    }
  };

  // Move date forward/backward
  const shiftDate = (days: number) => {
    const dummyYear = 2026; // Use leap-year adjacent
    const [m, d] = selectedDate.split('-').map(Number);
    const dateObj = new Date(dummyYear, m - 1, d + days);
    
    const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
    const dd = String(dateObj.getDate()).padStart(2, '0');
    setSelectedDate(`${mm}-${dd}`);
  };

  const drSource = sources.find(s => s.id === 'daily-reflections');

  const getFullExternalLink = () => {
    if (!drSource || !reflection) return 'https://www.aa.org/daily-reflections';
    const linkData = {
      date: getMonthName(selectedDate).toLowerCase() + '-' + parseInt(selectedDate.split('-')[1], 10)
    };
    return interpolateLink(drSource.linkTemplate, linkData);
  };

  const handleCopy = () => {
    if (!reflection) return;
    const textToCopy = `"${reflection.title}" — AA Daily Reflection (${formatDateLabel(selectedDate)})\nRead official reflection here: ${getFullExternalLink()}\n(Indexed via basictexts.org)`;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (!reflection) return;
    const shareData = {
      title: `Daily Reflection: ${reflection.title}`,
      text: `"${reflection.title}" — AA Daily Reflection (${formatDateLabel(selectedDate)}) via basictexts.org`,
      url: `${window.location.origin}/reflection?date=${selectedDate}`
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
        setShared(true);
        setTimeout(() => setShared(false), 2000);
      } catch (err) {
        console.log('Share canceled or failed', err);
      }
    } else {
      // Fallback to copying share link
      navigator.clipboard.writeText(shareData.url);
      setShared(true);
      setTimeout(() => setShared(false), 2000);
    }
  };

  // Convert MM-DD to input value (YYYY-MM-DD)
  const getInputValue = () => {
    const currentYear = new Date().getFullYear();
    return `${currentYear}-${selectedDate}`;
  };

  return (
    <div id="reflection-view" className="max-w-2xl mx-auto px-4 py-8 space-y-6 animate-fade-in">
      {/* Date Navigation controls bar */}
      <div className="flex items-center justify-between p-4 bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-800 rounded shadow-sm">
        <button
          id="prev-date-btn"
          onClick={() => shiftDate(-1)}
          className="p-2 text-stone-600 hover:text-[#2C4A6E] dark:text-slate-400 dark:hover:text-[#C8902A] hover:bg-[#FFF4DC]/20 dark:hover:bg-slate-800 rounded transition-colors focus:outline-none cursor-pointer"
          title="Previous day"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        {/* Custom Calendar date picker picker */}
        <div className="flex flex-col items-center gap-1">
          <div className="relative inline-flex items-center">
            <span className="font-serif font-semibold text-lg text-stone-900 dark:text-slate-50 flex items-center gap-1.5 cursor-pointer hover:text-[#2C4A6E]">
              <Calendar className="w-4 h-4 text-[#2C4A6E] dark:text-[#C8902A]" />
              {formatDateLabel(selectedDate)}
            </span>
            <input
              id="date-picker-input"
              type="date"
              value={getInputValue()}
              onChange={handleDateChange}
              className="absolute inset-0 opacity-0 w-full cursor-pointer"
            />
          </div>
          <span className="text-[10px] text-stone-400 dark:text-slate-500 font-medium uppercase tracking-widest">
            {getMonthName(selectedDate)}
          </span>
        </div>

        <button
          id="next-date-btn"
          onClick={() => shiftDate(1)}
          className="p-2 text-stone-600 hover:text-[#2C4A6E] dark:text-slate-400 dark:hover:text-[#C8902A] hover:bg-[#FFF4DC]/20 dark:hover:bg-slate-800 rounded transition-colors focus:outline-none cursor-pointer"
          title="Next day"
        >
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>

      {/* Reflection Content Card */}
      {reflection ? (
        <div id="reflection-content-card" className="bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-800 shadow-sm p-6 sm:p-8 space-y-6 text-center rounded">
          <div className="space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#2C4A6E] dark:text-amber-500">
              AA Daily Reflections Index
            </p>
            <h1 className="font-serif text-2xl sm:text-3xl font-bold text-stone-950 dark:text-slate-50 tracking-tight leading-tight">
              {reflection.title}
            </h1>
            <p className="text-xs text-stone-500 dark:text-slate-400 font-mono">
              Concordance display for {formatDateLabel(selectedDate)} • Ref: {reflection.pageRef}
            </p>
          </div>

          <div className="h-px bg-stone-200 dark:bg-slate-900 max-w-xs mx-auto" />

          {/* Concordance statement */}
          <div className="space-y-4">
            <p className="literature-text italic text-stone-750 dark:text-slate-300 text-sm sm:text-base px-2 sm:px-6 leading-relaxed bg-[#FFF4DC]/20 dark:bg-slate-950/20 py-4 border-l-2 border-[#C8902A]">
              &ldquo;... {reflection.text} ...&rdquo;
            </p>
            <div className="p-3 bg-stone-50 dark:bg-slate-950 border border-stone-200 dark:border-slate-850 rounded text-xs text-stone-500 dark:text-slate-400 leading-normal">
              <strong>Copyright Notice:</strong> Daily Reflections is under copyright protection by AA Grapevine, Inc. In compliance with copyright policy, full texts are never hosted here. Access the full reflection officially at aa.org below.
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <a
              id="read-official-dr"
              href={getFullExternalLink()}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded bg-[#2C4A6E] hover:bg-[#2C4A6E]/90 text-white dark:bg-[#C8902A] dark:hover:bg-[#C8902A]/95 dark:text-slate-950 font-semibold text-sm sm:text-base border border-stone-200/20 shadow-sm transition-all focus:outline-none"
            >
              Read full reflection at aa.org
              <ExternalLink className="w-4 h-4" />
            </a>

            <div className="flex justify-center gap-2">
              <button
                id="copy-reflection-btn"
                onClick={handleCopy}
                className="flex items-center justify-center gap-1 px-4 py-3 rounded bg-white hover:bg-stone-50 dark:bg-slate-900 dark:hover:bg-slate-800 text-stone-700 dark:text-slate-300 border border-stone-200 dark:border-slate-800 text-sm font-semibold transition-colors focus:outline-none cursor-pointer"
                title="Copy reference info to clipboard"
              >
                <Clipboard className="w-4 h-4" />
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>

              <button
                id="share-reflection-btn"
                onClick={handleShare}
                className="flex items-center justify-center gap-1 px-4 py-3 rounded bg-white hover:bg-stone-50 dark:bg-slate-900 dark:hover:bg-slate-800 text-stone-700 dark:text-slate-300 border border-stone-200 dark:border-slate-800 text-sm font-semibold transition-colors focus:outline-none cursor-pointer"
                title="Share this entry"
              >
                <Share2 className="w-4 h-4" />
                <span>{shared ? 'Shared' : 'Share'}</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div id="reflection-loading-card" className="p-12 text-center text-stone-400">
          Loading recovery reflection...
        </div>
      )}
    </div>
  );
}
