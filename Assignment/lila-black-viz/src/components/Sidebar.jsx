export default function Sidebar({
    data,
    selectedMap, setSelectedMap,
    selectedDate, setSelectedDate,
    selectedMatch, setSelectedMatch,
    isPlaying, setIsPlaying,
    speed, setSpeed,
    currentTs, setCurrentTs,
    maxTs,
    matchEvents,
    loadTrial,
    trialMode,
  }) {
    const maps = data ? Object.keys(data) : [];
    const dates = selectedMap && data ? Object.keys(data[selectedMap]) : [];
    const matches = selectedMap && selectedDate && data
      ? Object.keys(data[selectedMap][selectedDate])
      : [];
  
    const formatTs = (ms) => {
      const s = Math.floor(ms / 1000);
      const m = Math.floor(s / 60);
      return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
    };
  
    const selectClass =
      "w-full bg-[#0d0d14] border border-[#1e1e2e] text-[#aaa] text-xs px-3 py-2 focus:outline-none focus:border-[#ff3a3a] transition-colors cursor-pointer hover:border-[#333]";
  
    const labelClass = "text-[#444] text-[10px] tracking-widest uppercase mb-1 block";
  
    return (
      <div className="w-64 h-full bg-[#0a0a0f] border-r border-[#1e1e2e] flex flex-col p-4 gap-5 overflow-y-auto">
  
        {/* Title */}
        <div className="border-b border-[#1e1e2e] pb-4">
          <p className="text-[10px] tracking-widest text-[#444] uppercase">Mission Select</p>
        </div>
  
        {/* Trial mode button */}
        <button
          onClick={loadTrial}
          className={`w-full py-2 text-xs tracking-widest uppercase border transition-colors ${
            trialMode
              ? "border-[#ff3a3a] bg-[#ff3a3a] text-black"
              : "border-[#ff3a3a] text-[#ff3a3a] hover:bg-[#ff3a3a] hover:text-black"
          }`}
        >
          ⚡ {trialMode ? "Trial Active" : "Load Trial Data"}
        </button>
  
        {/* Map */}
        <div>
          <label className={labelClass}>Map</label>
          <select className={selectClass} value={selectedMap} onChange={(e) => setSelectedMap(e.target.value)}>
            <option value="">— Select Map —</option>
            {maps.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
  
        {/* Date */}
        <div>
          <label className={labelClass}>Date</label>
          <select className={selectClass} value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} disabled={!selectedMap}>
            <option value="">— Select Date —</option>
            {dates.map((d) => <option key={d} value={d}>{d.replace("_", " ")}</option>)}
          </select>
        </div>
  
        {/* Match */}
        <div>
          <label className={labelClass}>Match ID</label>
          <select className={selectClass} value={selectedMatch} onChange={(e) => setSelectedMatch(e.target.value)} disabled={!selectedDate}>
            <option value="">— Select Match —</option>
            {matches.map((m) => (
              <option key={m} value={m}>{m.slice(0, 8)}…</option>
            ))}
          </select>
          {selectedMatch && (
            <p className="text-[#333] text-[9px] mt-1 break-all">{selectedMatch}</p>
          )}
        </div>
  
        {/* Divider */}
        <div className="border-t border-[#1e1e2e]" />
  
        {/* Playback controls */}
        <div>
          <label className={labelClass}>Playback</label>
          <div className="flex gap-2">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              disabled={!matchEvents}
              className="flex-1 py-2 text-xs tracking-widest uppercase border border-[#1e1e2e] hover:border-[#ff3a3a] hover:text-[#ff3a3a] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              {isPlaying ? "⏸ Pause" : "▶ Play"}
            </button>
            <button
              onClick={() => { setCurrentTs(0); setIsPlaying(false); }}
              disabled={!matchEvents}
              className="px-3 py-2 text-xs border border-[#1e1e2e] hover:border-[#555] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Reset"
            >
              ↺
            </button>
          </div>
        </div>
  
        {/* Speed */}
        <div>
          <label className={labelClass}>Speed</label>
          <div className="grid grid-cols-4 gap-1">
            {[1, 2, 5, 10].map((s) => (
              <button
                key={s}
                onClick={() => setSpeed(s)}
                className={`py-1.5 text-xs border transition-colors ${
                  speed === s
                    ? "border-[#ff3a3a] text-[#ff3a3a]"
                    : "border-[#1e1e2e] text-[#555] hover:border-[#333]"
                }`}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>
  
        {/* Timeline */}
        <div>
          <div className="flex justify-between mb-1">
            <label className={labelClass}>Timeline</label>
            <span className="text-[#444] text-[10px]">{formatTs(currentTs)} / {formatTs(maxTs)}</span>
          </div>
          <input
            type="range"
            min={0}
            max={maxTs}
            value={currentTs}
            onChange={(e) => { setCurrentTs(Number(e.target.value)); setIsPlaying(false); }}
            disabled={!matchEvents}
            className="w-full accent-[#ff3a3a] disabled:opacity-30 cursor-pointer"
          />
        </div>
  
        {/* Divider */}
        <div className="border-t border-[#1e1e2e]" />
  
        {/* Legend */}
        <div>
          <label className={labelClass}>Legend</label>
          <div className="flex flex-col gap-2 text-[11px] text-[#555]">
            <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-blue-500 inline-block" />Human Position</div>
            <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full border border-gray-500 inline-block" />Bot Position</div>
            <div className="flex items-center gap-2"><span className="text-green-400 font-bold text-base leading-none">+</span>Kill</div>
            <div className="flex items-center gap-2"><span className="text-red-400 font-bold text-base leading-none">✕</span>Death</div>
            <div className="flex items-center gap-2"><span className="text-purple-400 font-bold text-base leading-none">✕</span>Storm Death</div>
            <div className="flex items-center gap-2"><span className="w-3 h-3 bg-yellow-400 inline-block" />Loot</div>
          </div>
        </div>
  
        {/* Match stats */}
        {matchEvents && (
          <>
            <div className="border-t border-[#1e1e2e]" />
            <div>
              <label className={labelClass}>Match Info</label>
              <div className="text-[11px] text-[#444] flex flex-col gap-1">
                <div className="flex justify-between"><span>Total Events</span><span className="text-[#666]">{matchEvents.length}</span></div>
                <div className="flex justify-between"><span>Duration</span><span className="text-[#666]">{formatTs(maxTs)}</span></div>
                <div className="flex justify-between"><span>Players</span><span className="text-[#666]">{new Set(matchEvents.map(e => e.user_id)).size}</span></div>
              </div>
            </div>
          </>
        )}
      </div>
    );
  }