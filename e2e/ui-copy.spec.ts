import { expect, test } from '@playwright/test';
import { BB_TORNADO_URL, waitForPassage } from './helpers';

/**
 * remove-em-dashes-from-ui-copy task 4.2 — visitor-visible chrome carries no
 * em dash (U+2014).
 *
 * Spec: ui-copy / "Rendered page copy has no em dash" and "Metadata and
 * accessible names have no em dash".
 *
 * Scope: `document.title` plus app-authored chrome — headings, control labels,
 * links, accessible names/titles, and status/alert regions — across the
 * deterministic static routes and a passage page. Corpus-derived text is
 * deliberately excluded: `/sources` renders registry `description` copy (and a
 * passage renders body text), and both may legitimately contain em dashes as
 * third-party source text. The source scan in `scripts/test-ui-copy.mjs` guards
 * the app-authored strings that a static route sweep cannot reach.
 */
const EM_DASH = '\u2014';

const STATIC_ROUTES = ['/', '/about', '/sources', '/topics', '/feedback'];

// App-authored chrome only. Corpus body copy renders in plain <p> elements,
// which this selector set intentionally omits.
const CHROME_SELECTOR =
	'h1, h2, h3, button, a, [aria-label], [title], [role="status"], [role="alert"], [role="note"]';

async function collectChromeStrings(page: import('@playwright/test').Page): Promise<string[]> {
	return page.locator(CHROME_SELECTOR).evaluateAll((els) =>
		els.flatMap((el) => {
			// The passage page's chapter nav renders corpus-derived chapterRef /
			// title text, which is third-party copy and may legitimately contain an
			// em dash. Skip anything inside it.
			if (el.closest('nav[aria-label="Chapter navigation"]')) return [];
			const out: string[] = [];
			const text = (el.textContent ?? '').trim();
			if (text) out.push(text);
			const aria = el.getAttribute('aria-label');
			if (aria) out.push(aria);
			const title = el.getAttribute('title');
			if (title) out.push(title);
			return out;
		})
	);
}

for (const route of STATIC_ROUTES) {
	test(`static route ${route} has no em dash in title or chrome`, async ({ page }) => {
		await page.goto(route);
		await expect(page.locator('main')).toBeVisible();

		expect(await page.title(), `${route} document.title`).not.toContain(EM_DASH);

		for (const value of await collectChromeStrings(page)) {
			expect(value, `${route} chrome`).not.toContain(EM_DASH);
		}
	});
}

test('passage page chrome has no em dash (body text excluded)', async ({ page }) => {
	await page.goto(BB_TORNADO_URL);
	await waitForPassage(page, 'big-book-2ed-chapter-6-into-action-p0142');

	expect(await page.title(), 'passage document.title').not.toContain(EM_DASH);

	for (const value of await collectChromeStrings(page)) {
		expect(value, 'passage chrome').not.toContain(EM_DASH);
	}

	// The citation header is app-authored (source label + separator) assembled
	// with a corpus-derived chapter label. Only the app-authored separator is
	// asserted: it must be ": " and the source label before it must carry no em
	// dash (the corpus chapter label after it may legitimately contain one).
	const citationHeader = page.locator('main article p.font-serif').first();
	await expect(citationHeader).toBeVisible();
	const headerText = await citationHeader.innerText();
	const separatorIndex = headerText.indexOf(': ');
	expect(separatorIndex, 'citation header uses ": " separator').toBeGreaterThan(0);
	expect(headerText.slice(0, separatorIndex), 'citation header source label').not.toContain(
		EM_DASH
	);
});
