"use client";

import {useEffect, useState} from "react";

type Theme = "light" | "dark";

const STORAGE_KEY = "canvas-theme";

function getThemeFromDocument(): Theme {
    if (typeof document === "undefined") return "light";
    const value = document.documentElement.getAttribute("data-theme");
    return value === "dark" ? "dark" : "light";
}

function applyTheme(theme: Theme) {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(STORAGE_KEY, theme);
    window.dispatchEvent(new CustomEvent("canvas-theme-change", {detail: theme}));
}

export function useTheme() {
    const [theme, setTheme] = useState<Theme>("light");

    useEffect(() => {
        setTheme(getThemeFromDocument());

        const onThemeChange = (event: Event) => {
            const customEvent = event as CustomEvent<Theme>;
            if (customEvent.detail === "dark" || customEvent.detail === "light") {
                setTheme(customEvent.detail);
            } else {
                setTheme(getThemeFromDocument());
            }
        };

        window.addEventListener("canvas-theme-change", onThemeChange);

        return () => {
            window.removeEventListener("canvas-theme-change", onThemeChange);
        };
    }, []);

    const toggleTheme = () => {
        const nextTheme: Theme = theme === "dark" ? "light" : "dark";
        applyTheme(nextTheme);
        setTheme(nextTheme);
    };

    return {theme, toggleTheme};
}

export function ThemeToggle({className = ""}: {className?: string}) {
    const {theme, toggleTheme} = useTheme();
    const isDark = theme === "dark";

    return (
        <button
            type="button"
            onClick={toggleTheme}
            className={`grid h-10 w-10 place-items-center rounded-full border text-lg transition ${
                isDark
                    ? "border-slate-500/70 bg-slate-900/85 text-amber-200 hover:bg-slate-800"
                    : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
            } ${className}`}
            title={`Switch to ${isDark ? "light" : "dark"} mode`}
            aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
        >
            <span role="img" aria-hidden="true">
                {isDark ? "🌞" : "🌙"}
            </span>
        </button>
    );
}
