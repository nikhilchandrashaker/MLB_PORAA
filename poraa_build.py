#!/usr/bin/env python3
"""
PORAA v2 builder: Retrosheet event files -> Chadwick cwevent -> PORAA.

Headline PORAA baseline = average ΔRE of ALL batter outs in the same
season / base-state / outs cell. A secondary within-type baseline is also
reported (PORAA_within_type).

Usage: python poraa_build.py --seasons-dir rs/seasons --cwevent bin/cwevent \
        --start 1908 --end 2025 --outdir out
"""
import argparse, io, subprocess, sys
from pathlib import Path
import numpy as np
import pandas as pd

FIELDS = [0, 2, 3, 4, 10, 26, 27, 28, 29, 34, 35, 38, 39, 40, 41, 42, 47, 48, 58, 59, 60, 61, 96]
COLS = ["gid", "inn", "bat_home", "outs", "batter", "r1", "r2", "r3", "event_tx",
        "event_cd", "bat_event", "sh", "sf", "event_outs", "dp", "tp", "bb_type",
        "bunt", "d_bat", "d_r1", "d_r2", "d_r3", "event_num"]
LEAGUES = {"A", "N", "AL", "NL"}
EXCLUDE_TEAMS = {"ALS", "NLS"}  # all-star teams
RETRO_ATTR = ("The information used here was obtained free of charge from and is "
              "copyrighted by Retrosheet. Interested parties may contact Retrosheet "
              "at 20 Sunset Rd., Newark, DE 19711.")


def regular_files(sdir, year):
    d = sdir / str(year)
    team_file = d / f"TEAM{year}"
    if not team_file.exists():
        return []
    ok = set()
    for line in team_file.read_text(errors="ignore").splitlines():
        p = line.strip().split(",")
        if len(p) >= 2 and p[1] in LEAGUES and p[0] not in EXCLUDE_TEAMS:
            ok.add(p[0])
    files = []
    for f in sorted(d.iterdir()):
        n = f.name
        if n.startswith(str(year)) and len(n) == 11 and n[-4:-1] == ".EV":
            if n[4:7] in ok:
                files.append(f)
    return files


def run_cwevent(cw, sdir, year):
    files = regular_files(sdir, year)
    if not files:
        return None
    d = sdir / str(year)
    cmd = [str(cw), "-y", str(year), "-Q", "-D", str(d), "-f", ",".join(map(str, FIELDS))] + \
          [f.name for f in files]
    r = subprocess.run(cmd, cwd=d, capture_output=True, text=True)
    if r.returncode != 0 or not r.stdout:
        print(f"  cwevent failed {year}: {r.stderr[:200]}", file=sys.stderr)
        return None
    df = pd.read_csv(io.StringIO(r.stdout), header=None, names=COLS, quotechar='"',
                     keep_default_na=False, low_memory=False)
    df["season"] = year
    df["n_files"] = len(files)
    return df


def prep(df):
    for c in ["sh", "sf", "dp", "tp", "bat_event", "bunt"]:
        df[c] = df[c].astype(str).str.upper().eq("T")
    for c in ["inn", "bat_home", "outs", "event_cd", "event_outs", "d_bat", "d_r1", "d_r2", "d_r3"]:
        df[c] = pd.to_numeric(df[c], errors="coerce").fillna(0).astype(int)
    r1 = df["r1"].astype(str).str.len() > 0
    r2 = df["r2"].astype(str).str.len() > 0
    r3 = df["r3"].astype(str).str.len() > 0
    df["base_pre"] = r1.astype(int) + 2 * r2.astype(int) + 4 * r3.astype(int)

    # runs scored on the play: destination >= 4 (4 = scored, 5/6 = unearned)
    runs = (df["d_bat"] >= 4).astype(int)
    for rr, dd in ((r1, "d_r1"), (r2, "d_r2"), (r3, "d_r3")):
        runs += (rr & (df[dd] >= 4)).astype(int)
    df["runs"] = runs

    occ = pd.Series(0, index=df.index)
    for dest in (df["d_bat"],):
        pass
    post = pd.Series(0, index=df.index)
    for src_present, dcol in ((True, "d_bat"), (r1, "d_r1"), (r2, "d_r2"), (r3, "d_r3")):
        present = src_present if not isinstance(src_present, bool) else pd.Series(True, index=df.index)
        for base, bit in ((1, 1), (2, 2), (3, 4)):
            post += ((present) & (df[dcol] == base)).astype(int) * bit
    df["base_post"] = post
    df["outs_post"] = (df["outs"] + df["event_outs"]).clip(upper=3)
    return df


