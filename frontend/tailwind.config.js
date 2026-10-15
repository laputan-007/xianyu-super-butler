/** @type {import('tailwindcss').Config} */

// 这里刻意**覆盖** Tailwind 的默认取值，而不是去改组件里的类名：
// 全站有 395 处 rounded-md、130+ 处 bg-gray-*，逐处替换既容易漏又难回退。
// 把 md 圆角调大、把 gray 色阶换成暖调，所有组件一次到位。
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // 品牌色阶全部走 CSS 变量：[data-brand] 属性切换主题色
        // （yellow/sky/jade/royal/coral/violet/rose），不用重编译。
        // DEFAULT 与 300 用 rgb 三元组变量，支持 bg-brand/60 这类透明度修饰符。
        brand: {
          DEFAULT: 'rgb(var(--brand-rgb) / <alpha-value>)',
          50: 'var(--brand-50)',
          100: 'var(--brand-100)',
          200: 'var(--brand-200)',
          300: 'rgb(var(--brand-300-rgb) / <alpha-value>)',
          400: 'rgb(var(--brand-rgb) / <alpha-value>)',
          500: 'var(--brand-hover)',
          600: 'var(--brand-active)',
          700: 'var(--brand-700)',
          800: 'var(--brand-800)',
          900: 'var(--brand-900)',
          ink: 'var(--brand-ink)',
        },
        // 中性色阶：只带极轻微的暖调，避免和黄色强调元素冲突。
        // 不做成黄色系 —— 全站 130+ 处 bg-gray-* 一旦变黄会让整页发闷。
        gray: {
          50: 'rgb(var(--gray-50) / <alpha-value>)',
          100: 'rgb(var(--gray-100) / <alpha-value>)',
          200: 'rgb(var(--gray-200) / <alpha-value>)',
          300: 'rgb(var(--gray-300) / <alpha-value>)',
          400: 'rgb(var(--gray-400) / <alpha-value>)',
          500: 'rgb(var(--gray-500) / <alpha-value>)',
          600: 'rgb(var(--gray-600) / <alpha-value>)',
          700: 'rgb(var(--gray-700) / <alpha-value>)',
          800: 'rgb(var(--gray-800) / <alpha-value>)',
          900: 'rgb(var(--gray-900) / <alpha-value>)',
        },
      },
      borderRadius: {
        // 覆盖默认值：DEFAULT 4px→8px、md 6px→10px、lg 8px→16px、xl 12px→20px
        DEFAULT: '8px',
        sm: '6px',
        md: '10px',
        lg: '16px',
        xl: '20px',
        '2xl': '24px',
        '3xl': '32px',
      },
      boxShadow: {
        brand: '0 6px 18px rgb(var(--brand-rgb) / 0.35)',
        'brand-lg': '0 10px 28px rgb(var(--brand-rgb) / 0.45)',
        soft: '0 1px 2px rgba(122, 96, 20, 0.06)',
        card: '0 6px 20px rgba(122, 96, 20, 0.10)',
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"PingFang SC"',
          '"Hiragino Sans GB"',
          '"Microsoft YaHei"',
          '"Helvetica Neue"',
          'Helvetica',
          'Arial',
          'sans-serif',
        ],
      },
    },
  },
  plugins: [],
}
