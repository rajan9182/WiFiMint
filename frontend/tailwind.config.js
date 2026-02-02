/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                background: "#0f172a", // Slate 900
                surface: "#1e293b",    // Slate 800
                primary: "#6366f1",    // Indigo 500
                secondary: "#ec4899",  // Pink 500
            }
        },
    },
    plugins: [],
}
