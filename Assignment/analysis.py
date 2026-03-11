import os
import pandas as pd
import pyarrow.parquet as pq
import matplotlib.pyplot as plt
import matplotlib.ticker as ticker
import numpy as np

# ── Config ────────────────────────────────────────────────────────────────────
BASE_DIR = "../player_data/player_data/"
OUTPUT_DIR = "analysis_output"
os.makedirs(OUTPUT_DIR, exist_ok=True)

# ── Load Data (same as pipeline.py) ──────────────────────────────────────────
def load_data():
    print("Loading data...")
    frames = []
    for folder_name in sorted(os.listdir(BASE_DIR)):
        if not folder_name.startswith("February_"):
            continue
        folder_path = os.path.join(BASE_DIR, folder_name)
        if not os.path.isdir(folder_path):
            continue
        print(f"  Reading {folder_name}...")
        for file_name in os.listdir(folder_path):
            if not file_name.endswith(".nakama-0"):
                continue
            file_path = os.path.join(folder_path, file_name)
            try:
                df = pq.read_table(file_path).to_pandas()
                df['date_folder'] = folder_name
                frames.append(df)
            except Exception as e:
                print(f"  Error reading {file_name}: {e}")

    master_df = pd.concat(frames, ignore_index=True)
    master_df['event'] = master_df['event'].apply(
        lambda x: x.decode('utf-8') if isinstance(x, bytes) else x
    )
    master_df['is_bot'] = master_df['user_id'].astype(str).str.isnumeric()
    master_df['ts_ms'] = master_df['ts'].astype('int64')

    # Strip .nakama-0 suffix from match_id for cleaner grouping
    master_df['match_id_clean'] = master_df['match_id'].str.replace(r'\.nakama-0$', '', regex=True)

    print(f"Loaded {len(master_df):,} rows across {master_df['match_id_clean'].nunique()} matches.\n")
    return master_df


# ── Plot Helpers ──────────────────────────────────────────────────────────────
STYLE = {
    'human_color': '#4C9BE8',
    'bot_color':   '#E8834C',
    'neutral':     '#7C6FCD',
    'bg':          '#1A1A2E',
    'panel':       '#16213E',
    'text':        '#E0E0E0',
    'grid':        '#2A2A4A',
}

def apply_dark_style(fig, axes):
    fig.patch.set_facecolor(STYLE['bg'])
    for ax in (axes if hasattr(axes, '__iter__') else [axes]):
        ax.set_facecolor(STYLE['panel'])
        ax.tick_params(colors=STYLE['text'])
        ax.xaxis.label.set_color(STYLE['text'])
        ax.yaxis.label.set_color(STYLE['text'])
        ax.title.set_color(STYLE['text'])
        for spine in ax.spines.values():
            spine.set_edgecolor(STYLE['grid'])
        ax.grid(color=STYLE['grid'], linestyle='--', linewidth=0.5, alpha=0.7)

def save(fig, name):
    path = os.path.join(OUTPUT_DIR, name)
    fig.savefig(path, dpi=150, bbox_inches='tight', facecolor=fig.get_facecolor())
    print(f"  Saved → {path}")
    plt.close(fig)


# ── Analysis 1: Events per Match ─────────────────────────────────────────────
def plot_events_per_match(master_df):
    print("1. Events per match...")
    events_per_match = master_df.groupby('match_id_clean').size()

    fig, ax = plt.subplots(figsize=(10, 5))
    ax.hist(events_per_match, bins=50, color=STYLE['neutral'], edgecolor='none', alpha=0.85)
    ax.axvline(events_per_match.median(), color='#FFD700', linestyle='--', linewidth=1.5,
               label=f'Median: {events_per_match.median():.0f}')
    ax.axvline(events_per_match.mean(), color='#FF6B6B', linestyle='--', linewidth=1.5,
               label=f'Mean: {events_per_match.mean():.0f}')
    ax.set_xlabel('Total Events in Match')
    ax.set_ylabel('Number of Matches')
    ax.set_title('Distribution of Events per Match')
    ax.legend(facecolor=STYLE['panel'], labelcolor=STYLE['text'])
    apply_dark_style(fig, ax)
    save(fig, '1_events_per_match.png')


