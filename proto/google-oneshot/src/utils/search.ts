export interface Source {
  id: string;
  title: string;
  shortTitle: string;
  description: string;
  copyright: 'public-domain' | 'protected' | 'unknown';
  displayMode: 'full-text' | 'concordance-only' | 'snippet';
  contextWords: number;
  linkTemplate: string;
  officialUrl: string | null;
  freeUrl: string | null;
  color: string;
  sortOrder: number;
  enabled: boolean;
}

export interface Passage {
  id: string;
  sourceId: string;
  title: string;
  sequence: number;
  date: string | null; // ISO format or MM-DD
  pageRef: string | null;
  chapterRef: string | null;
  text: string;
  linkData: Record<string, string> | null;
}

export interface SearchResult {
  passage: Passage;
  source: Source;
  matchedText: string; // The text to display, potentially clipped
  highlightedText: string; // The HTML text with <mark> tags around matches
  matchCount: number;
  isClipped: boolean;
}

export interface GroupedResults {
  source: Source;
  results: SearchResult[];
  count: number;
}

// Global cached database
let sourcesCache: Source[] = [];
let passagesCache: Passage[] = [];
let isLoading = false;
let loadPromise: Promise<void> | null = null;

// Clean and tokenize text
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 0);
}

// Ingest/load corpus data from public JSON files
export async function loadCorpus(): Promise<void> {
  if (sourcesCache.length > 0 && passagesCache.length > 0) {
    return Promise.resolve();
  }
  if (loadPromise) {
    return loadPromise;
  }

  loadPromise = (async () => {
    isLoading = true;
    try {
      // Fetch sources
      const sourcesRes = await fetch('/corpus/sources.json');
      const sources: Source[] = await sourcesRes.json();
      sourcesCache = sources.filter(s => s.enabled);

      // Fetch each enabled corpus
      const passagesList: Passage[][] = await Promise.all(
        sourcesCache.map(async source => {
          try {
            const res = await fetch(`/corpus/${source.id}.json`);
            if (res.ok) {
              const data = await res.json();
              return data as Passage[];
            }
          } catch (e) {
            console.error(`Error loading corpus for ${source.id}:`, e);
          }
          return [];
        })
      );

      passagesCache = passagesList.flat();
    } catch (err) {
      console.error('Failed to load basictexts corpus:', err);
      // Fallback to minimal mock index in case of failure during initial load
      sourcesCache = [];
      passagesCache = [];
    } finally {
      isLoading = false;
    }
  })();

  return loadPromise;
}

