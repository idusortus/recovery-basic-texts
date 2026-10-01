/**
 * Browser text-to-speech helpers for the full-text passage page.
 *
 * Pure and import-free so a dependency-free Node script can import it directly
 * (the `url-state.ts` pattern). The component supplies the thin
 * `speechSynthesis` adapter; this module only decides support/gating and builds
 * the utterance text — it never performs I/O and never makes a network request.
 * Speech uses the browser's built-in engine; no data leaves the device.
 *
 * passage-reader-controls — Listen (text-to-speech)
 */

/** The minimal window surface {@link isTtsSupported} inspects. */
export interface TtsWindow {
	speechSynthesis?: object | null;
	SpeechSynthesisUtterance?: unknown;
}

/**
 * Whether the browser provides usable speech synthesis: both a
 * `speechSynthesis` object and a callable `SpeechSynthesisUtterance` constructor.
 * Evaluated against an injected window-like object so a dependency-free test can
 * cover graceful degradation (absent/missing/spoofed APIs) without a browser.
 */
export function isTtsSupported(win: TtsWindow | null | undefined): boolean {
	if (!win || typeof win !== 'object') return false;
	const synthesis = win.speechSynthesis;
	const Utterance = win.SpeechSynthesisUtterance;
	return (
		typeof synthesis === 'object' &&
		synthesis !== null &&
		typeof Utterance === 'function'
	);
}

/**
 * Gate the Listen affordance: offered only for `full-text` sources when speech
 * synthesis is supported. Encodes both guards in one testable place.
 */
export function canOfferListen(displayMode: string, supported: boolean): boolean {
	return displayMode === 'full-text' && supported === true;
}

/**
 * Join the rendered passage texts for speech: trims each entry, drops blanks,
 * and preserves render order. Fed only the text the `full-text` branch already
 * renders, so it cannot include protected or hidden content.
 */
export function buildSpeechText(passageTexts: Array<string | null | undefined>): string {
	return passageTexts
		.filter((text): text is string => typeof text === 'string')
		.map((text) => text.trim())
		.filter((text) => text.length > 0)
		.join('\n\n');
}

/** Collapse whitespace runs so a spoken chunk is a single clean line. */
function collapseWhitespace(text: string): string {
	return text.replace(/\s+/g, ' ').trim();
}

/** Hard-split a run that has no shorter boundary, preferring a space break. */
function hardSplit(run: string, maxChars: number): string[] {
	const parts: string[] = [];
	let rest = run;
	while (rest.length > maxChars) {
		let cut = rest.lastIndexOf(' ', maxChars);
		if (cut <= 0) cut = maxChars;
		parts.push(rest.slice(0, cut).trim());
		rest = rest.slice(cut).trim();
	}
	if (rest) parts.push(rest);
	return parts;
}

/**
 * Split speech text into chunks no longer than `maxChars`, preferring sentence
 * boundaries and falling back to a hard split for an overlong unbroken run
 * (some engines truncate a single very long utterance). Content is preserved up
 * to boundary whitespace: sentence-bounded chunks rejoin with a space, while a
 * hard-split run (which had no break at the cut) rejoins with no separator.
 */
export function splitSpeechChunks(text: string, maxChars = 200): string[] {
	const limit = Math.max(1, Math.floor(maxChars));
	const clean = collapseWhitespace(text);
	if (!clean) return [];

	const sentences = clean.match(/[^.!?]+[.!?]+["')\]]*|\S[^.!?]*$/g) ?? [clean];

	const chunks: string[] = [];
	let current = '';
	const flush = () => {
		if (current) {
			chunks.push(current);
			current = '';
		}
	};

	for (const raw of sentences) {
		const sentence = raw.trim();
		if (!sentence) continue;

		if (sentence.length > limit) {
			flush();
			const parts = hardSplit(sentence, limit);
			for (let i = 0; i < parts.length - 1; i++) chunks.push(parts[i]);
			current = parts[parts.length - 1] ?? '';
			continue;
		}

		if (!current) {
			current = sentence;
		} else if ((current + ' ' + sentence).length <= limit) {
			current += ' ' + sentence;
		} else {
			flush();
			current = sentence;
		}
	}
	flush();
	return chunks;
}
