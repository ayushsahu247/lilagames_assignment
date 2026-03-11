import pyarrow.parquet as pq
import pandas as pd
import os

# Read a single file
table = pq.read_table("February_10/f4e072fa_b71aaad8.nakama-0")
df = table.to_pandas()

# Decode event column from bytes to string
df['event'] = df['event'].apply(lambda x: x.decode('utf-8') if isinstance(x, bytes) else x)

# Read all files from a day into one DataFrame
def load_day(folder):
    frames = []
    for f in os.listdir(folder):
        filepath = os.path.join(folder, f)
        try:
            t = pq.read_table(filepath)
            frames.append(t.to_pandas())
        except:
            continue
    return pd.concat(frames, ignore_index=True)

df_feb10 = load_day("February_10")