// Highlighting and KWIC (Key Word in Context) clipping logic
export function createKwicSnippet(
  text: string,
  queryWords: string[],
  contextWordsCount: number,
  displayMode: 'full-text' | 'concordance-only' | 'snippet'
): { matchedText: string; highlightedText: string; isClipped: boolean } {
  if (queryWords.length === 0) {
    return {
      matchedText: text,
      highlightedText: escapeHtml(text),
      isClipped: false,
    };
  }

  const lowercaseText = text.toLowerCase();
  
  // Find the first matching word's index
  let firstMatchIndex = -1;
  let matchedWordLength = 0;
  
  for (const word of queryWords) {
    const idx = lowercaseText.indexOf(word);
    if (idx !== -1 && (firstMatchIndex === -1 || idx < firstMatchIndex)) {
      firstMatchIndex = idx;
      matchedWordLength = word.length;
    }
  }

  // If no match found, or displayMode is full-text, return full text
  if (firstMatchIndex === -1 || displayMode === 'full-text') {
    return {
      matchedText: text,
      highlightedText: highlightText(text, queryWords),
      isClipped: false,
    };
  }

  // Segment text into words
  const words = text.split(/\s+/);
  // Find which word index contains the first match
  let matchedWordIdx = 0;
  let charAccumulator = 0;
  
  for (let i = 0; i < words.length; i++) {
    charAccumulator += words[i].length + 1; // +1 for the space split
    if (charAccumulator > firstMatchIndex) {
      matchedWordIdx = i;
      break;
    }
  }

  // Concordance-only displays need tight clip, snippet mode can be slightly more generous
  const wordsBefore = contextWordsCount;
  const wordsAfter = contextWordsCount;

  const startIdx = Math.max(0, matchedWordIdx - wordsBefore);
  const endIdx = Math.min(words.length, matchedWordIdx + 1 + wordsAfter);

  const snippetWords = words.slice(startIdx, endIdx);
  const leadingEllipsis = startIdx > 0 ? '... ' : '';
  const trailingEllipsis = endIdx < words.length ? ' ...' : '';

  const matchedText = leadingEllipsis + snippetWords.join(' ') + trailingEllipsis;
  const highlightedText = leadingEllipsis + highlightText(snippetWords.join(' '), queryWords) + trailingEllipsis;

  return {
    matchedText,
    highlightedText,
    isClipped: startIdx > 0 || endIdx < words.length,
  };
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Case-insensitive replacement that wraps query words with a styled mark tag
function highlightText(text: string, queryWords: string[]): string {
  if (queryWords.length === 0) return escapeHtml(text);
  
  // Sort query words by length descending so longer words get replaced first
  const sortedWords = [...queryWords].sort((a, b) => b.length - a.length);
  const escapedWords = sortedWords.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  
  // Create a regex matching any of the words
  const regex = new RegExp(`\\b(${escapedWords.join('|')})\\b`, 'gi');
  
  const tempSpanId = 'MARK_' + Math.random().toString(36).substr(2, 9);
  
  // We escape HTML first to prevent any script injections or broken layout
  const escapedText = escapeHtml(text);
  
  // Re-run the regex on escaped text
  const highlighted = escapedText.replace(regex, match => {
    return `<mark class="bg-[#FFF4DC] text-[#C8902A] dark:bg-amber-950/40 dark:text-amber-400 px-1 py-0.5 rounded-sm font-medium border-b border-[#C8902A]/30">${match}</mark>`;
  });
  
  return highlighted;
}

// Perform search
export async function searchCorpus(query: string, sourceFilterIds: string[] = []): Promise<GroupedResults[]> {
  await loadCorpus();

  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return [];
  }

  const isPhrase = trimmedQuery.startsWith('"') && trimmedQuery.endsWith('"');
  let queryTerms: string[] = [];
  let phraseRegex: RegExp | null = null;

  if (isPhrase) {
    const phrase = trimmedQuery.slice(1, -1).trim().toLowerCase();
    queryTerms = [phrase];
    phraseRegex = new RegExp(`\\b${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
  } else {
    queryTerms = tokenize(trimmedQuery);
  }

  if (queryTerms.length === 0) {
    return [];
  }

  const results: SearchResult[] = [];

  for (const passage of passagesCache) {
    // Check if source matches filter
    if (sourceFilterIds.length > 0 && !sourceFilterIds.includes(passage.sourceId)) {
      continue;
    }

    const source = sourcesCache.find(s => s.id === passage.sourceId);
    if (!source) continue;

    const textLower = passage.text.toLowerCase();
    let isMatch = false;
    let matchCount = 0;

    if (phraseRegex) {
      // Phrase search
      isMatch = phraseRegex.test(passage.text);
      if (isMatch) {
        const matches = passage.text.match(new RegExp(phraseRegex.source, 'gi'));
        matchCount = matches ? matches.length : 1;
      }
    } else {
      // AND keyword search: passage must contain all words (or at least one if query is short, let's require ALL words for precision)
      let containsAll = true;
      for (const term of queryTerms) {
        if (!textLower.includes(term)) {
          containsAll = false;
          break;
        }
      }

      if (containsAll) {
        isMatch = true;
        // Count matches
        for (const term of queryTerms) {
          const regex = new RegExp(`\\b${term}\\b`, 'gi');
          const matches = passage.text.match(regex);
          matchCount += matches ? matches.length : 0;
        }
      }
    }

    if (isMatch) {
      const { matchedText, highlightedText, isClipped } = createKwicSnippet(
        passage.text,
        queryTerms,
        source.contextWords,
        source.displayMode
      );

      results.push({
        passage,
        source,
        matchedText,
        highlightedText,
        matchCount,
        isClipped,
      });
    }
  }

  // Group by source and sort
  const groupsMap = new Map<string, SearchResult[]>();
  for (const result of results) {
    const sId = result.source.id;
    if (!groupsMap.has(sId)) {
      groupsMap.set(sId, []);
    }
    groupsMap.get(sId)!.push(result);
  }

  const groupedResults: GroupedResults[] = [];
  for (const source of sourcesCache) {
    const sResults = groupsMap.get(source.id) || [];
    if (sResults.length > 0) {
      // Sort passages in sequence order
      sResults.sort((a, b) => a.passage.sequence - b.passage.sequence);
      groupedResults.push({
        source,
        results: sResults,
        count: sResults.length,
      });
    }
  }

  return groupedResults.sort((a, b) => a.source.sortOrder - b.source.sortOrder);
}

// Get standard list of sources
export async function getSources(): Promise<Source[]> {
  await loadCorpus();
  return sourcesCache;
}

// Get daily reflection for a specific date (MM-DD)
export async function getDailyReflection(dateStr: string): Promise<Passage | null> {
  await loadCorpus();
  
  // Find reflection
  const drs = passagesCache.filter(p => p.sourceId === 'daily-reflections');
  const exactMatch = drs.find(p => p.date === dateStr);
  if (exactMatch) {
    return exactMatch;
  }

  // Graceful fallback: If exact date is not loaded (e.g. some intermediate date in the MVP list),
  // return the closest previous or next available reflection, or a beautiful standard reflection.
  if (drs.length > 0) {
    // Parse target date
    const [targetMonth, targetDay] = dateStr.split('-').map(Number);
    
    // Sort drs by date
    const sortedDrs = [...drs].sort((a, b) => {
      const [am, ad] = (a.date || '01-01').split('-').map(Number);
      const [bm, bd] = (b.date || '01-01').split('-').map(Number);
      return (am * 50 + ad) - (bm * 50 + bd);
    });

    // Find closest previous reflection
    let closest = sortedDrs[0];
    let minDiff = Infinity;
    
    for (const dr of sortedDrs) {
      const [m, d] = (dr.date || '01-01').split('-').map(Number);
      const diff = Math.abs((targetMonth * 50 + targetDay) - (m * 50 + d));
      if (diff < minDiff) {
        minDiff = diff;
        closest = dr;
      }
    }

    // Return the closest found reflection, but customize its date mapping so it shows as today!
    return {
      ...closest,
      date: dateStr,
      pageRef: formatDateLabel(dateStr),
    };
  }

  return null;
}

// Helper to format date label (e.g., "06-28" to "Jun 28")
export function formatDateLabel(dateStr: string): string {
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];
  const [mStr, dStr] = dateStr.split('-');
  const monthIdx = parseInt(mStr, 10) - 1;
  const dayNum = parseInt(dStr, 10);
  
  if (monthIdx >= 0 && monthIdx < 12) {
    return `${months[monthIdx]} ${dayNum}`;
  }
  return dateStr;
}

export function getMonthName(dateStr: string): string {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const [mStr] = dateStr.split('-');
  const monthIdx = parseInt(mStr, 10) - 1;
  return months[monthIdx] || '';
}

// Helper to interpolate external templates
export function interpolateLink(template: string, data: Record<string, string>): string {
  let url = template;
  for (const key of Object.keys(data)) {
    url = url.replace(new RegExp(`{{${key}}}`, 'g'), data[key]);
  }
  return url;
}
