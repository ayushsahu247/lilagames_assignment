import { useRef, useEffect, useCallback, useState } from "react";

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
}) {
  const canvasRef = useRef(null);
  const mapImageRef = useRef(null);
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
    const img = new Image();
    img.src = MAP_IMAGE_PATHS[selectedMap];
    img.onload = () => { mapImageRef.current = img; };
    img.onerror = () => { mapImageRef.current = null; };
  }, [selectedMap]);

  // Handle forcing a clean redraw when zooming/panning to prevent ghost images
  // from the fading trail effect
  const forceClearRef = useRef(false);

  const drawFrame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !matchEvents) return;
    const ctx = canvas.getContext("2d");
    const ts = currentTsRef.current;

    // Fading trail effect — instead of clearRect, lay a semi-transparent black overlay
    // Unless we've just zoomed/panned, then we should clear it completely to avoid ghost trails
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

    // Draw minimap as dim background
    if (mapImageRef.current) {
      ctx.globalAlpha = 0.35;
      ctx.drawImage(mapImageRef.current, 0, 0, 1024, 1024);
      ctx.globalAlpha = 1.0;
    }

    // Draw all events up to currentTs
    for (const e of matchEvents) {
      if (e.ts_ms > ts) break; // array is sorted, early exit
      const { pixel_x: ex, pixel_y: ey, event, is_bot } = e;

      switch (event) {
        case "Position":
          ctx.beginPath();
          ctx.arc(ex, ey, 2, 0, Math.PI * 2);
          ctx.fillStyle = "#3b82f6"; // blue
          ctx.fill();
          break;

        case "BotPosition":
          ctx.beginPath();
          ctx.arc(ex, ey, 2, 0, Math.PI * 2);
          ctx.strokeStyle = "#6b7280"; // gray
          ctx.lineWidth = 1;
          ctx.stroke();
          break;

        case "Kill":
        case "BotKill":
          drawCross(ctx, ex, ey, 6, "#22c55e"); // green
          break;

        case "Killed":
        case "BotKilled":
          drawX(ctx, ex, ey, 8, "#ef4444"); // red
          break;

        case "KilledByStorm":
          drawX(ctx, ex, ey, 10, "#a855f7"); // purple
          break;

        case "Loot":
          ctx.fillStyle = "#facc15"; // yellow
          ctx.fillRect(ex - 2, ey - 2, 4, 4);
          break;

        default:
          break;
      }
    }
    
    ctx.restore();
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
    if (!isPlaying) {
      forceClearRef.current = true;
      drawFrame();
    }
  }, [currentTs, isPlaying, drawFrame]);

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
      // Zoom out to max
      transformRef.current = { scale: 1, x: 0, y: 0 };
      if (canvasRef.current) canvasRef.current.style.cursor = "default";
    } else {
      // Zoom in
      const newScale = 2.5;
      const mapX = (pt.x - transformRef.current.x) / transformRef.current.scale;
      const mapY = (pt.y - transformRef.current.y) / transformRef.current.scale;
      
      const newX = pt.x - mapX * newScale;
      const newY = pt.y - mapY * newScale;
      
      transformRef.current = clampTransform(newScale, newX, newY);
      if (canvasRef.current) canvasRef.current.style.cursor = "grab";
    }
    
    forceClearRef.current = true;
    if (!isPlayingRef.current) drawFrame();
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
    if (!isPlayingRef.current) drawFrame();
  };

  const handleMouseUpOrLeave = () => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      if (canvasRef.current) canvasRef.current.style.cursor = transformRef.current.scale > 1 ? "grab" : "default";
    }
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
      if (!isPlayingRef.current) drawFrame();
    };

    canvas.addEventListener("wheel", handleWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", handleWheel);
  }, [drawFrame]);

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
        onDoubleClick={handleDoubleClick}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUpOrLeave}
        onMouseLeave={handleMouseUpOrLeave}
      />
    </div>
  );
}