def add_re(df):
    """Run expectancy per season from complete half-innings (innings 1-8, 3 outs)."""
    df["half"] = df["gid"] + "_" + df["inn"].astype(str) + "_" + df["bat_home"].astype(str)
    # runs from this event to end of half-inning (rows are chronological)
    rev = df["runs"][::-1].groupby(df["half"][::-1]).cumsum()[::-1]
    df["runs_rest"] = rev
    last_outs = df.groupby("half")["outs_post"].transform("last")
    df["complete"] = (last_outs >= 3) & (df["inn"] <= 8)
    m = (df[df["complete"] & (df["outs"] < 3)]
         .groupby(["season", "base_pre", "outs"])["runs_rest"]
         .agg(RE="mean", n="size").reset_index())
    return m


def score(df, re):
    lk = re.set_index(["season", "base_pre", "outs"])["RE"]
    key_b = pd.MultiIndex.from_arrays([df["season"], df["base_pre"], df["outs"]])
    df["RE_before"] = lk.reindex(key_b).to_numpy()
    key_a = pd.MultiIndex.from_arrays([df["season"], df["base_post"], df["outs_post"].clip(upper=2)])
    df["RE_after"] = np.where(df["outs_post"] >= 3, 0.0, lk.reindex(key_a).to_numpy())
    df["delta_RE"] = df["runs"] + df["RE_after"] - df["RE_before"]

    # batter-made outs: PA-ending generic out or strikeout where the batter is retired
    out = df["bat_event"] & df["event_cd"].isin([2, 3]) & (df["d_bat"] == 0)
    df["is_batter_out"] = out
    t = pd.Series("other", index=df.index)
    t[df["bb_type"] == "G"] = "ground"
    t[df["bb_type"] == "F"] = "fly"
    t[df["bb_type"] == "P"] = "popup"
    t[df["bb_type"] == "L"] = "line"
    t[df["bunt"]] = "bunt"
    t[df["sh"]] = "sac_bunt"
    t[df["sf"]] = "sac_fly"
    t[df["dp"] | df["tp"]] = "double_play"
    t[df["event_cd"] == 3] = "strikeout"
    df["out_type"] = t
    o = df[out & df["delta_RE"].notna()].copy()

    # HEADLINE baseline: all outs in same season / base / outs
    k = ["season", "base_pre", "outs"]
    b = o.groupby(k)["delta_RE"].agg(baseline_all="mean", baseline_n="size").reset_index()
    o = o.merge(b, on=k, how="left")
    o["PORAA"] = o["delta_RE"] - o["baseline_all"]
    # SECONDARY baseline: same out type too
    k2 = k + ["out_type"]
    b2 = o.groupby(k2)["delta_RE"].agg(baseline_type="mean", baseline_type_n="size").reset_index()
    o = o.merge(b2, on=k2, how="left")
    o["PORAA_within_type"] = o["delta_RE"] - o["baseline_type"]
    o["small_cell"] = o["baseline_n"] < 30
    return o, b


