const TYPE_CONFIG = {
  Kill:          { color: "#22c55e", symbol: "+",  label: "Kill"          },
  BotKill:       { color: "#22c55e", symbol: "◇",  label: "Bot Kill"      },
  Killed:        { color: "#ef4444", symbol: "✕",  label: "Killed"        },
  BotKilled:     { color: "#ef4444", symbol: "○",  label: "Bot Killed"    },
  KilledByStorm: { color: "#a855f7", symbol: "✕",  label: "Storm Kill"    },
  Position:      { color: "#3b82f6", symbol: "●",  label: "Position"      },
  BotPosition:   { color: "#6b7280", symbol: "○",  label: "Bot Position"  },
  Loot:          { color: "#facc15", symbol: "■",  label: "Loot"          },
};

const formatTs = (ms) => {
  if (ms == null) return "—";
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

export default function EventPanel({ event, onClose }) {
  if (!event) return null;

  const cfg = TYPE_CONFIG[event.event] || { color: "#888", symbol: "?", label: event.event };

  const Row = ({ label, value, mono = true }) => (
    <div className="flex justify-between items-start gap-2 py-1 border-b border-[#1a1a24]">
      <span className="text-[9px] tracking-widest uppercase text-[#444] flex-shrink-0">{label}</span>
      <span
        className={`text-[11px] text-right break-all ${mono ? "font-mono" : ""}`}
        style={{ color: "#888" }}
      >
        {value ?? "—"}
      </span>
    </div>
  );

  return (
    <div
      className="absolute top-10 right-3 z-30 w-56 bg-[#0a0a0f]/95 border border-[#1e1e2e] flex flex-col"
      style={{ backdropFilter: "blur(4px)" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#1e1e2e]">
        <div className="flex items-center gap-2">
          <span className="text-lg leading-none font-bold" style={{ color: cfg.color }}>
            {cfg.symbol}
          </span>
          <span className="text-xs tracking-widest uppercase" style={{ color: cfg.color }}>
            {cfg.label}
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-[#333] hover:text-[#ff3a3a] text-sm transition-colors"
          title="Close"
        >
          ✕
        </button>
      </div>

      {/* Details */}
      <div className="px-3 py-2 flex flex-col">
        {event._date && <Row label="Date"     value={event._date.replace("_", " ")} />}
        {event._matchId && (
          <Row label="Match ID" value={event._matchId.slice(0, 12) + "…"} />
        )}
        {event.user_id && <Row label="User ID"  value={event.user_id.slice(0, 12) + "…"} />}
        <Row label="Bot"      value={event.is_bot ? "Yes" : "No"} />
        <Row label="Time"     value={formatTs(event.ts_ms)} />
        <Row label="Pixel X"  value={Math.round(event.pixel_x)} />
        <Row label="Pixel Y"  value={Math.round(event.pixel_y)} />
      </div>

      {/* Corner decorations */}
      <div className="absolute top-0 left-0 w-3 h-3 border-t border-l pointer-events-none" style={{ borderColor: cfg.color }} />
      <div className="absolute top-0 right-0 w-3 h-3 border-t border-r pointer-events-none" style={{ borderColor: cfg.color }} />
      <div className="absolute bottom-0 left-0 w-3 h-3 border-b border-l pointer-events-none" style={{ borderColor: cfg.color }} />
      <div className="absolute bottom-0 right-0 w-3 h-3 border-b border-r pointer-events-none" style={{ borderColor: cfg.color }} />
    </div>
  );
}
