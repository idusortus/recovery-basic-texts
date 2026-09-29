// See https://svelte.dev/docs/kit/types#app for the App namespace contract.
//
// Cloudflare Pages bindings/vars arrive on `event.platform.env`. The adapter
// declares `context`, `caches`, and `cf`; we add the `env` shape this app reads
// so `event.platform?.env?.FEEDBACK_RATE_LIMIT` (and the secret names) are
// type-checked rather than `any`.
//
// `KVNamespace` is not in scope by default here: `@cloudflare/workers-types`
// is a transitive dependency of the adapter, not a direct one, so its globals
// are not loaded into the program. The minimal structural declaration below
// covers the methods this app calls (`get`, `put`) and merges cleanly with the
// full Cloudflare interface if workers types are ever added to the project.
declare global {
	interface KVNamespace<Key extends string = string> {
		get(key: Key): Promise<string | null>;
		put(
			key: Key,
			value: string,
			options?: { expiration?: number; expirationTtl?: number }
		): Promise<void>;
	}

	namespace App {
		interface Platform {
			env?: {
				FEEDBACK_RATE_LIMIT?: KVNamespace;
				PUBLIC_TURNSTILE_SITE_KEY?: string;
				TURNSTILE_SECRET_KEY?: string;
				TURNSTILE_HOSTNAMES?: string;
				GITHUB_TOKEN?: string;
			};
		}
	}
}

export {};
