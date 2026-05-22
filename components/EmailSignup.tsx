"use client";

import { useState } from "react";

export default function EmailSignup() {
  const [email,  setEmail]  = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done">("idle");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setStatus("loading");
    await new Promise((r) => setTimeout(r, 850));
    setStatus("done");
  }

  if (status === "done") {
    return (
      <div className="flex items-center gap-3 text-sm font-mono text-white/50 tracking-wide">
        <span className="w-2 h-2 rounded-full bg-white/50 animate-pulse" />
        You&apos;re on the list.
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex w-full">
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="your@email.com"
        required
        className="flex-1 bg-transparent border border-white/10 border-r-0 px-4 py-3 text-sm text-white/80 placeholder-white/18 outline-none focus:border-white/25 transition-colors font-mono tracking-wide rounded-none"
      />
      <button
        type="submit"
        disabled={status === "loading"}
        className="px-6 py-3 bg-white text-black text-xs font-bold font-mono tracking-[0.15em] uppercase border border-white hover:bg-white/90 active:scale-[0.98] transition-all disabled:opacity-50 whitespace-nowrap"
      >
        {status === "loading" ? "···" : "Join Waitlist"}
      </button>
    </form>
  );
}
