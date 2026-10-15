import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react';

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';
/** 主题色预设：yellow 为默认（不设 data-brand 属性即黄色）。 */
export type BrandPreference = 'yellow' | 'sky' | 'jade' | 'royal' | 'coral' | 'violet' | 'rose';

export const BRAND_PREFERENCES: BrandPreference[] = [
  'yellow', 'sky', 'jade', 'royal', 'coral', 'violet', 'rose',
];

const THEME_STORAGE_KEY = 'xianyu-theme-preference';
const BRAND_STORAGE_KEY = 'xianyu-brand';
const DARK_MEDIA_QUERY = '(prefers-color-scheme: dark)';

interface ThemeContextValue {
  theme: ThemePreference;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: ThemePreference) => void;
  brand: BrandPreference;
  setBrand: (brand: BrandPreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const normalizeTheme = (value: string | null): ThemePreference => (
  value === 'light' || value === 'dark' || value === 'system' ? value : 'system'
);

const readStoredTheme = (): ThemePreference => {
  if (typeof window === 'undefined') return 'system';
  try {
    return normalizeTheme(window.localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return 'system';
  }
};

const normalizeBrand = (value: string | null): BrandPreference => (
  BRAND_PREFERENCES.includes(value as BrandPreference) ? (value as BrandPreference) : 'yellow'
);

const readStoredBrand = (): BrandPreference => {
  if (typeof window === 'undefined') return 'yellow';
  try {
    return normalizeBrand(window.localStorage.getItem(BRAND_STORAGE_KEY));
  } catch {
    return 'yellow';
  }
};

const readSystemTheme = (): ResolvedTheme => {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia(DARK_MEDIA_QUERY).matches ? 'dark' : 'light';
};

interface ThemeProviderProps {
  children: React.ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemePreference>(readStoredTheme);
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(readSystemTheme);
  const [brand, setBrandState] = useState<BrandPreference>(readStoredBrand);

  useEffect(() => {
    const media = window.matchMedia(DARK_MEDIA_QUERY);
    const handleChange = (event: MediaQueryListEvent) => {
      setSystemTheme(event.matches ? 'dark' : 'light');
    };

    setSystemTheme(media.matches ? 'dark' : 'light');
    media.addEventListener('change', handleChange);
    return () => media.removeEventListener('change', handleChange);
  }, []);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === THEME_STORAGE_KEY) {
        setThemeState(normalizeTheme(event.newValue));
      }
      if (event.key === BRAND_STORAGE_KEY) {
        setBrandState(normalizeBrand(event.newValue));
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const resolvedTheme = theme === 'system' ? systemTheme : theme;

  useLayoutEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = resolvedTheme;
    root.dataset.themePreference = theme;
    root.classList.toggle('dark', resolvedTheme === 'dark');
    root.style.colorScheme = resolvedTheme;
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // 存储被浏览器禁用时，主题仍在当前页面内正常生效。
    }
  }, [resolvedTheme, theme]);

  useLayoutEffect(() => {
    const root = document.documentElement;
    // yellow 是 :root 默认值，不落属性，减少一层选择器嵌套
    if (brand === 'yellow') {
      delete root.dataset.brand;
    } else {
      root.dataset.brand = brand;
    }
    try {
      window.localStorage.setItem(BRAND_STORAGE_KEY, brand);
    } catch {
      // 同上：存储禁用时本页仍生效
    }
  }, [brand]);

  const setTheme = useCallback((nextTheme: ThemePreference) => {
    setThemeState(nextTheme);
  }, []);

  const setBrand = useCallback((nextBrand: BrandPreference) => {
    setBrandState(nextBrand);
  }, []);

  const value = useMemo(
    () => ({ theme, resolvedTheme, setTheme, brand, setBrand }),
    [brand, resolvedTheme, setBrand, setTheme, theme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = (): ThemeContextValue => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used inside ThemeProvider');
  }
  return context;
};
