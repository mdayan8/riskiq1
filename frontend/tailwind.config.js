/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#0B1F3A", // deep navy
          light: "#1A365D",
          dark: "#051024",
        },
        accent: {
          DEFAULT: "#2E6CF6",
          hover: "#1D4ED8",
        },
        background: {
          DEFAULT: "#F5F7FA",
          card: "#FFFFFF",
        },
        sidebar: {
          DEFAULT: "#0B1F3A",
          hover: "#172A46",
          active: "#2E6CF6",
        },
        success: {
          DEFAULT: "#16C784",
          light: "#D1F4E6",
        },
        warning: {
          DEFAULT: "#FFB020",
          light: "#FFF4D2",
        },
        error: {
          DEFAULT: "#FF4D4F",
          light: "#FFE5E5",
        }
      },
      fontFamily: {
        sans: ["Inter", "SF Pro", "system-ui", "sans-serif"],
      },
      boxShadow: {
        'soft': '0 4px 20px -2px rgba(0, 0, 0, 0.05)',
        'glass': '0 8px 32px 0 rgba(31, 38, 135, 0.07)',
      },
      animation: {
        'progress': 'progress 2s ease-in-out infinite',
      },
      keyframes: {
        progress: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        }
      }
    }
  },
  plugins: []
};
