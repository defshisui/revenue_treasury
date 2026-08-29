import { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

export function ThemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {

  const [theme, setTheme] = useState<Theme>(() => {

    const savedTheme = localStorage.getItem("theme");

    return savedTheme === "dark"
      ? "dark"
      : "light";

  });

  useEffect(() => {

    const html = document.documentElement;

    if (theme === "dark") {
      html.classList.add("dark");
    } 
    else {
      html.classList.remove("dark");
    }

    localStorage.setItem(
      "theme",
      theme
    );

  }, [theme]);

  function toggleTheme() {

    setTheme(current =>
      current === "light"
        ? "dark"
        : "light"
    );

  }

  return (

    <ThemeContext.Provider
      value={{
        theme,
        toggleTheme,
      }}
    >

      {children}

    </ThemeContext.Provider>

  );

}

export function useTheme() {

  const context = useContext(ThemeContext);

  if (!context) {

    throw new Error(
      "useTheme must be inside ThemeProvider"
    );

  }

  return context;

}
