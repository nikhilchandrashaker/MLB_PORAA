// PORAA Dashboard: Productive Out Runs Above Average, 1908–2025
// Requires: react, recharts. Place poraa_data.json next to this file.
// Data: Retrosheet (retrosheet.org), parsed with Chadwick. Names are Retrosheet given names.
import React, { useMemo, useState } from "react";
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, Cell, Legend,
} from "recharts";
import data from "./poraa_data.json";

const C = { bg: "#f7f6f2", card: "#ffffff", tx: "#1d2330", mut: "#667085", ac: "#1f5eff", pos: "#1a8f5a", neg: "#d0453b", bd: "#e3e1d8", amber: "#e07a1f" };
const fmt = (x, d = 1) => (x > 0 ? "+" : "") + Number(x).toFixed(d);
const sign = (x) => (x > 0 ? C.pos : x < 0 ? C.neg : C.mut);
const TYPE = { double_play: "Double play", sac_fly: "Sacrifice fly", sac_bunt: "Sacrifice bunt", ground: "Groundout", fly: "Flyout", line: "Lineout", popup: "Popup", strikeout: "Strikeout", bunt: "Other bunt out", other: "Other" };
const BASES = ["Bases empty", "1B", "2B", "1B+2B", "3B", "1B+3B", "2B+3B", "Loaded"];
const TABS = ["Overview", "Players", "Leaderboards", "Run expectancy", "Validation"];

