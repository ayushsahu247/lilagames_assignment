import { useState } from "react";

const ALL_EVENT_TYPES = ["Position", "BotPosition", "Kill", "BotKill", "Killed", "BotKilled", "KilledByStorm", "Loot"];

// Visual config per event type (matches legend)
const EVENT_TYPE_META = {
  Position:       { label: "Position",      group: "movement",    dot: "rounded-full bg-blue-500" },
  BotPosition:    { label: "BotPosition",   group: "movement",    dot: "rounded-full border border-gray-500" },
  Kill:           { label: "Kill",          group: "combat",      symbol: "+", color: "text-green-400" },
  BotKill:        { label: "BotKill",       group: "combat",      symbol: "◇", color: "text-green-400" },
  Killed:         { label: "Killed",        group: "combat",      symbol: "✕", color: "text-red-400" },
  BotKilled:      { label: "BotKilled",     group: "combat",      symbol: "○", color: "text-red-400" },
  KilledByStorm:  { label: "KilledByStorm", group: "environment", symbol: "✕", color: "text-purple-400" },
  Loot:           { label: "Loot",          group: "environment", dot: "bg-yellow-400" },
};

export default function Sidebar({
  data,
  selectedMap, setSelectedMap,
  selectedDates, setSelectedDates,
  selectedMatches, setSelectedMatches,
  isPlaying, setIsPlaying,
  speed, setSpeed,
  currentTs, setCurrentTs,
  maxTs,
  combinedEvents,
  isSingleMatch,
  staticMode,
  loadTrial,
  trialMode,
  selectedEventTypes,
  setSelectedEventTypes,
  heatmapMode,
  setHeatmapMode,
  heatmapIntensity,
  setHeatmapIntensity,
}) {
  const maps = data ? Object.keys(data) : [];

  // All dates for the selected map
  const allDates = selectedMap && data ? Object.keys(data[selectedMap]) : [];

  // All matches across selected dates (deduplicated by match ID)
  const allMatchIds = (() => {
    if (!selectedMap || !data || selectedDates.length === 0) return [];
    const seen = new Set();
    const ids = [];
    for (const date of selectedDates) {
      const dateData = data[selectedMap]?.[date];
      if (!dateData) continue;
      for (const id of Object.keys(dateData)) {
        if (!seen.has(id)) { seen.add(id); ids.push(id); }
      }
    }
    return ids;
  })();

  const allDatesSelected = allDates.length > 0 && selectedDates.length === allDates.length;
  const allMatchesSelected = allMatchIds.length > 0 && selectedMatches.length === allMatchIds.length;

  const toggleDate = (date) => {
    setSelectedDates(
      selectedDates.includes(date)
        ? selectedDates.filter((d) => d !== date)
        : [...selectedDates, date]
    );
  };

  const toggleMatch = (id) => {
    setSelectedMatches(
      selectedMatches.includes(id)
        ? selectedMatches.filter((m) => m !== id)
        : [...selectedMatches, id]
    );
  };

  const toggleAllDates = () => {
    setSelectedDates(allDatesSelected ? [] : [...allDates]);
  };

  const toggleAllMatches = () => {
    setSelectedMatches(allMatchesSelected ? [] : [...allMatchIds]);
  };

  // Match search filter (purely visual — All/Clear still operates on full set)
  const [matchSearch, setMatchSearch] = useState("");
  const visibleMatchIds = matchSearch.trim()
    ? allMatchIds.filter(id => id.toLowerCase().includes(matchSearch.toLowerCase()))
    : allMatchIds;

  const formatTs = (ms) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  };

  const selectClass =
    "w-full bg-[#0d0d14] border border-[#1e1e2e] text-[#aaa] text-xs px-3 py-2 focus:outline-none focus:border-[#ff3a3a] transition-colors cursor-pointer hover:border-[#333]";

  const labelClass = "text-[#444] text-[10px] tracking-widest uppercase mb-1 block";

  // Checkbox row styles
  const checkboxRow = "flex items-center gap-2 py-1 px-2 cursor-pointer hover:bg-[#111118] rounded group";
  const checkLabel = "text-[11px] text-[#666] group-hover:text-[#aaa] transition-colors truncate";

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

      {/* Date — multi-select checkboxes */}
      {selectedMap && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className={labelClass}>Date</label>
            <button
              onClick={toggleAllDates}
              className="text-[9px] tracking-widest uppercase text-[#ff3a3a] hover:text-[#ff6060] transition-colors"
            >
              {allDatesSelected ? "Clear" : "All"}
            </button>
          </div>
          <div className="flex flex-col border border-[#1e1e2e] bg-[#0d0d14] max-h-36 overflow-y-auto">
            {allDates.length === 0 && (
              <p className="text-[10px] text-[#333] px-2 py-1">No dates available</p>
            )}
            {allDates.map((date) => (
              <label key={date} className={checkboxRow} onClick={() => toggleDate(date)}>
                <input
                  type="checkbox"
                  checked={selectedDates.includes(date)}
                  readOnly
                  className="accent-[#ff3a3a] cursor-pointer flex-shrink-0"
                />
                <span className={checkLabel}>{date.replace("_", " ")}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Match — multi-select checkboxes */}
      {selectedDates.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className={labelClass}>
              Match ID
              {selectedMatches.length > 0 && (
                <span className="ml-1 text-[#ff3a3a]">({selectedMatches.length})</span>
              )}
            </label>
            <button
              onClick={toggleAllMatches}
              className="text-[9px] tracking-widest uppercase text-[#ff3a3a] hover:text-[#ff6060] transition-colors"
            >
              {allMatchesSelected ? "Clear" : "All"}
            </button>
          </div>

          {/* Search input */}
          <div className="relative mb-1">
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[#333] text-[10px] pointer-events-none">⌕</span>
            <input
              type="text"
              value={matchSearch}
              onChange={(e) => setMatchSearch(e.target.value)}
              placeholder="Search match ID…"
              className="w-full bg-[#0d0d14] border border-[#1e1e2e] text-[#aaa] text-[10px] pl-6 pr-2 py-1.5 focus:outline-none focus:border-[#ff3a3a] transition-colors placeholder-[#2a2a3a]"
            />
            {matchSearch && (
              <button
                onClick={() => setMatchSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[#333] hover:text-[#ff3a3a] text-[10px] transition-colors"
              >✕</button>
            )}
          </div>

          <div className="flex flex-col border border-[#1e1e2e] bg-[#0d0d14] max-h-44 overflow-y-auto">
            {visibleMatchIds.length === 0 && (
              <p className="text-[10px] text-[#333] px-2 py-1">
                {allMatchIds.length === 0 ? "No matches available" : "No results"}
              </p>
            )}
            {matchSearch && visibleMatchIds.length > 0 && (
              <p className="text-[9px] text-[#333] px-2 pt-1">
                {visibleMatchIds.length} of {allMatchIds.length}
              </p>
            )}
            {visibleMatchIds.map((id) => (
              <label key={id} className={checkboxRow} onClick={() => toggleMatch(id)}>
                <input
                  type="checkbox"
                  checked={selectedMatches.includes(id)}
                  readOnly
                  className="accent-[#ff3a3a] cursor-pointer flex-shrink-0"
                />
                <span className={checkLabel} title={id}>{id.slice(0, 8)}…</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Divider */}
      <div className="border-t border-[#1e1e2e]" />

      {/* Mode badge */}
      {combinedEvents && (
        <div className="flex items-center gap-2">
          <span className={`text-[9px] tracking-widest uppercase px-2 py-0.5 border ${
            staticMode
              ? "border-[#a855f7] text-[#a855f7]"
              : "border-[#22c55e] text-[#22c55e]"
          }`}>
            {staticMode ? "◈ Overview" : "▶ Playback"}
          </span>
          {staticMode && (
            <span className="text-[9px] text-[#444]">
              {selectedMatches.length} match{selectedMatches.length !== 1 ? "es" : ""}
            </span>
          )}
        </div>
      )}

      {/* Playback controls — only for single match */}
      {isSingleMatch && (
        <>
          <div>
            <label className={labelClass}>Playback</label>
            <div className="flex gap-2">
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                disabled={!combinedEvents}
                className="flex-1 py-2 text-xs tracking-widest uppercase border border-[#1e1e2e] hover:border-[#ff3a3a] hover:text-[#ff3a3a] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                {isPlaying ? "⏸ Pause" : "▶ Play"}
              </button>
              <button
                onClick={() => { setCurrentTs(0); setIsPlaying(false); }}
                disabled={!combinedEvents}
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
              disabled={!combinedEvents}
              className="w-full accent-[#ff3a3a] disabled:opacity-30 cursor-pointer"
            />
          </div>
        </>
      )}

      {/* Divider */}
      <div className="border-t border-[#1e1e2e]" />

      {/* Event Filter — replaces the old static legend */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className={labelClass}>Event Filter
            {selectedEventTypes.length < ALL_EVENT_TYPES.length && (
              <span className="ml-1 text-[#ff3a3a]">({selectedEventTypes.length}/{ALL_EVENT_TYPES.length})</span>
            )}
          </label>
          <button
            onClick={() =>
              selectedEventTypes.length === ALL_EVENT_TYPES.length
                ? setSelectedEventTypes([])
                : setSelectedEventTypes([...ALL_EVENT_TYPES])
            }
            className="text-[9px] tracking-widest uppercase text-[#ff3a3a] hover:text-[#ff6060] transition-colors"
          >
            {selectedEventTypes.length === ALL_EVENT_TYPES.length ? "Clear" : "All"}
          </button>
        </div>

        {/* Group: Movement */}
        <p className="text-[9px] tracking-widest text-[#333] uppercase mb-1">Movement</p>
        <div className="flex flex-col mb-3">
          {["Position", "BotPosition"].map((type) => {
            const meta = EVENT_TYPE_META[type];
            const active = selectedEventTypes.includes(type);
            return (
              <label key={type} className={checkboxRow} onClick={() =>
                setSelectedEventTypes(active
                  ? selectedEventTypes.filter(t => t !== type)
                  : [...selectedEventTypes, type])
              }>
                <input type="checkbox" checked={active} readOnly className="accent-[#ff3a3a] cursor-pointer flex-shrink-0" />
                <span className={`w-3 h-3 inline-block flex-shrink-0 ${meta.dot}`} />
                <span className={`${checkLabel} ${active ? "text-[#888]" : ""}`}>{meta.label}</span>
              </label>
            );
          })}
        </div>

        {/* Group: Combat */}
        <p className="text-[9px] tracking-widest text-[#333] uppercase mb-1">Combat</p>
        <div className="flex flex-col mb-3">
          {["Kill", "BotKill", "Killed", "BotKilled"].map((type) => {
            const meta = EVENT_TYPE_META[type];
            const active = selectedEventTypes.includes(type);
            return (
              <label key={type} className={checkboxRow} onClick={() =>
                setSelectedEventTypes(active
                  ? selectedEventTypes.filter(t => t !== type)
                  : [...selectedEventTypes, type])
              }>
                <input type="checkbox" checked={active} readOnly className="accent-[#ff3a3a] cursor-pointer flex-shrink-0" />
                <span className={`${meta.color} font-bold text-base leading-none w-3 text-center flex-shrink-0`}>{meta.symbol}</span>
                <span className={`${checkLabel} ${active ? "text-[#888]" : ""}`}>{meta.label}</span>
              </label>
            );
          })}
        </div>

        {/* Group: Environment */}
        <p className="text-[9px] tracking-widest text-[#333] uppercase mb-1">Environment · Items</p>
        <div className="flex flex-col">
          {["KilledByStorm", "Loot"].map((type) => {
            const meta = EVENT_TYPE_META[type];
            const active = selectedEventTypes.includes(type);
            return (
              <label key={type} className={checkboxRow} onClick={() =>
                setSelectedEventTypes(active
                  ? selectedEventTypes.filter(t => t !== type)
                  : [...selectedEventTypes, type])
              }>
                <input type="checkbox" checked={active} readOnly className="accent-[#ff3a3a] cursor-pointer flex-shrink-0" />
                {meta.symbol
                  ? <span className={`${meta.color} font-bold text-base leading-none w-3 text-center flex-shrink-0`}>{meta.symbol}</span>
                  : <span className={`w-3 h-3 inline-block flex-shrink-0 ${meta.dot}`} />}
                <span className={`${checkLabel} ${active ? "text-[#888]" : ""}`}>{meta.label}</span>
              </label>
            );
          })}
        </div>
      </div>

      {/* Heatmap overlay */}
      {combinedEvents && (
        <>
          <div className="border-t border-[#1e1e2e]" />
          <div>
            <label className={labelClass}>Heatmap Overlay</label>

            {/* Mode selector */}
            <div className="grid grid-cols-2 gap-1 mb-3">
              {[
                { id: "off",     label: "Off" },
                { id: "kills",   label: "Kill Zones" },
                { id: "deaths",  label: "Death Zones" },
                { id: "traffic", label: "High Traffic" },
              ].map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => setHeatmapMode(id)}
                  className={`py-1.5 text-[10px] tracking-widest uppercase border transition-colors ${
                    heatmapMode === id
                      ? "border-[#ff3a3a] text-[#ff3a3a] bg-[#ff3a3a]/10"
                      : "border-[#1e1e2e] text-[#444] hover:border-[#333] hover:text-[#666]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Intensity slider — only when heatmap is active */}
            {heatmapMode !== "off" && (
              <div>
                <div className="flex justify-between mb-1">
                  <label className={labelClass}>Intensity</label>
                  <span className="text-[#444] text-[10px]">{Math.round(heatmapIntensity * 100)}%</span>
                </div>
                <input
                  type="range"
                  min={0.1}
                  max={1}
                  step={0.05}
                  value={heatmapIntensity}
                  onChange={(e) => setHeatmapIntensity(Number(e.target.value))}
                  className="w-full accent-[#ff3a3a] cursor-pointer"
                />
              </div>
            )}
          </div>
        </>
      )}

      {/* Match stats */}

      {combinedEvents && (
        <>
          <div className="border-t border-[#1e1e2e]" />
          <div>
            <label className={labelClass}>
              {staticMode ? "Overview Stats" : "Match Info"}
            </label>
            <div className="text-[11px] text-[#444] flex flex-col gap-1">
              <div className="flex justify-between">
                <span>Total Events</span>
                <span className="text-[#666]">{combinedEvents.length.toLocaleString()}</span>
              </div>
              {staticMode && (
                <div className="flex justify-between">
                  <span>Matches</span>
                  <span className="text-[#666]">{selectedMatches.length}</span>
                </div>
              )}
              {!staticMode && (
                <div className="flex justify-between">
                  <span>Duration</span>
                  <span className="text-[#666]">{formatTs(maxTs)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Unique Players</span>
                <span className="text-[#666]">{new Set(combinedEvents.map(e => e.user_id)).size}</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}