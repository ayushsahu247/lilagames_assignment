import os
import pandas as pd
import pyarrow.parquet as pq
import matplotlib.pyplot as plt
import seaborn as sns

# 1. Configuration 
BASE_DIR = "../player_data/player_data/"
OUTPUT_DIR = "analysis_gemini"

def load_and_clean_data():
    print("Loading data...")
    all_frames = []
    
    # Iterate through the date folders
    for folder_name in os.listdir(BASE_DIR):
        if not folder_name.startswith("February_"):
            continue
            
        folder_path = os.path.join(BASE_DIR, folder_name)
        if not os.path.isdir(folder_path):
            continue
            
        for file_name in os.listdir(folder_path):
            if not file_name.endswith(".nakama-0"):
                continue
                
            file_path = os.path.join(folder_path, file_name)
            try:
                df = pq.read_table(file_path).to_pandas()
                all_frames.append(df)
            except Exception:
                continue

    master_df = pd.concat(all_frames, ignore_index=True)
    
    # Decoding and typing
    master_df['event'] = master_df['event'].apply(lambda x: x.decode('utf-8') if isinstance(x, bytes) else x)
    master_df['is_bot'] = master_df['user_id'].astype(str).str.isnumeric()
    
    # Convert timestamp to milliseconds if it isn't already
    master_df['ts_ms'] = master_df['ts'].astype('int64') // 10**6 
    
    return master_df

