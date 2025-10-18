import React, { createContext, useContext, useMemo, useState } from 'react';

const ThemeContext = createContext({ theme: 'light', toggleTheme: () => {}, isDark: false });

export function ThemeProvider({ children, value }) {
  // Allow tests to pass a mocked value; otherwise manage simple local state
  const [theme, setTheme] = useState(value?.theme ?? 'light');
  const ctx = useMemo(() => ({
    theme,
    toggleTheme: () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')),
    isDark: theme === 'dark',
    ...(value || {})
  }), [theme, value]);

  return <ThemeContext.Provider value={ctx}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}

export default ThemeContext;
