import { useRef, useEffect, useCallback, useMemo } from "react";
import simpleheat from "simpleheat";

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

// ◇ diamond outline — used for BotKill
function drawDiamond(ctx, x, y, size, color) {
  const h = size / 2;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x, y - h);
  ctx.lineTo(x + h, y);
  ctx.lineTo(x, y + h);
  ctx.lineTo(x - h, y);
  ctx.closePath();
  ctx.stroke();
}

// ○ circle outline — used for BotKilled
function drawCircleOutline(ctx, x, y, r, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
}

function drawEvent(ctx, e) {
  const { pixel_x: ex, pixel_y: ey, event } = e;
  switch (event) {
    case "Position":
      ctx.beginPath();
      ctx.arc(ex, ey, 2, 0, Math.PI * 2);
      ctx.fillStyle = "#3b82f6";
      ctx.fill();
      break;
    case "BotPosition":
      ctx.beginPath();
      ctx.arc(ex, ey, 2, 0, Math.PI * 2);
      ctx.strokeStyle = "#6b7280";
      ctx.lineWidth = 1;
      ctx.stroke();
      break;
    case "Kill":
      drawCross(ctx, ex, ey, 6, "#22c55e");   // green +
      break;
    case "BotKill":
      drawDiamond(ctx, ex, ey, 7, "#22c55e"); // green ◇
      break;
    case "Killed":
      drawX(ctx, ex, ey, 8, "#ef4444");       // red ✕
      break;
    case "BotKilled":
      drawCircleOutline(ctx, ex, ey, 4, "#ef4444"); // red ○
      break;
    case "KilledByStorm":
      drawX(ctx, ex, ey, 10, "#a855f7");
      break;
    case "Loot":
      ctx.fillStyle = "#facc15";
      ctx.fillRect(ex - 2, ey - 2, 4, 4);
      break;
    default:
      break;
  }
}

const clampTransform = (scale, x, y) => {
  const minX = 1024 - 1024 * scale;
  const minY = 1024 - 1024 * scale;
  return {
    scale,
    x: Math.min(0, Math.max(minX, x)),
    y: Math.min(0, Math.max(minY, y)),
  };
};

