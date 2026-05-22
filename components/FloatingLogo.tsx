"use client";

import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import Image from "next/image";
import { useEffect } from "react";

const ORBS = [
  { size: 260, top: "2%",  left: "-6%",  rotDur: 14, tiltDur: 9,  delay: 0, opacity: 0.09 },
  { size: 200, top: "52%", right: "-4%", rotDur: 20, tiltDur: 13, delay: 3, opacity: 0.07 },
  { size: 160, top: "28%", left: "44%",  rotDur: 28, tiltDur: 17, delay: 7, opacity: 0.05 },
];

const CHIPS = [
  { size: 70,  top: "7%",  left: "5%",   dur: 6,  delay: 0,   opacity: 0.45 },
  { size: 52,  top: "19%", left: "11%",  dur: 8,  delay: 1.1, opacity: 0.25 },
  { size: 86,  top: "60%", left: "4%",   dur: 7,  delay: 0.4, opacity: 0.35 },
  { size: 62,  top: "79%", left: "13%",  dur: 9,  delay: 2.2, opacity: 0.22 },
  { size: 78,  top: "9%",  right: "5%",  dur: 8,  delay: 0.7, opacity: 0.40 },
  { size: 50,  top: "27%", right: "9%",  dur: 10, delay: 1.9, opacity: 0.20 },
  { size: 94,  top: "54%", right: "3%",  dur: 5,  delay: 0.2, opacity: 0.30 },
  { size: 66,  top: "77%", right: "10%", dur: 7,  delay: 1.4, opacity: 0.22 },
];

function Orb({ orb }: { orb: typeof ORBS[0] }) {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const rx = useSpring(useTransform(mouseX, [-1, 1], [-18, 18]), { stiffness: 60, damping: 25 });
  const ry = useSpring(useTransform(mouseY, [-1, 1], [18, -18]), { stiffness: 60, damping: 25 });

  useEffect(() => {
    function onMove(e: MouseEvent) {
      mouseX.set((e.clientX - window.innerWidth / 2) / (window.innerWidth / 2));
      mouseY.set((e.clientY - window.innerHeight / 2) / (window.innerHeight / 2));
    }
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, [mouseX, mouseY]);

  return (
    <div
      className="absolute"
      style={{
        width: orb.size, height: orb.size,
        top: orb.top,
        left: "left" in orb ? (orb as { left: string }).left : undefined,
        right: "right" in orb ? (orb as { right: string }).right : undefined,
        perspective: 900, opacity: orb.opacity,
      }}
    >
      <motion.div
        className="w-full h-full"
        style={{ transformStyle: "preserve-3d", rotateX: rx, rotateY: ry }}
        animate={{ rotateY: [0, 360], rotateZ: [0, 6, 0, -6, 0] }}
        transition={{
          rotateY: { duration: orb.rotDur, repeat: Infinity, ease: "linear", delay: orb.delay },
          rotateZ: { duration: orb.tiltDur, repeat: Infinity, ease: "easeInOut", delay: orb.delay },
        }}
      >
        {/* Rings */}
        <div className="absolute inset-0 rounded-full" style={{ border: "1.5px solid rgba(255,255,255,0.14)", boxShadow: "0 0 60px rgba(255,255,255,0.04), inset 0 0 40px rgba(255,255,255,0.02)" }} />
        <div className="absolute rounded-full" style={{ inset: "14%", border: "1px solid rgba(255,255,255,0.08)" }} />
        <div className="absolute rounded-full" style={{ inset: "30%", border: "1px solid rgba(255,255,255,0.05)" }} />
        {/* Equator band */}
        <div className="absolute" style={{ top: "48%", left: "6%", right: "6%", height: "3%", background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.10), transparent)", borderRadius: 2 }} />
        {/* Logo */}
        <div className="absolute inset-0 flex items-center justify-center" style={{ backfaceVisibility: "hidden" }}>
          <div className="rounded-full flex items-center justify-center" style={{ width: "42%", height: "42%", background: "radial-gradient(circle, #1a1c20 0%, #0d0e10 100%)", border: "1px solid rgba(255,255,255,0.10)" }}>
            <Image src="/logo.png" alt="" width={orb.size * 0.18} height={orb.size * 0.18} className="object-contain" style={{ filter: "invert(1) brightness(0.5)" }} />
          </div>
        </div>
        {/* Specular */}
        <div className="absolute rounded-full pointer-events-none" style={{ inset: "8%", background: "radial-gradient(ellipse 55% 35% at 35% 28%, rgba(255,255,255,0.07) 0%, transparent 65%)" }} />
      </motion.div>
      {/* Ambient glow */}
      <motion.div
        className="absolute -inset-8 rounded-full blur-3xl pointer-events-none"
        style={{ background: "rgba(255,255,255,0.025)" }}
        animate={{ scale: [1, 1.12, 1], opacity: [0.5, 1, 0.5] }}
        transition={{ duration: orb.tiltDur * 0.8, repeat: Infinity, ease: "easeInOut", delay: orb.delay }}
      />
    </div>
  );
}

function Chip({ chip }: { chip: typeof CHIPS[0] }) {
  return (
    <motion.div
      className="absolute"
      style={{
        width: chip.size, height: chip.size,
        top: chip.top,
        left: "left" in chip ? (chip as { left: string }).left : undefined,
        right: "right" in chip ? (chip as { right: string }).right : undefined,
        opacity: chip.opacity,
      }}
      animate={{ y: [0, -16, 0], rotate: [-3, 3, -3] }}
      transition={{ duration: chip.dur, repeat: Infinity, ease: "easeInOut", delay: chip.delay }}
    >
      <div className="relative w-full h-full flex items-center justify-center">
        <div className="absolute inset-0 rounded-full border border-white/20" style={{ boxShadow: "0 0 14px rgba(255,255,255,0.05)" }} />
        <div className="absolute inset-[5px] rounded-full border border-dashed border-white/08" />
        <div className="relative z-10 flex items-center justify-center rounded-full w-[65%] h-[65%]" style={{ background: "radial-gradient(circle, #1e2028 0%, #13141a 100%)", border: "1px solid rgba(255,255,255,0.10)" }}>
          <Image src="/logo.png" alt="" width={chip.size * 0.33} height={chip.size * 0.33} className="object-contain" style={{ filter: "invert(1) brightness(0.65)" }} />
        </div>
      </div>
    </motion.div>
  );
}

export default function FloatingLogos() {
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden z-0" aria-hidden>
      {ORBS.map((orb, i) => <Orb key={i} orb={orb} />)}
      {CHIPS.map((chip, i) => <Chip key={i} chip={chip} />)}
    </div>
  );
}
