"use client";

import { useEffect, useRef } from "react";

// Pure white opacity scale — no hue at all
const LEVELS = [
  { bg: "rgba(255,255,255,0.05)", sh: "none" },
  { bg: "rgba(255,255,255,0.09)", sh: "none" },
  { bg: "rgba(255,255,255,0.15)", sh: "0 0 8px rgba(255,255,255,0.08)" },
  { bg: "rgba(255,255,255,0.24)", sh: "0 0 12px rgba(255,255,255,0.12)" },
  { bg: "rgba(255,255,255,0.40)", sh: "0 0 16px rgba(255,255,255,0.18)" },
];

export default function CellGrid() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const cells = Array.from(el.querySelectorAll<HTMLElement>(".cell"));

    function fire() {
      const idx = Math.floor(Math.random() * cells.length);
      const lvl = LEVELS[Math.floor(Math.random() * LEVELS.length)];
      const dur = 350 + Math.random() * 750;
      const c = cells[idx];

      c.style.background = lvl.bg;
      c.style.boxShadow = lvl.sh;
      c.style.transform = "scale(0.85)";

      // ripple to 1-2 neighbours
      const spread = Math.random() > 0.45 ? [1, -1] : [1];
      spread.forEach((offset, si) => {
        const ni = idx + offset;
        if (ni < 0 || ni >= cells.length) return;
        const nl = LEVELS[Math.max(0, LEVELS.indexOf(lvl) - 1 - si)];
        setTimeout(() => {
          const n = cells[ni];
          n.style.background = nl.bg;
          n.style.boxShadow = nl.sh;
          setTimeout(() => {
            n.style.background = "";
            n.style.boxShadow = "";
          }, dur * 0.55);
        }, 75 + si * 40);
      });

      setTimeout(() => {
        c.style.background = "";
        c.style.boxShadow = "";
        c.style.transform = "";
      }, dur);
    }

    const id = setInterval(fire, 80);
    return () => clearInterval(id);
  }, []);

  return (
    <div ref={ref} className="cell-grid absolute inset-0" aria-hidden>
      {Array.from({ length: 400 }).map((_, i) => (
        <div key={i} className="cell" />
      ))}
    </div>
  );
}
