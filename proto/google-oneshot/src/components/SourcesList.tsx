import React from 'react';
import { Landmark, ExternalLink, ShieldCheck, HelpCircle, AlertCircle, ShoppingCart } from 'lucide-react';
import { Source } from '../utils/search';

interface SourcesListProps {
  sources: Source[];
}

export default function SourcesList({ sources }: SourcesListProps) {
  return (
    <div id="sources-view" className="max-w-4xl mx-auto px-4 py-8 space-y-8 animate-fade-in">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="font-serif text-3xl font-semibold tracking-tight text-[#2C4A6E] dark:text-slate-50">
          Indexed Literature & External Directory
        </h1>
        <p className="text-stone-500 dark:text-slate-400 text-sm sm:text-base leading-relaxed">
          At basictexts.org, we support and trust the Alcoholics Anonymous service structure. Below is a detailed catalog of the indexed works, their copyright status, how we display search results for each, and where you can buy print versions or read official digital copies.
        </p>
      </div>

      {/* Sources list */}
      <div className="grid gap-6">
        {sources.map(source => (
          <div
            id={`source-card-${source.id}`}
            key={source.id}
            className="bg-white dark:bg-slate-900/30 rounded border border-stone-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col md:flex-row"
          >
            {/* Color Accent Indicator bar on top (mobile) or left (desktop) */}
            <div
              className="h-2 md:h-auto md:w-3 flex-shrink-0"
              style={{ backgroundColor: source.color }}
            />

            <div className="p-6 flex-grow space-y-4">
              {/* Header Info */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h2 className="font-serif font-bold text-lg text-stone-900 dark:text-slate-100">
                      {source.title}
                    </h2>
                    <span
                      className="text-[10px] font-mono px-1.5 py-0.5 rounded-sm font-semibold text-white uppercase shadow-sm"
                      style={{ backgroundColor: source.color }}
                    >
                      {source.shortTitle}
                    </span>
                  </div>
                  <p className="text-stone-600 dark:text-slate-300 text-sm">
                    {source.description}
                  </p>
                </div>
              </div>

              {/* Display & Legal rules details */}
              <div className="grid sm:grid-cols-2 gap-4 pt-2 border-t border-stone-100 dark:border-slate-800/60 text-xs">
                {/* Copyright status info */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 font-medium text-stone-800 dark:text-slate-200">
                    <ShieldCheck className="w-4 h-4 text-[#2C4A6E] dark:text-slate-400" />
                    <span>Legal Status & License</span>
                  </div>
                  <p className="text-stone-500 dark:text-slate-400 leading-normal pl-5">
                    {source.copyright === 'public-domain' ? (
                      <span className="text-emerald-700 dark:text-emerald-400 font-medium">
                        Public Domain. Full text indexed and fully shown within search results.
                      </span>
                    ) : (
                      <span className="text-stone-600 dark:text-slate-400">
                        Copyright protected. Displayed concordance-only or in short Fair Use snippets.
                      </span>
                    )}
                  </p>
                </div>

                {/* Search result display mode info */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 font-medium text-stone-800 dark:text-slate-200">
                    <HelpCircle className="w-4 h-4 text-[#2C4A6E] dark:text-slate-400" />
                    <span>Display Mode</span>
                  </div>
                  <p className="text-stone-500 dark:text-slate-400 leading-normal pl-5">
                    {source.displayMode === 'full-text' && (
                      <span><strong>Full Text:</strong> Search matches show the complete paragraph or sentence.</span>
                    )}
                    {source.displayMode === 'snippet' && (
                      <span><strong>Snippet:</strong> Matches show a slightly condensed summary or quote with source labels.</span>
                    )}
                    {source.displayMode === 'concordance-only' && (
                      <span><strong>Concordance:</strong> Matches show only ~{source.contextWords} words each side of the term. Deep link connects directly to official texts to read the full context.</span>
                    )}
                  </p>
                </div>
              </div>

              {/* Reference Links / Forwarding */}
              <div className="flex flex-wrap gap-3 pt-3 border-t border-stone-100 dark:border-slate-800/60">
                {source.officialUrl && (
                  <a
                    id={`buy-link-${source.id}`}
                    href={source.officialUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-xs font-semibold bg-stone-100 hover:bg-stone-250 dark:bg-slate-800 dark:hover:bg-slate-700 text-stone-800 dark:text-slate-200 border border-stone-200 dark:border-slate-700 transition-colors"
                  >
                    <ShoppingCart className="w-3.5 h-3.5 text-stone-600 dark:text-slate-400" />
                    Buy Official Print Edition
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}

                {source.freeUrl && (
                  <a
                    id={`free-link-${source.id}`}
                    href={source.freeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-xs font-semibold bg-[#FFF4DC] hover:bg-[#FFF4DC]/85 text-[#C8902A] border border-[#C8902A]/20 transition-colors"
                  >
                    Read Free Official Copy
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Curated Resources Header */}
      <div className="pt-8 border-t border-stone-200 dark:border-slate-800 space-y-4">
        <h2 className="font-serif font-semibold text-xl text-[#2C4A6E] dark:text-slate-100">
          Curated Free Recovery Archives
        </h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <a
            id="resource-aa-site"
            href="https://www.aa.org"
            target="_blank"
            rel="noopener noreferrer"
            className="p-4 bg-white dark:bg-slate-900/10 border border-stone-200 dark:border-slate-800 hover:border-amber-500/40 dark:hover:border-amber-500/40 rounded flex items-start gap-3 transition-all"
          >
            <div className="p-2 bg-stone-100 dark:bg-slate-800 rounded-sm text-[#2C4A6E] dark:text-slate-300">
              <Landmark className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-medium text-sm text-stone-900 dark:text-slate-200 flex items-center gap-1">
                Official AA Website
                <ExternalLink className="w-3.5 h-3.5" />
              </h3>
              <p className="text-xs text-stone-500 dark:text-slate-400 leading-normal mt-0.5">
                Visit aa.org to find local meetings, brochures, official pamphlets, audio recordings, and AA guidelines globally.
              </p>
            </div>
          </a>

          <a
            id="resource-silkworth"
            href="https://www.silkworth.net"
            target="_blank"
            rel="noopener noreferrer"
            className="p-4 bg-white dark:bg-slate-900/10 border border-stone-200 dark:border-slate-800 hover:border-amber-500/40 dark:hover:border-amber-500/40 rounded flex items-start gap-3 transition-all"
          >
            <div className="p-2 bg-stone-100 dark:bg-slate-800 rounded-sm text-[#2C4A6E] dark:text-slate-300">
              <Landmark className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-medium text-sm text-stone-900 dark:text-slate-200 flex items-center gap-1">
                Silkworth.net Archive
                <ExternalLink className="w-3.5 h-3.5" />
              </h3>
              <p className="text-xs text-stone-500 dark:text-slate-400 leading-normal mt-0.5">
                A massive, historic archive covering Dr. William D. Silkworth's papers, early AA letters, and historic fellowship documentation.
              </p>
            </div>
          </a>
        </div>
      </div>
    </div>
  );
}
