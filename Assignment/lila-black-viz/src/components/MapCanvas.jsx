import { useRef, useEffect, useCallback } from "react";

const MAP_IMAGE_PATHS = {
  AmbroseValley: import.meta.env.BASE_URL + "minimaps/AmbroseValley_Minimap.png",
  GrandRift: import.meta.env.BASE_URL + "minimaps/GrandRift_Minimap.png",
  Lockdown: import.meta.env.BASE_URL + "minimaps/Lockdown_Minimap.jpg",
};

function drawCross(ctx, x, y, size, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - size / 2, y);
  ctx.lineTo(x + size / 2, y);
  ctx.moveTo(x, y - size / 2);
  ctx.lineTo(x, y + size / 2);
  ctx.stroke();
}

function drawX(ctx, x, y, size, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - size / 2, y - size / 2);
  ctx.lineTo(x + size / 2, y + size / 2);
  ctx.moveTo(x + size / 2, y - size / 2);
  ctx.lineTo(x - size / 2, y + size / 2);
  ctx.stroke();
}

export default function MapCanvas({
  matchEvents,
  selectedMap,
  isPlaying,
  setIsPlaying,
  speed,
  currentTs,
  setCurrentTs,
  maxTs,
}) {
  const canvasRef = useRef(null);
  const mapImageRef = useRef(null);
  const lastRealTimeRef = useRef(null);
  const currentTsRef = useRef(currentTs);
  const isPlayingRef = useRef(isPlaying);
  const speedRef = useRef(speed);
  const rafRef = useRef(null);

  // Keep refs in sync
  useEffect(() => { currentTsRef.current = currentTs; }, [currentTs]);
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);
  useEffect(() => { speedRef.current = speed; }, [speed]);

  // Load minimap image when map changes
  useEffect(() => {
    if (!selectedMap) return;
    const img = new Image();
    img.src = MAP_IMAGE_PATHS[selectedMap];
    img.onload = () => { mapImageRef.current = img; };
    img.onerror = () => { mapImageRef.current = null; };
  }, [selectedMap]);

  const drawFrame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !matchEvents) return;
    const ctx = canvas.getContext("2d");
    const ts = currentTsRef.current;

    // Fading trail effect — instead of clearRect, lay a semi-transparent black overlay
    ctx.fillStyle = "rgba(0,0,0,0.08)";
    ctx.fillRect(0, 0, 1024, 1024);

    // Draw minimap as dim background
    if (mapImageRef.current) {
      ctx.globalAlpha = 0.35;
      ctx.drawImage(mapImageRef.current, 0, 0, 1024, 1024);
      ctx.globalAlpha = 1.0;
    }

    // Draw all events up to currentTs
    for (const e of matchEvents) {
      if (e.ts_ms > ts) break; // array is sorted, early exit
      const { pixel_x: x, pixel_y: y, event, is_bot } = e;

      switch (event) {
        case "Position":
          ctx.beginPath();
          ctx.arc(x, y, 2, 0, Math.PI * 2);
          ctx.fillStyle = "#3b82f6"; // blue
          ctx.fill();
          break;

        case "BotPosition":
          ctx.beginPath();
          ctx.arc(x, y, 2, 0, Math.PI * 2);
          ctx.strokeStyle = "#6b7280"; // gray
          ctx.lineWidth = 1;
          ctx.stroke();
          break;

        case "Kill":
        case "BotKill":
          drawCross(ctx, x, y, 6, "#22c55e"); // green
          break;

        case "Killed":
        case "BotKilled":
          drawX(ctx, x, y, 8, "#ef4444"); // red
          break;

        case "KilledByStorm":
          drawX(ctx, x, y, 10, "#a855f7"); // purple
          break;

        case "Loot":
          ctx.fillStyle = "#facc15"; // yellow
          ctx.fillRect(x - 2, y - 2, 4, 4);
          break;

        default:
          break;
      }
    }
  }, [matchEvents]);

  // rAF loop
  useEffect(() => {
    const loop = (realTime) => {
      if (isPlayingRef.current) {
        if (lastRealTimeRef.current !== null) {
          const delta = realTime - lastRealTimeRef.current;
          const PLAYBACK_SCALE = 0.009;
          const newTs = currentTsRef.current + delta * speedRef.current * PLAYBACK_SCALE;

          if (newTs >= maxTs) {
            currentTsRef.current = maxTs;
            setCurrentTs(maxTs);
            setIsPlaying(false);
            lastRealTimeRef.current = null;
          } else {
            currentTsRef.current = newTs;
            setCurrentTs(newTs);
          }
        }
        lastRealTimeRef.current = realTime;
      } else {
        lastRealTimeRef.current = null;
      }

      drawFrame();
      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [matchEvents, maxTs, drawFrame, setCurrentTs, setIsPlaying]);

  // Redraw on manual scrub
  useEffect(() => {
    if (!isPlaying) drawFrame();
  }, [currentTs, isPlaying, drawFrame]);

  return (
    <div className="relative">
      {/* Scanline overlay for that HUD feel */}
      <div
        className="absolute inset-0 pointer-events-none z-10 opacity-5"
        style={{
          backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.5) 2px, rgba(0,0,0,0.5) 4px)",
        }}
      />
      {/* Corner decorations */}
      <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-[#ff3a3a] z-10" />
      <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-[#ff3a3a] z-10" />
      <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-[#ff3a3a] z-10" />
      <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-[#ff3a3a] z-10" />

      <canvas
        ref={canvasRef}
        width={1024}
        height={1024}
        className="block"
        style={{ maxHeight: "calc(100vh - 40px)", width: "auto" }}
      />
    </div>
  );
}