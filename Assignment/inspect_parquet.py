import pyarrow.parquet as pq
import os
import json

BASE_DIR = "../player_data/player_data/"
OUTPUT_FILE = "trial_data.json"

# Pick the first parquet file from February_10
date_folder = "February_10"
folder_path = os.path.join(BASE_DIR, date_folder)
files = [f for f in os.listdir(folder_path) if f.endswith(".nakama-0")]
first_file = files[0]

print(f"Reading file: {first_file}")
df = pq.read_table(os.path.join(folder_path, first_file)).to_pandas()

print(f"Total rows: {len(df)}")
print(f"Columns: {df.columns.tolist()}")
print(f"Unique match_ids: {df['match_id'].nunique()}")
print(f"Unique user_ids: {df['user_id'].nunique()}")
print(f"Unique events: {df['event'].unique()}")
print(f"ts min: {df['ts'].min()}, ts max: {df['ts'].max()}")
print(f"\nSample rows:\n{df.head(5)}")

# Pick one player from this file
sample_user = df['user_id'].iloc[0]
player_df = df[df['user_id'] == sample_user].copy()
print(f"\nPicked user: {sample_user}, events: {len(player_df)}")

# Detect map
map_id = player_df['map_id'].iloc[0]
print(f"Map: {map_id}")

MAP_CONSTANTS = {
    "AmbroseValley": {"scale": 900, "origin_x": -370, "origin_z": -473},
    "GrandRift":     {"scale": 581, "origin_x": -290, "origin_z": -290},
    "Lockdown":      {"scale": 1000, "origin_x": -500, "origin_z": -500}
}

constants = MAP_CONSTANTS.get(map_id, {"scale": 1, "origin_x": 0, "origin_z": 0})

# Coordinate math
player_df['event'] = player_df['event'].apply(lambda x: x.decode('utf-8') if isinstance(x, bytes) else x)
player_df['is_bot'] = player_df['user_id'].astype(str).str.isnumeric()
player_df['ts_ms'] = player_df['ts'].astype('int64')

player_df['u'] = (player_df['x'] - constants['origin_x']) / constants['scale']
player_df['v'] = (player_df['z'] - constants['origin_z']) / constants['scale']
player_df['pixel_x'] = (player_df['u'] * 1024).round().astype(int)
player_df['pixel_y'] = ((1 - player_df['v']) * 1024).round().astype(int)

# Normalize ts_ms to start from 0
min_ts = player_df['ts_ms'].min()
player_df['ts_ms'] = player_df['ts_ms'] - min_ts

player_df = player_df.sort_values('ts_ms')

records = player_df[['user_id', 'is_bot', 'event', 'pixel_x', 'pixel_y', 'ts_ms']].to_dict(orient='records')

output = {
    "map": map_id,
    "match_id": player_df['match_id'].iloc[0],
    "user_id": str(sample_user),
    "events": records
}

with open(OUTPUT_FILE, 'w') as f:
    json.dump(output, f, indent=2)

print(f"\nSaved {len(records)} events to {OUTPUT_FILE}")
print(f"ts_ms range: 0 to {player_df['ts_ms'].max()}ms")