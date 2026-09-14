"use client";

import { createContext, useContext, useEffect, useId, useRef, useState, type ReactNode } from "react";

export const experienceThemes = {
  space: { label: "Deep Space", description: "Blue nebulae · distant stars", index: 0, planet: "#345c8c", rim: "#86c9ff", stars: "#c7def7" },
  aurora: { label: "Aurora", description: "Flowing curtains · emerald light", index: 1, planet: "#315d55", rim: "#82f0c2", stars: "#c5f5e3" },
  lunar: { label: "Lunar", description: "Silver atmosphere · quiet orbit", index: 2, planet: "#747d8c", rim: "#d7e3f0", stars: "#e1e7ef" },
  mars: { label: "Mars", description: "Real Martian terrain · quiet horizons", index: 3, planet: "#b45632", rim: "#ffa06a", stars: "#f8c7a1" },
} as const;
export type ExperienceTheme = keyof typeof experienceThemes;
const ThemeContext = createContext<{ theme: ExperienceTheme; setTheme: (theme: ExperienceTheme) => void }>({ theme: "space", setTheme: () => {} });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, updateTheme] = useState<ExperienceTheme>("space");
  useEffect(() => {
    try {
      const saved = localStorage.getItem("adief-experience-theme");
      if (saved && Object.hasOwn(experienceThemes, saved)) updateTheme(saved as ExperienceTheme);
    } catch { /* Browser storage is optional. */ }
  }, []);
  const setTheme = (next: ExperienceTheme) => {
    updateTheme(next);
    try { localStorage.setItem("adief-experience-theme", next); } catch { /* Keep the session choice. */ }
  };
  return <ThemeContext.Provider value={{ theme, setTheme }}>
    <div className="experience-theme" data-experience-theme={theme}>{children}</div>
  </ThemeContext.Provider>;
}

export function useExperienceTheme() { return useContext(ThemeContext); }

export function ThemePicker({ compact = false }: { compact?: boolean }) {
  const { theme, setTheme } = useExperienceTheme();
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (!container.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { setOpen(false); trigger.current?.focus(); } };
    document.addEventListener("pointerdown", outside); document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, [open]);
  if (!compact) return <div className="atmosphere-control" ref={container} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
    <button ref={trigger} type="button" className="atmosphere-trigger" aria-expanded={open} aria-controls={id} aria-label={`Atmosphere: ${experienceThemes[theme].label}. Change atmosphere`} onClick={() => setOpen(!open)}>
      <span className={`theme-swatch theme-swatch-${theme}`} aria-hidden="true"/><span>Atmosphere</span><span aria-hidden="true" className="atmosphere-chevron">⌄</span>
    </button>
    {open && <div id={id} className="atmosphere-popover" role="group" aria-label="Choose atmosphere">
      {(Object.keys(experienceThemes) as ExperienceTheme[]).map(key => <button key={key} type="button" aria-pressed={theme === key} onClick={() => { setTheme(key); setOpen(false); trigger.current?.focus(); }}>
        <span className={`theme-swatch theme-swatch-${key}`} aria-hidden="true"/><span>{experienceThemes[key].label}</span><span aria-hidden="true">{theme === key ? "✓" : ""}</span>
      </button>)}
    </div>}
  </div>;
  return <div className={`theme-picker ${compact ? "theme-picker-compact" : ""}`}>
    <p className="eyebrow">CHOOSE YOUR ATMOSPHERE</p>
    <div role="group" aria-label="Visual theme" className="theme-options">
      {(Object.keys(experienceThemes) as ExperienceTheme[]).map(key => <button key={key} type="button"
        aria-pressed={theme === key} onClick={() => setTheme(key)} data-cursor="view">
        <span className={`theme-swatch theme-swatch-${key}`} aria-hidden="true" />{experienceThemes[key].label}
      </button>)}
    </div>
    {!compact && <p className="theme-description" aria-live="polite">{experienceThemes[theme].description}</p>}
  </div>;
}
