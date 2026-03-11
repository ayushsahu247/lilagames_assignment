import os
import json
import pandas as pd
import pyarrow.parquet as pq

# 1. Configuration & Constants based on README
BASE_DIR = "../player_data/player_data/"
OUTPUT_FILE = "master_data.json"

MAP_CONSTANTS = {
    "AmbroseValley": {"scale": 900, "origin_x": -370, "origin_z": -473},
    "GrandRift": {"scale": 581, "origin_x": -290, "origin_z": -290},
    "Lockdown": {"scale": 1000, "origin_x": -500, "origin_z": -500}
}

def process_data():
    print("Starting data processing...")
    all_frames = []
    
    # 2. Iterate through the date folders
    for folder_name in os.listdir(BASE_DIR):
        if not folder_name.startswith("February_"):
            continue
            
        folder_path = os.path.join(BASE_DIR, folder_name)
        if not os.path.isdir(folder_path):
            continue
            
        print(f"Reading files in {folder_name}...")
        for file_name in os.listdir(folder_path):
            if not file_name.endswith(".nakama-0"):
                continue
                
            file_path = os.path.join(folder_path, file_name)
            
            try:
                # Read parquet and convert to pandas
                df = pq.read_table(file_path).to_pandas()
                df['date_folder'] = folder_name # Tag with date folder for JSON structure
                all_frames.append(df)
            except Exception as e:
                print(f"Error reading {file_name}: {e}")

    # Combine all matches into one massive DataFrame for fast vectorized math
    print("Combining data...")
    master_df = pd.concat(all_frames, ignore_index=True)
    
    # 3. Clean and Transform Data
    print("Decoding bytes and identifying bots...")
    # Decode event from bytes to string
    master_df['event'] = master_df['event'].apply(lambda x: x.decode('utf-8') if isinstance(x, bytes) else x)
    
    # Identify bots (Humans have UUIDs, bots have numeric IDs)
    master_df['is_bot'] = master_df['user_id'].astype(str).str.isnumeric()
    
    # Ensure timestamp is a standard integer (milliseconds) for easy frontend sorting
    master_df['ts_ms'] = master_df['ts'].astype('int64')
    
    # 4. Apply Coordinate Math (Vectorized)
    print("Calculating minimap pixel coordinates...")
    # Map the constants to the dataframe based on map_id
    master_df['scale'] = master_df['map_id'].map(lambda x: MAP_CONSTANTS.get(x, {}).get('scale', 1))
    master_df['origin_x'] = master_df['map_id'].map(lambda x: MAP_CONSTANTS.get(x, {}).get('origin_x', 0))
    master_df['origin_z'] = master_df['map_id'].map(lambda x: MAP_CONSTANTS.get(x, {}).get('origin_z', 0))
    
    # Calculate U and V
    master_df['u'] = (master_df['x'] - master_df['origin_x']) / master_df['scale']
    master_df['v'] = (master_df['z'] - master_df['origin_z']) / master_df['scale']
    
    # Calculate Pixel X and Pixel Y (rounded to integers for smaller JSON size & canvas rendering)
    master_df['pixel_x'] = (master_df['u'] * 1024).round().astype(int)
    master_df['pixel_y'] = ((1 - master_df['v']) * 1024).round().astype(int)

    # 5. Build the Nested JSON Structure: { MapName: { DateFolder: { MatchID: [ events ] } } }
    print("Structuring final JSON...")
    final_dict = {}
    
    # Grouping by the hierarchy
    for map_id, map_group in master_df.groupby('map_id'):
        final_dict[map_id] = {}
        for date_folder, date_group in map_group.groupby('date_folder'):
            final_dict[map_id][date_folder] = {}
            for match_id, match_group in date_group.groupby('match_id'):
                
                # Sort by timestamp to ensure chronological playback
                match_group = match_group.sort_values('ts_ms')
                match_group['ts_ms'] = match_group['ts_ms'] - match_group['ts_ms'].min()

                
                # Keep only what the frontend actually needs to draw the canvas
                records = match_group[['user_id', 'is_bot', 'event', 'pixel_x', 'pixel_y', 'ts_ms']].to_dict(orient='records')
                final_dict[map_id][date_folder][match_id] = records

    # 6. Export to File
    print("Saving to master_data.json...")
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        # Avoid indentations to keep file size as small as possible
        json.dump(final_dict, f, indent=4)
        
    print(f"Success! Final data saved to {OUTPUT_FILE}")

if __name__ == "__main__":
    process_data()