import { useState, useEffect, useMemo } from "react";

const ALL_EVENT_TYPES = ["Position", "BotPosition", "Kill", "BotKill", "Killed", "BotKilled", "KilledByStorm", "Loot"];
export { ALL_EVENT_TYPES };
import Sidebar from "./components/Sidebar";
import MapCanvas from "./components/MapCanvas";
import EventPanel from "./components/EventPanel";

export default function App() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [selectedMap, setSelectedMap] = useState("");
  const [selectedDates, setSelectedDates] = useState([]);   // array
  const [selectedMatches, setSelectedMatches] = useState([]); // array

  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [currentTs, setCurrentTs] = useState(0);
  const [maxTs, setMaxTs] = useState(0);

  const [selectedEventTypes, setSelectedEventTypes] = useState([...ALL_EVENT_TYPES]);
  const [selectedEvent, setSelectedEvent] = useState(null); // clicked event for inspector

  const [trialMode, setTrialMode] = useState(false);
  const [trialEvents, setTrialEvents] = useState(null);
  const [trialMap, setTrialMap] = useState("");

  const loadTrial = () => {
    fetch(import.meta.env.BASE_URL + "trial_data.json")
      .then((r) => r.json())
      .then((d) => {
        setTrialMap(d.map);
        setTrialEvents(d.events);
        setTrialMode(true);
        setMaxTs(Math.max(...d.events.map((e) => e.ts_ms)));
        setCurrentTs(0);
        setIsPlaying(false);
      });
  };

  useEffect(() => {
    fetch(import.meta.env.BASE_URL + "master_data.json")
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, []);

  // Collect events from ALL selected matches across ALL selected dates
  // Enrich each event with _date and _matchId for the inspector panel
  const combinedEvents = useMemo(() => {
    if (trialMode) return trialEvents;
    if (!data || !selectedMap || selectedDates.length === 0 || selectedMatches.length === 0)
      return null;

    const all = [];
    for (const date of selectedDates) {
      const dateData = data[selectedMap]?.[date];
      if (!dateData) continue;
      for (const matchId of selectedMatches) {
        const events = dateData[matchId];
        if (events) {
          for (const ev of events) {
            all.push({ ...ev, _date: date, _matchId: matchId });
          }
        }
      }
    }
    return all.length > 0 ? all : null;
  }, [data, selectedMap, selectedDates, selectedMatches, trialMode, trialEvents]);

  // Single match for playback mode
  const isSingleMatch = !trialMode && selectedMatches.length === 1 && selectedDates.length === 1;
  const staticMode = !trialMode && (selectedMatches.length > 1 || selectedDates.length > 1);

  // Compute maxTs whenever combinedEvents changes (for single-match playback)
  useEffect(() => {
    if (combinedEvents && isSingleMatch) {
      const max = Math.max(...combinedEvents.map((e) => e.ts_ms));
      setMaxTs(max);
      setCurrentTs(0);
      setIsPlaying(false);
    }
  }, [selectedMatches, selectedDates]);

  return (
    <div className="flex h-screen w-screen bg-[#0a0a0f] text-white overflow-hidden font-mono">
      {/* Header bar */}
      <div className="absolute top-0 left-0 right-0 h-10 bg-[#0d0d14] border-b border-[#1e1e2e] flex items-center px-4 z-10">
        <span className="text-[#ff3a3a] font-bold tracking-widest text-xs uppercase mr-2">LILA BLACK</span>
        <span className="text-[#333] mx-2">|</span>
        <span className="text-[#555] text-xs tracking-widest uppercase">
          {staticMode ? "Match Overview Visualizer" : "Match Playback Visualizer"}
        </span>
        {loading && (
          <span className="ml-auto text-[#ff3a3a] text-xs animate-pulse">Loading data...</span>
        )}
        {error && (
          <span className="ml-auto text-red-500 text-xs">Error: {error}</span>
        )}
      </div>

      {/* Layout */}
      <div className="flex w-full pt-10">
        <Sidebar
          data={data}
          selectedMap={selectedMap}
          setSelectedMap={(v) => {
            setSelectedMap(v);
            setSelectedDates([]);
            setSelectedMatches([]);
            setTrialMode(false);
          }}
          selectedDates={selectedDates}
          setSelectedDates={(v) => { setSelectedDates(v); setSelectedMatches([]); }}
          selectedMatches={selectedMatches}
          setSelectedMatches={setSelectedMatches}
          isPlaying={isPlaying}
          setIsPlaying={setIsPlaying}
          speed={speed}
          setSpeed={setSpeed}
          currentTs={currentTs}
          setCurrentTs={setCurrentTs}
          maxTs={maxTs}
          combinedEvents={combinedEvents}
          isSingleMatch={isSingleMatch}
          staticMode={staticMode}
          loadTrial={loadTrial}
          trialMode={trialMode}
          selectedEventTypes={selectedEventTypes}
          setSelectedEventTypes={setSelectedEventTypes}
        />

        {/* Canvas area */}
        <div className="flex-1 flex items-center justify-center bg-[#07070d] relative">
          {!combinedEvents ? (
            <div className="flex flex-col items-center gap-3 text-[#333]">
              <div className="w-16 h-16 border border-[#1e1e2e] flex items-center justify-center">
                <span className="text-2xl">◈</span>
              </div>
              <p className="text-xs tracking-widest uppercase">Select a match to begin</p>
            </div>
          ) : (
            <>
              <MapCanvas
                matchEvents={combinedEvents}
                selectedMap={trialMode ? trialMap : selectedMap}
                isPlaying={isPlaying}
                setIsPlaying={setIsPlaying}
                speed={speed}
                currentTs={currentTs}
                setCurrentTs={setCurrentTs}
                maxTs={maxTs}
                staticMode={staticMode}
                selectedEventTypes={selectedEventTypes}
                onEventClick={setSelectedEvent}
              />
              <EventPanel event={selectedEvent} onClose={() => setSelectedEvent(null)} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}