def summarize(o, pa):
    o["risp"] = (o["base_pre"] & 6) > 0
    o["on"] = o["base_pre"] > 0
    g = o.groupby(["season", "batter"])
    s = g.agg(outs_scored=("PORAA", "size"), PORAA=("PORAA", "sum"),
              PORAA_within_type=("PORAA_within_type", "sum"),
              strikeouts=("out_type", lambda x: int((x == "strikeout").sum())),
              gidp=("out_type", lambda x: int((x == "double_play").sum())),
              small_cell_outs=("small_cell", "sum")).reset_index()
    for name, mask in (("PORAA_runners_on", o["on"]), ("PORAA_RISP", o["risp"]),
                       ("PORAA_runner_on_2B", (o["base_pre"] & 2) > 0)):
        x = o[mask].groupby(["season", "batter"])["PORAA"].sum().rename(name).reset_index()
        s = s.merge(x, on=["season", "batter"], how="left")
    s[["PORAA_runners_on", "PORAA_RISP", "PORAA_runner_on_2B"]] = \
        s[["PORAA_runners_on", "PORAA_RISP", "PORAA_runner_on_2B"]].fillna(0.0)
    s = s.merge(pa, on=["season", "batter"], how="left")
    s["PORAA_per_100_outs"] = 100 * s["PORAA"] / s["outs_scored"]
    s["PORAA_per_600_PA"] = 600 * s["PORAA"] / s["PA"]
    return s.rename(columns={"batter": "batter_id"})


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--seasons-dir", default="rs/seasons")
    ap.add_argument("--cwevent", default="bin/cwevent")
    ap.add_argument("--start", type=int, default=1908)
    ap.add_argument("--end", type=int, default=2025)
    ap.add_argument("--outdir", default="PORAA_output")
    a = ap.parse_args()
    sdir, outd = Path(a.seasons_dir).resolve(), Path(a.outdir)
    a.cwevent = Path(a.cwevent).resolve()
    outd.mkdir(parents=True, exist_ok=True)

    play_parts, sum_parts, re_parts, base_parts, cov = [], [], [], [], []
    for y in range(a.start, a.end + 1):
        df = run_cwevent(a.cwevent, sdir, y)
        if df is None:
            print(f"{y}: no data"); continue
        df = prep(df)
        re = add_re(df)
        o, b = score(df, re)
        pa = (df[df["bat_event"]].groupby(["season", "batter"]).size().rename("PA").reset_index())
        s = summarize(o, pa)
        keep = ["season", "gid", "inn", "bat_home", "batter", "outs", "base_pre", "outs_post",
                "base_post", "runs", "out_type", "event_tx", "RE_before", "RE_after", "delta_RE",
                "baseline_all", "baseline_n", "PORAA", "baseline_type", "PORAA_within_type", "small_cell"]
        o[keep].to_csv(outd / "PORAA_play_level.csv.gz", mode="wb" if y == a.start else "ab",
                       header=(y == a.start), index=False, compression="gzip")
        sum_parts.append(s); re_parts.append(re); base_parts.append(b)
        cov.append(dict(season=y, files=int(df["n_files"].iloc[0]), games=df["gid"].nunique(),
                        events=len(df), PA=int(df["bat_event"].sum()), outs_scored=len(o),
                        league_RE_000=float(re[(re.base_pre == 0) & (re.outs == 0)]["RE"].iloc[0]),
                        mean_PORAA=float(o["PORAA"].mean()),
                        runs_per_event_check=float(df["runs"].sum())))
        print(f"{y}: games={cov[-1]['games']:>5} PA={cov[-1]['PA']:>7} outs={len(o):>7} "
              f"RE(000)={cov[-1]['league_RE_000']:.3f}", flush=True)
        del df, o

    summ = pd.concat(sum_parts, ignore_index=True)
    rem = pd.concat(re_parts, ignore_index=True).rename(columns={"base_pre": "base_mask", "outs": "outs"})
    rem["base_state"] = rem["base_mask"].map({0: "empty", 1: "1B", 2: "2B", 3: "1B+2B", 4: "3B",
                                              5: "1B+3B", 6: "2B+3B", 7: "loaded"})
    bases = pd.concat(base_parts, ignore_index=True)
    summ.sort_values(["season", "PORAA"], ascending=[True, False]).to_csv(outd / "PORAA_player_season.csv", index=False)
    rem.to_csv(outd / "PORAA_run_expectancy_matrix.csv", index=False)
    bases.to_csv(outd / "PORAA_baselines.csv", index=False)
    pd.DataFrame(cov).to_csv(outd / "PORAA_coverage_by_season.csv", index=False)
    (outd / "SOURCE_ATTRIBUTION.txt").write_text(RETRO_ATTR + "\n")
    print(f"player-seasons={len(summ):,}")


if __name__ == "__main__":
    main()