const box = { background: C.card, border: `1px solid ${C.bd}`, borderRadius: 12, padding: 16, marginBottom: 14 };
const Stat = ({ k, l, color }) => (
  <div style={{ ...box, marginBottom: 0 }}>
    <div style={{ font: "700 24px Georgia, serif", color: color || C.tx }}>{k}</div>
    <div style={{ color: C.mut, fontSize: 12.5, marginTop: 4 }}>{l}</div>
  </div>
);
const Grid = ({ children, min = 150 }) => (
  <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fit, minmax(${min}px, 1fr))`, gap: 10, marginBottom: 14 }}>{children}</div>
);
const Pill = ({ on, children, ...p }) => (
  <button {...p} style={{ border: `1px solid ${on ? C.ac : C.bd}`, background: on ? C.ac : C.card, color: on ? "#fff" : C.tx, padding: "7px 14px", borderRadius: 999, font: "inherit", cursor: "pointer", marginRight: 6, marginBottom: 6 }}>{children}</button>
);
const H = ({ children, note }) => (
  <div style={{ marginBottom: 8 }}>
    <h2 style={{ fontSize: 16, margin: "0 0 2px" }}>{children}</h2>
    {note && <p style={{ color: C.mut, fontSize: 13, margin: 0 }}>{note}</p>}
  </div>
);

function Overview() {
  const ot = useMemo(() => [...data.ot].sort((a, b) => b[2] - a[2]).map((r) => ({ name: TYPE[r[0]], v: r[2], n: r[1] })), []);
  const hist = useMemo(() => data.hist.map(([x, n]) => ({ x: `${x}`, n })), []);
  return (
    <>
      <Grid>
        <Stat k="199,897" l="games parsed" />
        <Stat k="9.66M" l="batter outs scored" />
        <Stat k="77,939" l="batter-seasons" />
        <Stat k="2.65" l="SD of PORAA per season (runs)" />
        <Stat k="−0.38" l="runs per double play vs average out" color={C.neg} />
        <Stat k="+0.47" l="runs per sacrifice fly" color={C.pos} />
      </Grid>
      <div style={box}>
        <H note="Mean runs above the average out in the same base-out state, across 9.66 million outs.">Average PORAA by type of out</H>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={ot} layout="vertical" margin={{ left: 20, right: 20 }}>
            <CartesianGrid horizontal={false} stroke={C.bd} />
            <XAxis type="number" domain={[-0.45, 0.55]} tickFormatter={(v) => v.toFixed(1)} />
            <YAxis type="category" dataKey="name" width={110} />
            <Tooltip formatter={(v, n, p) => [fmt(v, 3) + " runs per out", `${p.payload.n.toLocaleString()} outs`]} />
            <ReferenceLine x={0} stroke={C.mut} />
            <Bar dataKey="v">{ot.map((r, i) => <Cell key={i} fill={r.v >= 0 ? C.pos : C.neg} />)}</Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div style={box}>
        <H note="Batter-seasons with 400+ PA, by PORAA runs (bin start shown).">Distribution of season PORAA</H>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={hist}>
            <CartesianGrid vertical={false} stroke={C.bd} />
            <XAxis dataKey="x" /><YAxis /><Tooltip />
            <Bar dataKey="n" fill={C.ac} name="Batter-seasons" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}

function Players() {
  const [q, setQ] = useState("");
  const [sortKey, setSortKey] = useState(4);
  const [desc, setDesc] = useState(true);
  const [sel, setSel] = useState(null);
  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    const r = data.players.filter((p) => !t || p[1].toLowerCase().includes(t));
    return [...r].sort((a, b) => (desc ? b[sortKey] - a[sortKey] : a[sortKey] - b[sortKey])).slice(0, 40);
  }, [q, sortKey, desc]);
  const seasons = sel ? (data.seasons[sel[0]] || []).map(([s, p, o, pa]) => ({ season: s, PORAA: p, outs: o, PA: pa })) : [];
  const head = [["Player", 1], ["Last", 3], ["PORAA", 4], ["Per 100 outs", 5], ["PA", 6], ["K", 7], ["GIDP", 8]];
  const th = { padding: "8px 8px", textAlign: "right", color: C.mut, fontSize: 12.5, cursor: "pointer", borderBottom: `1px solid ${C.bd}` };
  return (
    <>
      <div style={box}>
        <H note="Career totals, 2,500+ PA (2,083 hitters). Click a header to sort, a row for season-by-season PORAA.">Player search</H>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, for example Gehringer" style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: `1px solid ${C.bd}`, font: "inherit", marginBottom: 10 }} />
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontVariantNumeric: "tabular-nums" }}>
            <thead><tr>{head.map(([h, k]) => (
              <th key={h} style={{ ...th, textAlign: k === 1 ? "left" : "right" }} onClick={() => { if (k === sortKey) setDesc(!desc); else { setSortKey(k); setDesc(true); } }}>{h}{k === sortKey ? (desc ? " ▼" : " ▲") : ""}</th>
            ))}</tr></thead>
            <tbody>{rows.map((p) => (
              <tr key={p[0]} onClick={() => setSel(p)} style={{ cursor: "pointer", background: sel && sel[0] === p[0] ? "#eef3ff" : "transparent" }}>
                <td style={{ padding: 8, borderBottom: `1px solid ${C.bd}` }}>{p[1]}</td>
                {[3, 4, 5, 6, 7, 8].map((k) => (
                  <td key={k} style={{ padding: 8, textAlign: "right", borderBottom: `1px solid ${C.bd}`, color: k === 4 || k === 5 ? sign(p[k]) : C.tx }}>{k === 4 ? fmt(p[k]) : k === 5 ? fmt(p[k], 2) : p[k]}</td>
                ))}
              </tr>
            ))}</tbody>
          </table>
        </div>
        <p style={{ color: C.mut, fontSize: 12.5, marginBottom: 0 }}>Showing up to 40 rows.</p>
      </div>
      {sel && (
        <div style={box}>
          <H note={`${sel[1]}, ${sel[2]}–${sel[3]}. Bars are runs above the average out for each season.`}>{sel[1]}: PORAA by season</H>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={seasons}>
              <CartesianGrid vertical={false} stroke={C.bd} />
              <XAxis dataKey="season" /><YAxis /><ReferenceLine y={0} stroke={C.mut} />
              <Tooltip formatter={(v, n, p) => [fmt(v), `${p.payload.PA} PA`]} />
              <Bar dataKey="PORAA">{seasons.map((r, i) => <Cell key={i} fill={r.PORAA >= 0 ? C.pos : C.neg} />)}</Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </>
  );
}

function Leaderboards() {
  const [scope, setScope] = useState("ss");
  const [side, setSide] = useState("top");
  const d = data[`${scope}_${side}`].map((r) => (scope === "ss" ? { n: `${r[1]} ${r[0]}`, v: r[2] } : { n: `${r[0]} (to ${r[1]})`, v: r[2] }));
  return (
    <div style={box}>
      <div>
        <Pill on={scope === "ss"} onClick={() => setScope("ss")}>Single season</Pill>
        <Pill on={scope === "c"} onClick={() => setScope("c")}>Career</Pill>
        <Pill on={side === "top"} onClick={() => setSide("top")}>Best</Pill>
        <Pill on={side === "bot"} onClick={() => setSide("bot")}>Worst</Pill>
      </div>
      <H note={scope === "ss" ? "Single seasons, 400+ PA." : "Careers through 2025, 3,000+ PA."}>{side === "top" ? "Most" : "Fewest"} runs above average on outs</H>
      <ResponsiveContainer width="100%" height={340}>
        <BarChart data={d} layout="vertical" margin={{ left: 40, right: 24 }}>
          <CartesianGrid horizontal={false} stroke={C.bd} />
          <XAxis type="number" /><YAxis type="category" dataKey="n" width={190} />
          <ReferenceLine x={0} stroke={C.mut} /><Tooltip formatter={(v) => fmt(v)} />
          <Bar dataKey="v">{d.map((r, i) => <Cell key={i} fill={r.v >= 0 ? C.pos : C.neg} />)}</Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function RunExpectancy() {
  const years = useMemo(() => Object.keys(data.re_all).map(Number).sort((a, b) => a - b), []);
  const [yr, setYr] = useState(2025);
  const m = data.re_all[yr];
  const mx = Math.max(...m.flat());
  const cell = { padding: "7px 10px", textAlign: "center", borderBottom: `1px solid ${C.bd}` };
  return (
    <div style={box}>
      <H note="Average runs scored from each state to the end of the inning, by season.">Run expectancy by base-out state</H>
      <select value={yr} onChange={(e) => setYr(+e.target.value)} style={{ padding: "6px 10px", borderRadius: 8, border: `1px solid ${C.bd}`, font: "inherit", marginBottom: 10 }}>
        {years.slice().reverse().map((y) => <option key={y}>{y}</option>)}
      </select>
      <table style={{ borderCollapse: "collapse", width: "100%", fontVariantNumeric: "tabular-nums" }}>
        <thead><tr><th style={{ ...cell, textAlign: "left" }}>Bases</th>{["0 out", "1 out", "2 out"].map((h) => <th key={h} style={{ ...cell, color: C.mut }}>{h}</th>)}</tr></thead>
        <tbody>{m.map((r, i) => (
          <tr key={i}><td style={{ ...cell, textAlign: "left" }}>{BASES[i]}</td>
            {r.map((x, j) => <td key={j} style={{ ...cell, background: `rgba(31,94,255,${(x / mx) * 0.45})` }}>{x.toFixed(2)}</td>)}
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

function Validation() {
  const sc = useMemo(() => data.scatter.map(([x, y]) => ({ x: x * 100, y })), []);
  const gk = useMemo(() => data.gk.map(([d, g, k]) => ({ d: `${d}s`, GIDP: +g.toFixed(2), K: +k.toFixed(1) })), []);
  const sd = useMemo(() => data.sd.map(([d, v]) => ({ d: `${d}s`, v })), []);
  return (
    <>
      <Grid min={170}>
        <Stat k="0.17" l="split-half reliability (300+ outs)" />
        <Stat k="0.29" l="implied full-season reliability" />
        <Stat k="0.28" l="year-to-year r, PORAA per 100 outs" />
        <Stat k="−0.59" l="correlation with double-play rate" color={C.neg} />
        <Stat k="−0.14" l="correlation with strikeout rate" color={C.neg} />
        <Stat k="0.40" l="R² from K and GIDP rates alone" />
        <Stat k="0.21" l="year-to-year r after removing K and GIDP" />
      </Grid>
      <div style={box}>
        <H note="Each point is a batter-season with 400+ PA (random sample of 700). x = double plays as a share of outs.">Double-play rate vs PORAA</H>
        <ResponsiveContainer width="100%" height={280}>
          <ScatterChart margin={{ left: 10, right: 20 }}>
            <CartesianGrid stroke={C.bd} />
            <XAxis type="number" dataKey="x" name="GIDP % of outs" unit="%" /><YAxis type="number" dataKey="y" name="PORAA" />
            <ReferenceLine y={0} stroke={C.mut} /><Tooltip cursor={{ strokeDasharray: "3 3" }} />
            <Scatter data={sc} fill={C.ac} fillOpacity={0.5} />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      <div style={box}>
        <H note="Share of outs that are double plays vs strikeouts, by decade.">Eras: strikeouts rose, double plays did not</H>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={gk}>
            <CartesianGrid stroke={C.bd} /><XAxis dataKey="d" /><YAxis yAxisId="a" unit="%" /><YAxis yAxisId="b" orientation="right" unit="%" />
            <Tooltip /><Legend />
            <Line yAxisId="a" dataKey="K" stroke={C.amber} strokeWidth={2} dot={false} name="Strikeouts (% of outs)" />
            <Line yAxisId="b" dataKey="GIDP" stroke={C.ac} strokeWidth={2} dot={false} name="Double plays (% of outs)" />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div style={box}>
        <H note="Standard deviation of season PORAA (runs) among 400+ PA hitters.">Spread by decade</H>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={sd}><CartesianGrid vertical={false} stroke={C.bd} /><XAxis dataKey="d" /><YAxis domain={[0, 3.5]} /><Tooltip /><Bar dataKey="v" fill={C.amber} name="SD (runs)" /></BarChart>
        </ResponsiveContainer>
      </div>
      <p style={{ color: C.mut, fontSize: 13 }}>
        PORAA is real but modest. Double-play avoidance is the largest driver; strikeouts barely register because the average out in a given state is often already a strikeout. One season is noisy, so use multi-year totals. No runner-speed or batted-ball adjustment yet.
      </p>
    </>
  );
}

export default function PORAADashboard() {
  const [tab, setTab] = useState(0);
  const View = [Overview, Players, Leaderboards, RunExpectancy, Validation][tab];
  return (
    <div style={{ background: C.bg, color: C.tx, font: "15px/1.5 system-ui, -apple-system, 'Segoe UI', sans-serif", minHeight: "100vh", padding: "20px 16px 48px" }}>
      <div style={{ maxWidth: 980, margin: "0 auto" }}>
        <h1 style={{ font: "700 26px/1.2 Georgia, serif", margin: "0 0 4px" }}>PORAA: Productive Out Runs Above Average</h1>
        <p style={{ color: C.mut, margin: "0 0 16px" }}>How much run value each hitter creates with his outs compared with the average out in the same situation. Retrosheet, 1908–2025.</p>
        <div style={{ marginBottom: 12 }}>{TABS.map((t, i) => <Pill key={t} on={tab === i} onClick={() => setTab(i)}>{t}</Pill>)}</div>
        <View />
        <p style={{ color: C.mut, fontSize: 12, marginTop: 22 }}>
          The information used here was obtained free of charge from and is copyrighted by Retrosheet (retrosheet.org). Names are Retrosheet given names.
        </p>
      </div>
    </div>
  );
}
