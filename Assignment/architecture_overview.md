# Architecture Overview

## Tech Stack Choices
The application is built as a **Zero-Backend Thick Client**.

*   **React 18 & Vite:** Chosen for rapid UI development, robust state management, and an extremely fast local development experience with optimized production bundling.
*   **Tailwind CSS:** Enables rapid, inline utility-based styling, keeping the UI visually consistent without the overhead of managing separate CSS files or heavy component libraries.
*   **HTML5 Canvas (2D Context):** Essential for performance. Standard DOM elements (like SVG) choke when rendering thousands of moving event nodes simultaneously. Canvas paints pixels directly, easily handling the high density of events required for the multi-match static overview mode.
*   **GitHub Pages:** Chosen for zero-maintenance deployment. Since all data processing happens locally and the app is static, no live backend server is required.

## Data Flow: Parquet to UI
1.  **Raw Data Processing (Offline):** Raw telemetry data originates as Parquet files. An offline data preparation script (likely Python/Pandas) reads these files, cleans the data, sorts events chronologically, and groups them hierarchically by `Map -> Date -> Match ID`.
2.  **Static JSON Generation:** The processed data is serialized into a highly structured, single [master_data.json](file:///home/ayushsahu/Desktop/LILA%20Games%202/Assignment/master_data.json) file.
3.  **Client Ingestion:** On initial load, the React app fetches [master_data.json](file:///home/ayushsahu/Desktop/LILA%20Games%202/Assignment/master_data.json).
4.  **State & Filtering:** User selections (maps, dates, matches, event types) update React state. `useMemo` hooks efficiently slice the JSON tree to derive a flattened, filtered array of events relevant to the current view.
5.  **Rendering:** 
    *   *Playback Mode:* A `requestAnimationFrame` loop iteratively draws events up to the current timestamp.
    *   *Static Mode:* A single `drawStatic()` pass renders all selected events simultaneously onto the canvas map.

## Trade-offs Made
*   **Zero-Backend vs. API Driven:** 
    *   *Trade-off:* We ship a large [master_data.json](file:///home/ayushsahu/Desktop/LILA%20Games%202/Assignment/master_data.json) payload directly to the browser instead of querying a database via an API.
    *   *Reasoning:* It dramatically simplifies deployment and hosting (static only). More importantly, it keeps UI interactions (like toggling filters or scrubbing time) instantaneous since the data is already in RAM, avoiding network latency on every click.
*   **Canvas 2D vs. WebGL:** 
    *   *Trade-off:* We used Canvas 2D instead of GPU-accelerated WebGL.
    *   *Reasoning:* WebGL scales to millions of particles, but Canvas 2D is much faster to implement and perfectly capable of handling the current scale of tens of thousands of events without dropping frames.
*   **In-Memory Filtering:** 
    *   *Trade-off:* Filtering is done client-side on the fly.
    *   *Reasoning:* If the dataset grows to hundreds of megabytes, parsing JSON will freeze the browser tab. However, for the current scope, it provides the most fluid user experience.

## Future Improvements (With More Time)
If given more time, I would implement the following:
1.  **Data Chunking / Streaming:** Instead of loading one monolithic [master_data.json](file:///home/ayushsahu/Desktop/LILA%20Games%202/Assignment/master_data.json), load a high-level metadata index first, and then dynamically fetch individual match files (`[match_id].json`) on demand. This would drastically reduce initial load times and prevent memory overflow as the dataset grows.
2.  **Binary Formats:** Move away from JSON to a binary format (like FlatBuffers or sending Parquet directly to the browser using DuckDB-Wasm) to cut transfer sizes and eliminate JSON parsing overhead.
3.  **Spatial Indexing (Quadtrees):** For the click-to-inspect feature, currently, it iterates over all visible events to find the nearest point. Implementing an in-memory Quadtree would make hit-testing $O(\log n)$ instead of $O(n)$, crucial for maintaining click responsiveness when heavily zoomed out in static mode.
4.  **WebGL Rendering:** Transition to Pixi.js or Three.js if the visualization requirements move toward heatmaps or analyzing entire seasons of data simultaneously, where Canvas 2D would bottleneck.