export default function MapCanvas({
  matchEvents,
  selectedMap,
  isPlaying,
  setIsPlaying,
  speed,
  currentTs,
  setCurrentTs,
  maxTs,
  staticMode,
  selectedEventTypes,
  onEventClick,
  heatmapMode,
  heatmapIntensity,
}) {
  // Derive a filtered event list whenever matchEvents or selectedEventTypes changes
  const filteredEvents = useMemo(
    () => (matchEvents && selectedEventTypes)
      ? matchEvents.filter(e => selectedEventTypes.includes(e.event))
      : matchEvents,
    [matchEvents, selectedEventTypes]
  );

  // Which event types feed each heatmap mode
  const HEATMAP_EVENTS = {
    kills:   ["Kill", "BotKill"],
    deaths:  ["Killed", "BotKilled", "KilledByStorm"],
    traffic: ["Position", "BotPosition"],
  };
  const canvasRef = useRef(null);
  const mapImageRef = useRef(null);
  const mapLoadedRef = useRef(false);
  const lastRealTimeRef = useRef(null);
  const currentTsRef = useRef(currentTs);
  const isPlayingRef = useRef(isPlaying);
  const speedRef = useRef(speed);
  const rafRef = useRef(null);

  // Zoom / Pan state
  const transformRef = useRef({ scale: 1, x: 0, y: 0 });
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0, transX: 0, transY: 0 });

  // Keep refs in sync
  useEffect(() => { currentTsRef.current = currentTs; }, [currentTs]);
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);
  useEffect(() => { speedRef.current = speed; }, [speed]);

  // Load minimap image when map changes
  useEffect(() => {
    if (!selectedMap) return;
    mapLoadedRef.current = false;
    const img = new Image();
    img.src = MAP_IMAGE_PATHS[selectedMap];
    img.onload = () => {
      mapImageRef.current = img;
      mapLoadedRef.current = true;
      // Re-draw static view after map image loads
      if (staticMode) drawStatic();
    };
    img.onerror = () => { mapImageRef.current = null; mapLoadedRef.current = false; };
  }, [selectedMap]);


  // --- HEATMAP OVERLAY using simpleheat ---

  const drawHeatmap = useCallback((ctx, eventsPool) => {
    if (!heatmapMode || heatmapMode === "off") return;
    const types = HEATMAP_EVENTS[heatmapMode];
    if (!types) return;

    const heatPts = eventsPool
      .filter(e => types.includes(e.event))
      .map(e => [e.pixel_x, e.pixel_y, 1]);

    if (heatPts.length === 0) return;

    // Render onto an offscreen 1024x1024 canvas in map-space, then composite
    const offscreen = document.createElement("canvas");
    offscreen.width = 1024;
    offscreen.height = 1024;

    const heat = simpleheat(offscreen);
    heat.data(heatPts);
    // Radius scales with zoom — larger radius at zoom-out, tighter at zoom-in
    const { scale } = transformRef.current;
    const radius = Math.max(6, Math.round(20 / scale));
    heat.radius(radius, radius * 0.6);
    heat.max(heatmapMode === "traffic" ? 8 : 3);
    heat.draw();

    // Composite with "screen" blending so it doesn't completely occlude the map
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.globalAlpha = heatmapIntensity * 0.85;
    ctx.drawImage(offscreen, 0, 0, 1024, 1024);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1.0;
    ctx.restore();
  }, [heatmapMode, heatmapIntensity]);

  // --- STATIC MODE: draw all events once ---

  const drawStatic = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !filteredEvents) return;
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "#07070d";
    ctx.fillRect(0, 0, 1024, 1024);

    ctx.save();
    const { scale, x, y } = transformRef.current;
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    // Draw minimap background (slightly brighter in static mode for readability)
    if (mapImageRef.current) {
      ctx.globalAlpha = 0.40;
      ctx.drawImage(mapImageRef.current, 0, 0, 1024, 1024);
      ctx.globalAlpha = 1.0;
    }

    // Heatmap layer — drawn in map-space, over the minimap
    drawHeatmap(ctx, filteredEvents);

    // Draw all events at once — position dots at reduced opacity to avoid full saturation
    for (const e of filteredEvents) {
      const isPositionEvent = e.event === "Position" || e.event === "BotPosition";
      if (isPositionEvent) {
        ctx.globalAlpha = 0.25;
      }
      drawEvent(ctx, e);
      ctx.globalAlpha = 1.0;
    }

    ctx.restore();
  }, [filteredEvents, drawHeatmap]);

  // Handle forcing a clean redraw
  const forceClearRef = useRef(false);

  // --- PLAYBACK MODE: draw up to currentTs ---

  const drawFrame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !filteredEvents) return;
    const ctx = canvas.getContext("2d");
    const ts = currentTsRef.current;

    if (forceClearRef.current) {
      ctx.fillStyle = "#07070d";
      ctx.fillRect(0, 0, 1024, 1024);
      forceClearRef.current = false;
    } else {
      ctx.fillStyle = "rgba(0,0,0,0.08)";
      ctx.fillRect(0, 0, 1024, 1024);
    }

    ctx.save();
    const { scale, x, y } = transformRef.current;
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    if (mapImageRef.current) {
      ctx.globalAlpha = 0.35;
      ctx.drawImage(mapImageRef.current, 0, 0, 1024, 1024);
      ctx.globalAlpha = 1.0;
    }

    // Heatmap layer
    const visiblePool = filteredEvents.filter(ev => ev.ts_ms <= ts);
    drawHeatmap(ctx, visiblePool);

    for (const e of filteredEvents) {
      if (e.ts_ms > ts) break;
      drawEvent(ctx, e);
    }

    ctx.restore();
  }, [filteredEvents, drawHeatmap]);

  // rAF loop — only in playback mode
  useEffect(() => {
    if (staticMode) {
      // Cancel any existing rAF and do a one-shot static draw
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      drawStatic();
      return;
    }

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
  }, [filteredEvents, maxTs, staticMode, drawFrame, drawStatic, setCurrentTs, setIsPlaying]);

  // Redraw static when events change
  useEffect(() => {
    if (staticMode) drawStatic();
  }, [staticMode, drawStatic]);

  // Redraw when heatmap mode or intensity changes
  useEffect(() => {
    forceClearRef.current = true;
    if (staticMode) drawStatic();
    else if (!isPlayingRef.current) drawFrame();
  }, [heatmapMode, heatmapIntensity, staticMode, drawStatic, drawFrame]);

  // Redraw on manual scrub (playback only)
  useEffect(() => {
    if (!isPlaying && !staticMode) {
      forceClearRef.current = true;
      drawFrame();
    }
  }, [currentTs, isPlaying, staticMode, drawFrame]);

  // --- Zoom / Pan Event Handlers ---

  const getCanvasPoint = (evt) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = 1024 / rect.width;
    const scaleY = 1024 / rect.height;
    return {
      x: (evt.clientX - rect.left) * scaleX,
      y: (evt.clientY - rect.top) * scaleY,
    };
  };

  const handleDoubleClick = (e) => {
    const pt = getCanvasPoint(e);

    if (transformRef.current.scale > 1) {
      transformRef.current = { scale: 1, x: 0, y: 0 };
      if (canvasRef.current) canvasRef.current.style.cursor = "default";
    } else {
      const newScale = 2.5;
      const mapX = (pt.x - transformRef.current.x) / transformRef.current.scale;
      const mapY = (pt.y - transformRef.current.y) / transformRef.current.scale;
      const newX = pt.x - mapX * newScale;
      const newY = pt.y - mapY * newScale;
      transformRef.current = clampTransform(newScale, newX, newY);
      if (canvasRef.current) canvasRef.current.style.cursor = "grab";
    }

    forceClearRef.current = true;
    if (staticMode) drawStatic();
    else if (!isPlayingRef.current) drawFrame();
  };

  const handleMouseDown = (e) => {
    if (transformRef.current.scale <= 1) return;
    const pt = getCanvasPoint(e);
    isDraggingRef.current = true;
    dragStartRef.current = {
      x: pt.x,
      y: pt.y,
      transX: transformRef.current.x,
      transY: transformRef.current.y,
    };
    if (canvasRef.current) canvasRef.current.style.cursor = "grabbing";
  };

  const handleMouseMove = (e) => {
    if (!isDraggingRef.current) return;
    const pt = getCanvasPoint(e);
    const dx = pt.x - dragStartRef.current.x;
    const dy = pt.y - dragStartRef.current.y;
    const newX = dragStartRef.current.transX + dx;
    const newY = dragStartRef.current.transY + dy;
    transformRef.current = clampTransform(transformRef.current.scale, newX, newY);
    forceClearRef.current = true;
    if (staticMode) drawStatic();
    else if (!isPlayingRef.current) drawFrame();
  };

  const handleMouseUpOrLeave = () => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      if (canvasRef.current) canvasRef.current.style.cursor = transformRef.current.scale > 1 ? "grab" : "default";
    }
  };

  // --- Click to inspect event ---
  const clickTimerRef = useRef(null);
  const handleClick = (e) => {
    // Debounce: ignore the first click of a double-click (wait 250ms)
    if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
    clickTimerRef.current = setTimeout(() => {
      if (!filteredEvents || !onEventClick) return;

      const pt = getCanvasPoint(e);
      const { scale, x: tx, y: ty } = transformRef.current;

      // Convert to map space
      const mapX = (pt.x - tx) / scale;
      const mapY = (pt.y - ty) / scale;

      // Hit radius: 12 canvas pixels → map space
      const hitRadius = 12 / scale;

      // Only search within visible events (respect playback ts in playback mode)
      const pool = staticMode
        ? filteredEvents
        : filteredEvents.filter(ev => ev.ts_ms <= currentTsRef.current);

      let best = null;
      let bestDist = Infinity;
      for (const ev of pool) {
        const dx = ev.pixel_x - mapX;
        const dy = ev.pixel_y - mapY;
        const d = dx * dx + dy * dy;
        if (d < bestDist) { bestDist = d; best = ev; }
      }

      if (best && Math.sqrt(bestDist) <= hitRadius) {
        onEventClick(best);
      } else {
        onEventClick(null); // click on empty space clears panel
      }
    }, 250);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleWheel = (e) => {
      e.preventDefault();
      const pt = getCanvasPoint(e);
      const zoomSensitivity = 0.002;
      const delta = -e.deltaY * zoomSensitivity;
      let newScale = transformRef.current.scale * (1 + delta);
      newScale = Math.max(1, Math.min(newScale, 10));
      const mapX = (pt.x - transformRef.current.x) / transformRef.current.scale;
      const mapY = (pt.y - transformRef.current.y) / transformRef.current.scale;
      const newX = pt.x - mapX * newScale;
      const newY = pt.y - mapY * newScale;
      transformRef.current = clampTransform(newScale, newX, newY);
      canvas.style.cursor = transformRef.current.scale > 1 ? "grab" : "default";
      forceClearRef.current = true;
      if (staticMode) drawStatic();
      else if (!isPlayingRef.current) drawFrame();
    };

    canvas.addEventListener("wheel", handleWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", handleWheel);
  }, [staticMode, drawFrame, drawStatic]);

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

      {/* Static mode badge on canvas */}
      {staticMode && (
        <div className="absolute top-8 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
          <span className="text-[9px] tracking-widest uppercase px-3 py-1 border border-[#a855f7] text-[#a855f7] bg-[#07070d]/80">
            ◈ All Events · Static View
          </span>
        </div>
      )}

      {/* Controls tutorial — bottom-left */}
      <div className="absolute bottom-8 left-3 z-20 pointer-events-none flex flex-col gap-1">
        {[
          ["scroll",        "zoom in / out"],
          ["double-click",  "instant zoom toggle"],
          ["drag",          "pan (when zoomed)"],
          ["click",         "inspect event"],
        ].map(([key, desc]) => (
          <div key={key} className="flex items-center gap-2">
            <span className="text-[9px] tracking-widest uppercase px-1.5 py-0.5 border border-[#2a2a3a] text-[#555] bg-[#0a0a0f]/80 leading-none">
              {key}
            </span>
            <span className="text-[9px] text-[#333] tracking-wider">{desc}</span>
          </div>
        ))}
      </div>

      <canvas
        ref={canvasRef}
        width={1024}
        height={1024}
        className="block"
        style={{ maxHeight: "calc(100vh - 40px)", width: "auto" }}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUpOrLeave}
        onMouseLeave={handleMouseUpOrLeave}
      />
    </div>
  );
}
