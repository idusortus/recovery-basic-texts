import type { Config } from 'tailwindcss';

const config: Config = {
	darkMode: 'class',
	content: ['./src/**/*.{html,js,svelte,ts}'],
	theme: {
		extend: {
			colors: {
				// Light mode
				parchment: '#F8F7F4',
				navy: '#2C4A6E',
				gold: '#C8902A',
				highlight: '#FFF4DC',
				// These augment Tailwind's built-in slate/stone/amber palettes
			},
			fontFamily: {
				serif: ['Lora', 'Georgia', 'Cambria', 'serif'],
				sans: ['Inter', 'system-ui', 'sans-serif']
			},
			borderRadius: {
				DEFAULT: '4px'
			},
			keyframes: {
				'fade-in': {
					from: { opacity: '0', transform: 'translateY(4px)' },
					to: { opacity: '1', transform: 'translateY(0)' }
				}
			},
			animation: {
				'fade-in': 'fade-in 0.2s ease-out both'
			}
		}
	},
	plugins: []
};

export default config;
