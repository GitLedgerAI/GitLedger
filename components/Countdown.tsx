"use client";

import { useEffect, useState } from "react";

const LAUNCH = new Date("2026-07-15T00:00:00Z");

function getLeft() {
  const d = LAUNCH.getTime() - Date.now();
  if (d <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0 };
  return {
    days:    Math.floor(d / 86400000),
    hours:   Math.floor((d / 3600000) % 24),
    minutes: Math.floor((d / 60000) % 60),
    seconds: Math.floor((d / 1000) % 60),
  };
}

function Unit({ value, label }: { value: number; label: string }) {
  const [display, setDisplay] = useState(value);
  const [flash, setFlash]   = useState(false);

  useEffect(() => {
    if (value === display) return;
    setFlash(true);
    const t = setTimeout(() => { setDisplay(value); setFlash(false); }, 220);
    return () => clearTimeout(t);
  }, [value, display]);

  return (
    <div className="flex flex-col items-center">
      <span
        className={`font-mono font-bold tabular-nums leading-none transition-all duration-220 text-5xl sm:text-6xl md:text-7xl text-white ${
          flash ? "opacity-20 scale-90" : "opacity-100 scale-100"
        }`}
      >
        {String(display).padStart(2, "0")}
      </span>
      <span className="text-[9px] font-mono tracking-[0.28em] text-white/25 uppercase mt-2">
        {label}
      </span>
    </div>
  );
}

export default function Countdown() {
  const [t, setT] = useState(getLeft());
  const [up, setUp] = useState(false);

  useEffect(() => {
    setUp(true);
    const id = setInterval(() => setT(getLeft()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!up) return null;

  return (
    <div className="flex items-start gap-6 sm:gap-10">
      <Unit value={t.days}    label="Days" />
      <Dot />
      <Unit value={t.hours}   label="Hours" />
      <Dot />
      <Unit value={t.minutes} label="Min" />
      <Dot />
      <Unit value={t.seconds} label="Sec" />
    </div>
  );
}

function Dot() {
  return (
    <span className="text-4xl font-mono font-bold text-white/15 leading-none mt-2 animate-blink select-none">
      :
    </span>
  );
}
