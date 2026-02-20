/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    darkMode: 'class',
    theme: {
        extend: {
            colors: {
                // Map Tailwind colors to our Dynamic Theme Variables
                cyan: {
                    50: 'var(--theme-primary-50)',
                    100: 'var(--theme-primary-100)',
                    200: 'var(--theme-primary-200)',
                    300: 'var(--theme-primary-300)',
                    400: 'var(--theme-primary-400)',
                    500: 'var(--theme-primary-500)',
                    600: 'var(--theme-primary-600)',
                    700: 'var(--theme-primary-700)',
                    800: 'var(--theme-primary-800)',
                    900: 'var(--theme-primary-900)',
                    950: 'var(--theme-primary-950)',
                },
                pink: {
                    50: 'var(--theme-accent-50)',
                    100: 'var(--theme-accent-100)',
                    200: 'var(--theme-accent-200)',
                    300: 'var(--theme-accent-300)',
                    400: 'var(--theme-accent-400)',
                    500: 'var(--theme-accent-500)',
                    600: 'var(--theme-accent-600)',
                    700: 'var(--theme-accent-700)',
                    800: 'var(--theme-accent-800)',
                    900: 'var(--theme-accent-900)',
                    950: 'var(--theme-accent-950)',
                },
                slate: {
                    50: 'var(--theme-base-50)',
                    100: 'var(--theme-base-100)',
                    200: 'var(--theme-base-200)',
                    300: 'var(--theme-base-300)',
                    400: 'var(--theme-base-400)',
                    500: 'var(--theme-base-500)',
                    600: 'var(--theme-base-600)',
                    700: 'var(--theme-base-700)',
                    800: 'var(--theme-base-800)',
                    900: 'var(--theme-base-900)',
                    950: 'var(--theme-base-950)',
                },
                // Keep the example primary if needed, or remove
                primary: {
                    50: 'var(--theme-primary-50)',
                    100: 'var(--theme-primary-100)',
                    500: 'var(--theme-primary-500)',
                    600: 'var(--theme-primary-600)',
                    900: 'var(--theme-primary-900)',
                }
            },
            fontFamily: {
                sans: ['Inter', 'sans-serif'],
            }
        },
    },
    plugins: [],
}