# ── Analysis 2: Players per Match (Humans vs Bots) ───────────────────────────
def plot_players_per_match(master_df):
    print("2. Players per match (humans vs bots)...")
    player_counts = (
        master_df.groupby(['match_id_clean', 'is_bot'])['user_id']
        .nunique()
        .unstack(fill_value=0)
        .rename(columns={False: 'humans', True: 'bots'})
    )

    fig, axes = plt.subplots(1, 2, figsize=(14, 5))
    fig.suptitle('Players per Match: Humans vs Bots', color=STYLE['text'], fontsize=13)

    for ax, col, color, label in zip(
        axes,
        ['humans', 'bots'],
        [STYLE['human_color'], STYLE['bot_color']],
        ['Human Players', 'Bot Players']
    ):
        data = player_counts[col] if col in player_counts.columns else pd.Series([0])
        ax.hist(data, bins=30, color=color, edgecolor='none', alpha=0.85)
        ax.axvline(data.median(), color='#FFD700', linestyle='--', linewidth=1.5,
                   label=f'Median: {data.median():.0f}')
        ax.set_xlabel(f'Number of {label} per Match')
        ax.set_ylabel('Number of Matches')
        ax.set_title(label)
        ax.legend(facecolor=STYLE['panel'], labelcolor=STYLE['text'])

    apply_dark_style(fig, axes)
    save(fig, '2_players_per_match.png')


# ── Analysis 3: Events per User per Match ────────────────────────────────────
def plot_events_per_user_per_match(master_df):
    print("3. Events per user per match (humans vs bots)...")
    epu = master_df.groupby(['match_id_clean', 'user_id', 'is_bot']).size().reset_index(name='event_count')

    humans = epu[epu['is_bot'] == False]['event_count']
    bots   = epu[epu['is_bot'] == True]['event_count']

    fig, axes = plt.subplots(1, 2, figsize=(14, 5))
    fig.suptitle('Events per User per Match', color=STYLE['text'], fontsize=13)

    for ax, data, color, label in zip(
        axes,
        [humans, bots],
        [STYLE['human_color'], STYLE['bot_color']],
        ['Humans', 'Bots']
    ):
        ax.hist(data, bins=60, color=color, edgecolor='none', alpha=0.85)
        ax.axvline(data.median(), color='#FFD700', linestyle='--', linewidth=1.5,
                   label=f'Median: {data.median():.0f}')
        ax.axvline(data.mean(), color='#FF6B6B', linestyle='--', linewidth=1.5,
                   label=f'Mean: {data.mean():.0f}')
        ax.set_xlabel('Event Count')
        ax.set_ylabel('Number of (User, Match) pairs')
        ax.set_title(f'{label} — Event Count Distribution')
        ax.legend(facecolor=STYLE['panel'], labelcolor=STYLE['text'])

    apply_dark_style(fig, axes)
    save(fig, '3_events_per_user_per_match.png')


# ── Analysis 4: Event Type Distribution ──────────────────────────────────────
def plot_event_distribution(master_df):
    print("4. Event type distribution...")

    # Overall bar chart
    overall = master_df['event'].value_counts()
    fig, ax = plt.subplots(figsize=(10, 5))
    bars = ax.bar(overall.index, overall.values, color=STYLE['neutral'], edgecolor='none', alpha=0.85)
    ax.set_xlabel('Event Type')
    ax.set_ylabel('Total Count')
    ax.set_title('Overall Event Type Distribution')
    ax.yaxis.set_major_formatter(ticker.FuncFormatter(lambda x, _: f'{int(x):,}'))
    for bar, val in zip(bars, overall.values):
        ax.text(bar.get_x() + bar.get_width() / 2, bar.get_height() * 1.01,
                f'{val:,}', ha='center', va='bottom', fontsize=8, color=STYLE['text'])
    apply_dark_style(fig, ax)
    save(fig, '4a_event_distribution_overall.png')

    # Per-match proportion boxplot (excluding Position/BotPosition to see combat/loot spread)
    combat_events = ['Kill', 'Killed', 'BotKill', 'BotKilled', 'KilledByStorm', 'Loot']
    combat_df = master_df[master_df['event'].isin(combat_events)]
    per_match_counts = (
        combat_df.groupby(['match_id_clean', 'event']).size()
        .unstack(fill_value=0)
    )
    # Add any missing columns
    for e in combat_events:
        if e not in per_match_counts.columns:
            per_match_counts[e] = 0
    per_match_counts = per_match_counts[combat_events]

    fig, ax = plt.subplots(figsize=(11, 5))
    bp = ax.boxplot(
        [per_match_counts[e] for e in combat_events],
        labels=combat_events,
        patch_artist=True,
        medianprops=dict(color='#FFD700', linewidth=2),
        whiskerprops=dict(color=STYLE['text']),
        capprops=dict(color=STYLE['text']),
        flierprops=dict(marker='o', color=STYLE['neutral'], alpha=0.3, markersize=3)
    )
    colors = ['#4C9BE8', '#E84C4C', '#4CE88A', '#E8834C', '#E84CA0', '#A0E84C']
    for patch, color in zip(bp['boxes'], colors):
        patch.set_facecolor(color)
        patch.set_alpha(0.7)
    ax.set_xlabel('Event Type')
    ax.set_ylabel('Count per Match')
    ax.set_title('Combat & Loot Events — Per-Match Distribution (Boxplot)')
    apply_dark_style(fig, ax)
    save(fig, '4b_event_distribution_per_match_boxplot.png')


