"use client";

import { useRef, useEffect, useState } from "react";

type Props = {
  /** Base64 PNG brut (sans prefix data:…), ou "" si vide. */
  value: string;
  onChange: (b64: string) => void;
  disabled?: boolean;
};

export default function SignaturePad({ value, onChange, disabled }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const lastPt = useRef<{ x: number; y: number } | null>(null);
  const [empty, setEmpty] = useState(!value);

  // Charge la signature existante sur mount ou quand value change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!value) {
      setEmpty(true);
      return;
    }
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      setEmpty(false);
    };
    img.src = `data:image/png;base64,${value}`;
  }, [value]);

  function getPoint(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const r = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) * (canvas.width / r.width),
      y: (e.clientY - r.top) * (canvas.height / r.height),
    };
  }

  function onDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (disabled) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    lastPt.current = getPoint(e);
  }

  function onMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current || disabled) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx || !lastPt.current) return;
    const p = getPoint(e);
    ctx.beginPath();
    ctx.moveTo(lastPt.current.x, lastPt.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
    lastPt.current = p;
    setEmpty(false);
  }

  function onUp() {
    if (!drawing.current) return;
    drawing.current = false;
    lastPt.current = null;
    const canvas = canvasRef.current;
    if (canvas) {
      const full = canvas.toDataURL("image/png");
      onChange(full.split(",")[1] ?? "");
    }
  }

  function clear() {
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    }
    setEmpty(true);
    onChange("");
  }

  return (
    <div className="space-y-1">
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={600}
          height={150}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerLeave={onUp}
          style={{ touchAction: "none" }}
          className={`w-full rounded-lg border bg-white ${
            disabled
              ? "border-slate-100 cursor-default"
              : "border-slate-300 cursor-crosshair active:border-indigo-400"
          }`}
        />
        {empty && !disabled && (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-[11px] text-slate-300 select-none">
            Signez ici avec le doigt ou la souris
          </span>
        )}
        {empty && disabled && (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-[11px] text-slate-300 select-none italic">
            Aucune signature
          </span>
        )}
      </div>
      {!disabled && !empty && (
        <button
          type="button"
          onClick={clear}
          className="text-[11px] text-slate-400 hover:text-red-500 transition-colors"
        >
          Effacer
        </button>
      )}
    </div>
  );
}
