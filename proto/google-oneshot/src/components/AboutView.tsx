import React from 'react';
import { Landmark, Shield, Github, Mail, BookOpen, ExternalLink, HelpCircle } from 'lucide-react';

export default function AboutView() {
  const faqs = [
    {
      q: "What is basictexts.org?",
      a: "basictexts.org is a free, fast, open-source literature concordance designed to help members of Alcoholics Anonymous, newcomers, and sponsors find specific passages quickly during meetings, sponsorship work, or personal study. It is optimized to run completely offline as an installable PWA."
    },
    {
      q: "How does the Concordance search work?",
      a: "For public domain literature (like the 1st Edition of the Big Book), we display the full text. For copyrighted literature (like Daily Reflections), the application strictly functions as a concordance-only index: we display the keyword with a short surrounding window of context (~8 words on each side) and provide a direct link to read the full text officially on aa.org. We do not host or display full copies of copyrighted works."
    },
    {
      q: "Is this app affiliated with Alcoholics Anonymous World Services (AAWS)?",
      a: "No. basictexts.org is completely independent, non-commercial, and is not affiliated with, endorsed by, or approved by Alcoholics Anonymous World Services, Inc., the AA Grapevine, or any other recovery service entity. We run no ads, sell no books, and collect no personal information."
    },
    {
      q: "How can I install it offline?",
      a: "On modern browsers (Chrome/Edge on Desktop, Chrome on Android, Safari on iOS), click your browser's options or share sheet and select 'Add to Home Screen' or 'Install App'. Once installed, the entire application shell and full search index are cached on your device, allowing you to use the tool in basements, planes, or remote meeting spaces without internet access."
    }
  ];

  return (
    <div id="about-view" className="max-w-4xl mx-auto px-4 py-8 space-y-12 animate-fade-in">
      {/* Hero Section */}
      <div className="text-center space-y-3">
        <h1 className="font-serif text-3xl sm:text-4xl font-semibold tracking-tight text-[#2C4A6E] dark:text-slate-50">
          About basictexts.org
        </h1>
        <p className="text-stone-500 dark:text-slate-400 max-w-xl mx-auto text-sm sm:text-base">
          A modern, offline-first literature concordance and reference tool for Alcoholics Anonymous.
        </p>
      </div>

      {/* Philosophy Grid */}
      <div className="grid md:grid-cols-2 gap-6">
        <div id="about-purpose-card" className="p-6 bg-white dark:bg-slate-900/40 rounded border border-stone-200 dark:border-slate-800 shadow-sm space-y-3">
          <div className="flex items-center gap-2 text-[#2C4A6E] dark:text-amber-500">
            <BookOpen className="w-5 h-5 text-[#C8902A]" />
            <h2 className="font-serif font-semibold text-lg">Our Purpose</h2>
          </div>
          <p className="text-stone-600 dark:text-slate-300 text-sm leading-relaxed">
            Finding recovery literature when you need it shouldn't require carrying heavy volumes, navigating outdated websites, or paying subscription fees. basictexts.org is created to serve the fellowship by providing an instant, clean, mobile-first index of our basic texts. Every search drives traffic back to official AA purchase portals or free official versions to respect the service structure.
          </p>
        </div>

        <div id="about-copyright-card" className="p-6 bg-white dark:bg-slate-900/40 rounded border border-stone-200 dark:border-slate-800 shadow-sm space-y-3">
          <div className="flex items-center gap-2 text-[#2C4A6E] dark:text-amber-500">
            <Shield className="w-5 h-5 text-[#C8902A]" />
            <h2 className="font-serif font-semibold text-lg">Copyright & Fair Use</h2>
          </div>
          <p className="text-stone-600 dark:text-slate-300 text-sm leading-relaxed">
            We are committed to respecting copyright laws. The first edition of the Big Book of Alcoholics Anonymous (originally published in 1939) is in the public domain under US law. For copyrighted texts, we strictly display context-clipped snippets matching the search terms (Fair Use Concordance). We always encourage buying official books to support AA's central services.
          </p>
        </div>
      </div>

      {/* FAQs */}
      <div id="about-faqs" className="space-y-6">
        <div className="flex items-center gap-2 border-b border-stone-200 dark:border-slate-800 pb-2">
          <HelpCircle className="w-5 h-5 text-[#2C4A6E] dark:text-amber-500" />
          <h2 className="font-serif font-semibold text-xl text-stone-900 dark:text-slate-50">
            Frequently Asked Questions
          </h2>
        </div>
        <div className="grid gap-6">
          {faqs.map((faq, i) => (
            <div key={i} className="space-y-1.5">
              <h3 className="font-medium text-stone-900 dark:text-slate-100 text-sm sm:text-base">
                {faq.q}
              </h3>
              <p className="text-stone-600 dark:text-slate-300 text-sm leading-relaxed">
                {faq.a}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Disclaimers (mirroring 164andMore) */}
      <div id="about-disclaimers" className="p-6 bg-[#FFF4DC]/20 dark:bg-slate-950/40 rounded border border-[#C8902A]/20 dark:border-slate-800/65 space-y-3">
        <h2 className="font-serif font-semibold text-base text-[#C8902A]">
          Legal Disclaimers
        </h2>
        <div className="text-xs text-stone-500 dark:text-slate-400 space-y-2 leading-relaxed font-mono">
          <p>
            ALCOHOLICS ANONYMOUS®, AA®, THE BIG BOOK® are registered trademarks of Alcoholics Anonymous World Services, Inc.
          </p>
          <p>
            DAILY REFLECTIONS® is a registered trademark of AA Grapevine, Inc.
          </p>
          <p>
            The references and clipped index outputs provided on basictexts.org are for private study, scholarship, or research purposes under the Fair Use provisions of United States copyright law (17 U.S.C. Section 107). No text provided on this service should be considered as a replacement for acquiring the original official editions published by AAWS or AA Grapevine.
          </p>
        </div>
      </div>

      {/* Open Source Statement */}
      <div id="about-open-source" className="text-center space-y-4 border-t border-stone-200 dark:border-slate-800 pt-8">
        <div className="inline-flex items-center gap-2 bg-stone-100 dark:bg-slate-900 text-stone-800 dark:text-slate-200 px-3 py-1.5 rounded-sm text-xs font-semibold">
          <Github className="w-4 h-4 text-[#2C4A6E]" />
          <span>Open Source Project</span>
        </div>
        <p className="text-stone-600 dark:text-slate-400 text-sm max-w-lg mx-auto leading-relaxed">
          basictexts.org is licensed under the highly permissive MIT License. The code is public, open-source, and available on GitHub for community contributions, corrections, and translations.
        </p>
        <div className="flex justify-center gap-4">
          <a
            id="github-link"
            href="https://github.com/owner/basictexts"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-medium text-[#2C4A6E] hover:text-[#2C4A6E]/80 dark:text-amber-500 dark:hover:text-amber-400 focus:outline-none focus:underline"
          >
            Browse Code on GitHub
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
          <span className="text-stone-300 dark:text-slate-800">|</span>
          <a
            id="email-link"
            href="mailto:contact@basictexts.org"
            className="inline-flex items-center gap-1 text-xs font-medium text-[#2C4A6E] hover:text-[#2C4A6E]/80 dark:text-amber-500 dark:hover:text-amber-400 focus:outline-none focus:underline"
          >
            Contact / Support
            <Mail className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
}