def generate_reports_and_plots(df):
    print(f"Creating output directory: {OUTPUT_DIR}/")
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    excel_path = os.path.join(OUTPUT_DIR, "lila_black_analysis.xlsx")
    
    # Set a clean aesthetic for the charts
    sns.set_theme(style="whitegrid")
    
    print("Analyzing data and generating exports...")
    
    with pd.ExcelWriter(excel_path, engine='openpyxl') as writer:
        
        # --- 1. Events per match ---
        events_per_match = df.groupby('match_id').size()
        events_per_match.describe().to_frame(name='Events per Match').to_excel(writer, sheet_name='Events_Per_Match')
        
        plt.figure(figsize=(10, 6))
        sns.histplot(events_per_match, bins=50, kde=True, color='royalblue')
        plt.title('Distribution of Events per Match')
        plt.xlabel('Number of Events')
        plt.ylabel('Frequency (Matches)')
        plt.tight_layout()
        plt.savefig(os.path.join(OUTPUT_DIR, '1_events_per_match_dist.png'), dpi=300)
        plt.close()

        # --- 2. Players per match (Humans vs Bots) ---
        unique_players = df[['match_id', 'user_id', 'is_bot']].drop_duplicates()
        players_per_match = unique_players.groupby(['match_id', 'is_bot']).size().unstack(fill_value=0)
        humans_col = players_per_match.get(False, pd.Series(0, index=players_per_match.index))
        bots_col = players_per_match.get(True, pd.Series(0, index=players_per_match.index))
        player_breakdown = pd.DataFrame({'Humans': humans_col, 'Bots': bots_col, 'Total': humans_col + bots_col})
        
        player_breakdown.describe().to_excel(writer, sheet_name='Players_Per_Match')
        
        plt.figure(figsize=(10, 6))
        sns.histplot(data=player_breakdown[['Humans', 'Bots']], bins=20, multiple="stack", palette=['#2ecc71', '#e74c3c'])
        plt.title('Distribution of Humans and Bots per Match')
        plt.xlabel('Number of Players')
        plt.ylabel('Frequency (Matches)')
        plt.tight_layout()
        plt.savefig(os.path.join(OUTPUT_DIR, '2_players_per_match_stacked.png'), dpi=300)
        plt.close()

        # --- 3. Events per user per match ---
        events_per_user_match = df.groupby(['match_id', 'user_id']).size()
        events_per_user_match.describe().to_frame(name='Events per User per Match').to_excel(writer, sheet_name='Events_Per_User')
        
        # We cap this at the 95th percentile for the plot, otherwise, players who survive the whole match 
        # (generating thousands of Position events) will completely crush the visibility of early-death players.
        cap = events_per_user_match.quantile(0.95)
        plt.figure(figsize=(10, 6))
        sns.histplot(events_per_user_match[events_per_user_match <= cap], bins=50, color='purple')
        plt.title(f'Events per User per Match (Capped at 95th Percentile: {int(cap)})')
        plt.xlabel('Number of Events')
        plt.ylabel('Frequency')
        plt.tight_layout()
        plt.savefig(os.path.join(OUTPUT_DIR, '3_events_per_user_dist.png'), dpi=300)
        plt.close()

        # --- 4. Event type distribution ---
        overall_events = df['event'].value_counts()
        overall_events_pct = (df['event'].value_counts(normalize=True) * 100).round(2)
        event_dist_df = pd.DataFrame({'Count': overall_events, 'Percentage (%)': overall_events_pct})
        event_dist_df.to_excel(writer, sheet_name='Event_Types')
        
        plt.figure(figsize=(12, 6))
        # Log scale used here because 'Position' and 'BotPosition' will dwarf combat/loot events
        sns.barplot(x=overall_events.index, y=overall_events.values, hue=overall_events.index, palette='viridis', legend=False)
        plt.yscale('log')
        plt.title('Overall Event Type Distribution (Log Scale)')
        plt.xlabel('Event Type')
        plt.ylabel('Count (Log Scale)')
        plt.xticks(rotation=45)
        plt.tight_layout()
        plt.savefig(os.path.join(OUTPUT_DIR, '4_event_type_distribution.png'), dpi=300)
        plt.close()

        # --- 5 & 6. Match durations and Full vs Partial ---
        match_durations = df.groupby('match_id')['ts_ms'].agg(['min', 'max'])
        match_durations['duration_ms'] = match_durations['max'] - match_durations['min']
        match_durations['duration_minutes'] = match_durations['duration_ms'] / (1000 * 60)
        
        match_durations['duration_minutes'].describe().to_frame(name='Duration (Minutes)').to_excel(writer, sheet_name='Match_Durations')
        
        plt.figure(figsize=(10, 6))
        sns.histplot(match_durations['duration_minutes'], bins=40, color='coral', kde=True)
        plt.title('Distribution of Match Durations')
        plt.xlabel('Duration (Minutes)')
        plt.ylabel('Frequency (Matches)')
        plt.axvline(x=3.0, color='red', linestyle='--', label='3 Min Threshold (Likely Snapshot)')
        plt.legend()
        plt.tight_layout()
        plt.savefig(os.path.join(OUTPUT_DIR, '5_match_durations_dist.png'), dpi=300)
        plt.close()
        
        # Summary of partial vs full games logic saved to its own sheet
        matches_with_storm_deaths = df[df['event'] == 'KilledByStorm']['match_id'].unique()
        short_matches = match_durations[match_durations['duration_minutes'] < 3.0]
        full_games = match_durations[(match_durations['duration_minutes'] > 10.0) | (match_durations.index.isin(matches_with_storm_deaths))]
        
        summary_data = {
            'Metric': [
                'Total Matches', 
                'Potential Partial Snapshots (< 3 mins)', 
                'Confirmed Late-Game (Contains Storm Deaths)', 
                'Likely Full Games (> 10 mins or Storm Deaths)'
            ],
            'Count': [
                len(match_durations), 
                len(short_matches), 
                len(matches_with_storm_deaths), 
                len(full_games)
            ]
        }
        pd.DataFrame(summary_data).to_excel(writer, sheet_name='Completeness_Summary', index=False)

    print(f"Success! Excel report and 5 plots saved to '{OUTPUT_DIR}/'.")

if __name__ == "__main__":
    df = load_and_clean_data()
    if not df.empty:
        generate_reports_and_plots(df)
    else:
        print("Dataframe is empty. Check your BASE_DIR path.")