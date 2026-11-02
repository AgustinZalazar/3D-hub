"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";

type RunningJob = {
  id: number;
  fileName: string;
  startedAt: string;
  filament: {
    color: string;
    colorHex: string;
    material: string;
    brand: string;
  } | null;
} | null;

function formatElapsed(startedAt: string) {
  const diff = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
  const h = Math.floor(diff / 3600);
  const m = Math.floor((diff % 3600) / 60);
  const s = diff % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  if (m > 0) return `${m}m ${String(s).padStart(2, "0")}s`;
  return `${s}s`;
}

function cleanFileName(name: string) {
  return name.replace(/\.(gcode\.)?3mf$/i, "").replace(/\.gcode$/i, "").replace(/_/g, " ");
}

function PrinterSVG() {
  return (
    <svg
      viewBox="0 0 96 96"
      width="96"
      height="96"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <style>{`
        @keyframes head-slide {
          0%   { transform: translateX(0px); }
          100% { transform: translateX(28px); }
        }
        @keyframes extrude-pulse {
          0%, 100% { opacity: 1; r: 2.5; }
          50%       { opacity: 0.4; r: 1.5; }
        }
        @keyframes layer-grow {
          0%   { opacity: 0; transform: scaleX(0); }
          30%  { opacity: 1; transform: scaleX(1); }
          80%  { opacity: 1; }
          100% { opacity: 0; }
        }
        .printer-head {
          animation: head-slide 2.4s ease-in-out infinite alternate;
        }
        .extrude-dot {
          animation: extrude-pulse 0.8s ease-in-out infinite;
        }
        .layer-line {
          transform-origin: left center;
          animation: layer-grow 2.4s ease-in-out infinite alternate;
        }
      `}</style>

      {/* Frame — outer body */}
      <rect x="14" y="10" width="68" height="76" rx="6"
        stroke="var(--border)" strokeWidth="1.5" />

      {/* Top cross-bar / gantry support */}
      <rect x="14" y="10" width="68" height="10" rx="6"
        fill="var(--border)" opacity="0.5" />
      <rect x="14" y="16" width="68" height="4"
        fill="var(--border)" opacity="0.3" />

      {/* Gantry rod */}
      <line x1="22" y1="34" x2="74" y2="34"
        stroke="oklch(0.75 0.01 265)" strokeWidth="2" strokeLinecap="round" />

      {/* Print head — animated */}
      <g className="printer-head" style={{ transformOrigin: "22px 34px" }}>
        {/* Head body */}
        <rect x="18" y="27" width="16" height="11" rx="3"
          fill="var(--t1)" />
        {/* Nozzle */}
        <path d="M24 38 L26 44 L28 38"
          fill="oklch(0.560 0.155 155)" />
        {/* Extrusion dot */}
        <circle className="extrude-dot" cx="26" cy="48" r="2.5"
          fill="oklch(0.560 0.155 155)" />
      </g>

      {/* Layer lines building on the bed — staggered */}
      <g>
        <line className="layer-line" x1="22" y1="70" x2="74" y2="70"
          stroke="oklch(0.560 0.155 155)" strokeWidth="2" strokeLinecap="round"
          style={{ animationDelay: "0s", animationDuration: "2.4s" }} />
        <line className="layer-line" x1="22" y1="66" x2="60" y2="66"
          stroke="oklch(0.560 0.155 155)" strokeWidth="2" strokeLinecap="round"
          style={{ animationDelay: "0.6s", animationDuration: "2.4s" }} />
        <line className="layer-line" x1="22" y1="62" x2="48" y2="62"
          stroke="oklch(0.560 0.155 155)" strokeWidth="2" strokeLinecap="round"
          style={{ animationDelay: "1.2s", animationDuration: "2.4s" }} />
      </g>

      {/* Bed */}
      <rect x="16" y="73" width="64" height="6" rx="2"
        fill="var(--border)" />
      <rect x="20" y="73" width="56" height="2" rx="1"
        fill="oklch(0.88 0.008 265)" />

      {/* Bed clips */}
      <rect x="16" y="71" width="5" height="10" rx="1.5"
        fill="oklch(0.75 0.01 265)" />
      <rect x="75" y="71" width="5" height="10" rx="1.5"
        fill="oklch(0.75 0.01 265)" />
    </svg>
  );
}

export function PrintStatusCard() {
  const [job, setJob] = useState<RunningJob | undefined>(undefined);
  const [elapsed, setElapsed] = useState("");

  useEffect(() => {
    const fetch_ = () =>
      fetch("/api/printer/current")
        .then((r) => r.json())
        .then(setJob)
        .catch(() => {});
    fetch_();
    const poll = setInterval(fetch_, 5000);
    return () => clearInterval(poll);
  }, []);

  useEffect(() => {
    if (!job) return;
    const tick = () => setElapsed(formatElapsed(job.startedAt));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [job]);

  if (job === undefined || job === null) return null;

  return (
    <div
      className="card flex items-center gap-0 overflow-hidden"
      style={{ borderColor: "oklch(0.880 0.040 155)" }}
    >
      {/* SVG panel */}
      <div
        className="flex items-center justify-center flex-shrink-0"
        style={{
          width: "120px",
          alignSelf: "stretch",
          background: "oklch(0.970 0.012 155)",
          borderRight: "1px solid oklch(0.880 0.040 155)",
        }}
      >
        <PrinterSVG />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 px-5 py-4">
        {/* Status pill */}
        <div className="flex items-center gap-2 mb-2">
          <span
            className="relative flex-shrink-0"
            style={{ width: "8px", height: "8px" }}
          >
            <span
              className="absolute inset-0 rounded-full"
              style={{
                background: "var(--success)",
                animation: "status-ping 2s ease-out infinite",
              }}
            />
            <span
              className="relative block w-full h-full rounded-full"
              style={{ background: "var(--success)" }}
            />
          </span>
          <span
            className="font-semibold uppercase tracking-widest"
            style={{ fontSize: "10px", color: "var(--success)", letterSpacing: "0.1em" }}
          >
            Imprimiendo
          </span>
        </div>

        {/* File name */}
        <p
          className="font-semibold truncate"
          style={{
            fontSize: "15px",
            color: "var(--t1)",
            letterSpacing: "-0.015em",
            lineHeight: 1.2,
          }}
        >
          {cleanFileName(job.fileName)}
        </p>

        {/* Filament */}
        {job.filament && (
          <div className="flex items-center gap-1.5 mt-1.5">
            <span
              className="inline-block rounded-full flex-shrink-0"
              style={{
                width: "8px",
                height: "8px",
                background: job.filament.colorHex,
                border: "1px solid var(--border)",
              }}
            />
            <span style={{ fontSize: "12px", color: "var(--t3)" }}>
              {job.filament.brand} {job.filament.material} — {job.filament.color}
            </span>
          </div>
        )}

        {/* Elapsed */}
        <div className="flex items-center gap-1.5 mt-3">
          <Clock size={12} strokeWidth={2} style={{ color: "var(--t3)" }} />
          <span
            className="num-tabular font-semibold"
            style={{ fontSize: "14px", color: "var(--t2)", letterSpacing: "-0.01em" }}
          >
            {elapsed}
          </span>
          <span style={{ fontSize: "12px", color: "var(--t3)" }}>transcurrido</span>
        </div>
      </div>

      <style>{`
        @keyframes status-ping {
          0%   { transform: scale(1); opacity: 0.9; }
          70%  { transform: scale(2.8); opacity: 0; }
          100% { transform: scale(2.8); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
