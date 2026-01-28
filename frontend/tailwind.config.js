/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        sage: {
          50: "#F2F7F5",
          100: "#E1EBE6",
          200: "#C4D9CF",
          300: "#A2C2B3",
          400: "#7E9C8F",
          500: "#5F8273",
          600: "#4A665A",
          700: "#3D5249",
          800: "#33423C",
          900: "#2B3632"
        },
        sand: {
          50: "#FAF9F6",
          100: "#F3F0EB",
          200: "#E8DCCA",
          300: "#D6C0A6",
          400: "#C4A485",
          500: "#B08968",
          600: "#8D6E53",
          700: "#6B533F",
          800: "#4A3A2C",
          900: "#2B2119"
        },
        clay: {
          50: "#FFF5F3",
          100: "#FFE8E3",
          200: "#FFD1C7",
          300: "#FFB5A7",
          400: "#FF8E7A",
          500: "#F2644C",
          600: "#D9452D",
          700: "#B3301B",
          800: "#8C2515",
          900: "#6B1C10"
        },
        background: "#FDFBF7",
        foreground: "#2D3748"
      },
      fontFamily: {
        heading: ['Manrope', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
        accent: ['Caveat', 'cursive']
      },
      borderRadius: {
        lg: "2rem",
        md: "1.5rem",
        sm: "1rem"
      },
      animation: {
        'float': 'float 6s ease-in-out infinite',
        'bloom': 'bloom 0.5s cubic-bezier(0.25,1,0.5,1) forwards'
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-20px)' }
        },
        bloom: {
          '0%': { transform: 'scale(0.8)', opacity: '0' },
          '50%': { transform: 'scale(1.1)' },
          '100%': { transform: 'scale(1)', opacity: '1' }
        }
      }
    },
  },
  plugins: [],
}