# ── Analysis 5 & 6: Match Duration + Full vs Partial Flag ────────────────────
def plot_match_duration(master_df):
    print("5 & 6. Match duration + full vs partial...")
    duration = master_df.groupby('match_id_clean')['ts_ms'].agg(
        lambda x: x.max() - x.min()
    ).rename('duration_ms')

    duration_min = duration / 60_000  # convert to minutes for readability

    # Determine threshold: use a natural break — e.g. bottom 10th percentile
    threshold_min = duration_min.quantile(0.10)
    is_partial = duration_min < threshold_min

    print(f"  Duration range: {duration_min.min():.1f} – {duration_min.max():.1f} min")
    print(f"  Partial threshold (p10): {threshold_min:.1f} min → {is_partial.sum()} partial matches flagged")

    fig, ax = plt.subplots(figsize=(11, 5))

    full_durations    = duration_min[~is_partial]
    partial_durations = duration_min[is_partial]

    ax.hist(full_durations,    bins=50, color=STYLE['human_color'], edgecolor='none',
            alpha=0.85, label=f'Full matches ({len(full_durations)})')
    ax.hist(partial_durations, bins=20, color=STYLE['bot_color'],   edgecolor='none',
            alpha=0.85, label=f'Partial / short matches ({len(partial_durations)})')
    ax.axvline(threshold_min, color='#FFD700', linestyle='--', linewidth=1.5,
               label=f'Partial threshold: {threshold_min:.1f} min (p10)')
    ax.axvline(duration_min.median(), color='#FF6B6B', linestyle='--', linewidth=1.5,
               label=f'Median: {duration_min.median():.1f} min')

    ax.set_xlabel('Match Duration (minutes)')
    ax.set_ylabel('Number of Matches')
    ax.set_title('Match Duration Distribution — Full vs Partial')
    ax.legend(facecolor=STYLE['panel'], labelcolor=STYLE['text'])
    apply_dark_style(fig, ax)
    save(fig, '5_match_duration_full_vs_partial.png')

def export_excel(master_df):
    print("Exporting Excel...")
    path = os.path.join(OUTPUT_DIR, 'analysis.xlsx')

    # Sheet 1: Events per match
    s1 = master_df.groupby('match_id_clean').size().reset_index(name='event_count')

    # Sheet 2: Players per match
    s2 = (
        master_df.groupby(['match_id_clean', 'is_bot'])['user_id']
        .nunique().unstack(fill_value=0)
        .rename(columns={False: 'human_count', True: 'bot_count'})
        .reset_index()
    )

    # Sheet 3: Events per user per match
    s3 = (
        master_df.groupby(['match_id_clean', 'user_id', 'is_bot'])
        .size().reset_index(name='event_count')
    )

    # Sheet 4: Event type distribution
    overall = master_df['event'].value_counts().rename('total_count')
    per_match = master_df.groupby(['match_id_clean', 'event']).size().unstack(fill_value=0)
    s4 = pd.DataFrame({
        'total_count': overall,
        'per_match_mean':   per_match.mean().round(2),
        'per_match_median': per_match.median(),
    }).reset_index().rename(columns={'index': 'event_type'})

    # Sheet 5: Match duration
    duration = master_df.groupby('match_id_clean')['ts_ms'].agg(lambda x: x.max() - x.min())
    duration_min = duration / 60_000
    threshold = duration_min.quantile(0.10)
    s5 = pd.DataFrame({
        'match_id': duration.index,
        'duration_ms': duration.values,
        'duration_min': duration_min.round(2).values,
        'is_partial': (duration_min < threshold).values
    })

    with pd.ExcelWriter(path, engine='openpyxl') as writer:
        s1.to_excel(writer, sheet_name='Events per Match',          index=False)
        s2.to_excel(writer, sheet_name='Players per Match',         index=False)
        s3.to_excel(writer, sheet_name='Events per User per Match', index=False)
        s4.to_excel(writer, sheet_name='Event Type Distribution',   index=False)
        s5.to_excel(writer, sheet_name='Match Duration',            index=False)

    print(f"  Saved → {path}")


# ── Main ──────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    master_df = load_data()

    plot_events_per_match(master_df)
    plot_players_per_match(master_df)
    plot_events_per_user_per_match(master_df)
    plot_event_distribution(master_df)
    plot_match_duration(master_df)
    export_excel(master_df)

    print(f"\nAll done. Check the '{OUTPUT_DIR}/' folder for your graphs.")