PORAA dataset, 1908-2025 (AL/NL regular season, 199,897 games, ~120k batter outs per modern season)

Built from Retrosheet event files (Chadwick Bureau mirror), parsed with Chadwick cwevent, scored by poraa_build.py.

FILES
PORAA_player_season.csv   one row per batter-season. PORAA, PORAA_within_type, runners-on / RISP / runner-on-2B splits, K, GIDP, PA, per-100-outs and per-600-PA rates.
PORAA_career.csv          career totals.
PORAA_play_level.csv.gz   every scored batter out (~12M rows): states, RE before/after, delta_RE, baseline, PORAA.
PORAA_run_expectancy_matrix.csv  season-specific RE24 matrix (complete half-innings, innings 1-8) with cell counts.
PORAA_baselines.csv       average out delta_RE per season/base/outs cell and its n.
PORAA_coverage_by_season.csv  games, PA, outs, RE(bases empty, 0 out), run totals for sanity checks.

DEFINITIONS
Batter out = PA-ending out/strikeout where the batter is retired (event codes 2 and 3, batter destination 0).
Excluded: reached on error, fielder's choice with batter safe, K+WP/PB reaching, interference.
delta_RE = runs on play + RE(after) - RE(before); 3rd out -> RE 0.
PORAA = delta_RE - average delta_RE of ALL batter outs in the same season/base/outs cell. League sum is 0.
PORAA_within_type = same, but baseline restricted to the same out type (secondary column).
No leverage weighting, no runner-speed or batted-ball adjustment yet.

CAVEATS
Cells with baseline_n < 30 are flagged (small_cell) in the play-level file.
Extra-inning "ghost runner" innings (2020+) are scored against the regular RE matrix.
1994/2020 etc. are shortened seasons; use per-100-outs rates to compare.
Source: The information used here was obtained free of charge from and is copyrighted by Retrosheet. Interested parties may contact Retrosheet at www.retrosheet.org.
