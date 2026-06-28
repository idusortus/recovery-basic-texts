import React from 'react';
import { BookOpen, Search, ArrowRight } from 'lucide-react';

interface BrowseTopicsProps {
  onSelectTopic: (topic: string) => void;
}

export default function BrowseTopics({ onSelectTopic }: BrowseTopicsProps) {
  // 164andMore's top 10 as a starting point
  const primaryTopics = [
    'Acceptance',
    'Resentment',
    'Fear',
    'Gratitude',
    'Humility',
    'God',
    'Honesty',
    'Anger',
    'Ego',
    'Self'
  ];

  // Extended vocabulary of recovery themes sorted alphabetically
  const alphabeticalThemes = {
    'A': ['Abstinence', 'Acceptance', 'Action', 'Admit', 'Alibis', 'Amends', 'Anger', 'Anonymity', 'Apathy', 'Awakening'],
    'B': ['Balance', 'Belief', 'Bill W', 'Blame', 'Blindness', 'Boredom', 'Bottles', 'Brain', 'Brothers', 'Burden'],
    'C': ['Calamity', 'Candidate', 'Care', 'Certainty', 'Character', 'Cling', 'Commitment', 'Compassion', 'Conscience', 'Courage'],
    'D': ['Daily Review', 'Defects', 'Decision', 'Defeat', 'Delusion', 'Desire', 'Despair', 'Dishonesty', 'Disorder', 'Dr Bob'],
    'E': ['Ego', 'Emotions', 'Employers', 'Empathy', 'Endurance', 'Envy', 'Escapism', 'Excuses', 'Expectations', 'Experience'],
    'F': ['Faith', 'Family', 'Fellowship', 'Faults', 'Fear', 'Fighting', 'First Edition', 'Forgiveness', 'Freedom', 'Frustration'],
    'G': ['Gentleness', 'God', 'Goodwill', 'Gossip', 'Grudge', 'Grace', 'Gratitude', 'Grief', 'Group', 'Growth'],
    'H': ['Habits', 'Half-measures', 'Happiness', 'Harm', 'Harmony', 'Health', 'Higher Power', 'Honesty', 'Hope', 'Humility'],
    'I': ['Illness', 'Illusions', 'Immunity', 'Insecurity', 'Insanity', 'Instincts', 'Integrity', 'Intolerance', 'Inventory', 'Isolation'],
    'J': ['Jaywalker', 'Jealousy', 'Jim', 'Job', 'Joy', 'Judgment', 'Justice', 'Justification'],
    'K': ['Kindness', 'Knowledge', 'Kinship'],
    'L': ['Lapses', 'Leaders', 'Lies', 'Listening', 'List', 'Literature', 'Loneliness', 'Love', 'Loyalty', 'Lust'],
    'M': ['Maintenance', 'Malady', 'Master', 'Meditation', 'Meeting', 'Membership', 'Mind', 'Miracle', 'Misery', 'Motives'],
    'N': ['Neighborhood', 'Neutrality', 'Newcomer', 'Night review', 'Ninth Step', 'Nonprofessional'],
    'O': ['Obsession', 'Open-minded', 'Opinions', 'Order', 'Organization', 'Outgrowth', 'Outside issues'],
    'P': ['Pain', 'Patience', 'Peace', 'Penance', 'Personality', 'Phonies', 'Pioneers', 'Play', 'Powerless', 'Prayer', 'Prejudice', 'Pride', 'Principles', 'Promises', 'Purpose'],
    'Q': ['Quality', 'Quarrels', 'Quiet', 'Quotes'],
    'R': ['Rebellion', 'Recoil', 'Recovery', 'Regret', 'Relationship', 'Release', 'Relief', 'Remorse', 'Reprieve', 'Resentment', 'Responsibility', 'Restitution', 'Rigorous honesty', 'Ruins'],
    'S': ['Sanity', 'Searching', 'Secrets', 'Self-centered', 'Self-will', 'Serenity', 'Service', 'Shortcomings', 'Silkworth', 'Sincerity', 'Slip', 'Sobriety', 'Sponsorship', 'Spiritual', 'Struggle', 'Surrender'],
    'T': ['Temper', 'Thinking', 'Tolerance', 'Traditions', 'Trudge', 'Truth', 'Twelve Steps', 'Twelve Traditions'],
    'U': ['Understanding', 'Unity', 'Unmanageable', 'Uselessness'],
    'V': ['Values', 'Vanity', 'Vengeance', 'Victim', 'Victory', 'Vigilance', 'Virtue', 'Vision'],
    'W': ['Waking', 'Wanderer', 'Weakness', 'Welfare', 'Whiskey', 'Willpower', 'Willingness', 'Wisdom', 'Wives', 'Wrongs'],
    'Y': ['Yesterday', 'Youth']
  };

  return (
    <div id="topics-view" className="max-w-5xl mx-auto px-4 py-8 space-y-10 animate-fade-in">
      {/* Page Title */}
      <div className="text-center space-y-2">
        <h1 className="font-serif text-3xl font-semibold tracking-tight text-[#2C4A6E] dark:text-slate-50">
          Browse by Recovery Topic
        </h1>
        <p className="text-stone-500 dark:text-slate-400 text-sm sm:text-base max-w-xl mx-auto">
          Select any recovery concept or search term below to pre-populate and execute a comprehensive concordance search across all available texts.
        </p>
      </div>

      {/* Top 10 Highlighted bento box */}
      <div id="primary-topics-grid" className="bg-white dark:bg-slate-900/20 rounded p-6 border border-stone-200 dark:border-slate-800 space-y-4 shadow-sm">
        <h2 className="font-serif font-semibold text-lg text-[#2C4A6E] dark:text-amber-500 flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-[#C8902A]" />
          Quick-Access Common Topics
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {primaryTopics.map(topic => (
            <button
              id={`primary-topic-${topic.toLowerCase()}`}
              key={topic}
              onClick={() => onSelectTopic(topic)}
              className="flex items-center justify-between p-3 bg-white dark:bg-slate-900 hover:bg-[#FFF4DC]/40 dark:hover:bg-slate-800 border border-stone-200 dark:border-slate-800 rounded-sm text-left text-xs sm:text-sm font-medium text-stone-800 dark:text-slate-200 transition-all hover:scale-[1.01] hover:shadow-sm focus:outline-none hover:border-[#C8902A]/30 cursor-pointer"
            >
              <span className="hover:text-[#C8902A]">{topic}</span>
              <ArrowRight className="w-3.5 h-3.5 text-stone-400 dark:text-slate-600" />
            </button>
          ))}
        </div>
      </div>

      {/* Alphabetical A-Z Directory */}
      <div id="alphabetical-directory" className="space-y-6">
        <h2 className="font-serif font-semibold text-xl text-[#2C4A6E] dark:text-slate-100 border-b border-stone-200 dark:border-slate-800 pb-2 flex items-center gap-2">
          <span>A–Z Concordance Vocabulary</span>
        </h2>
        
        <div className="space-y-6">
          {Object.entries(alphabeticalThemes).map(([letter, terms]) => (
            <div
              id={`letter-group-${letter}`}
              key={letter}
              className="flex flex-col md:flex-row gap-2 md:gap-6 border-b border-stone-100 dark:border-slate-900/50 pb-4 last:border-0"
            >
              {/* Floating Letter Index */}
              <div className="w-8 h-8 flex items-center justify-center rounded-sm bg-white dark:bg-slate-900 border border-stone-250 font-serif font-bold text-[#2C4A6E] dark:text-slate-300 md:sticky md:top-20 shadow-sm">
                {letter}
              </div>
              
              {/* Word Chips list */}
              <div className="flex flex-wrap gap-2 flex-grow">
                {terms.map(term => (
                  <button
                    id={`topic-chip-${term.toLowerCase().replace(/\s+/g, '-')}`}
                    key={term}
                    onClick={() => onSelectTopic(term)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-xs font-medium bg-white dark:bg-slate-900 hover:bg-[#FFF4DC]/40 dark:hover:bg-slate-800 text-stone-700 dark:text-slate-300 border border-stone-200 dark:border-slate-800 transition-colors focus:outline-none hover:text-[#C8902A] hover:border-[#C8902A]/30 cursor-pointer"
                  >
                    <Search className="w-3 h-3 text-stone-400 dark:text-slate-600" />
                    {term}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
