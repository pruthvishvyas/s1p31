import numpy as np
import pandas as pd
from config import settings as ST
from config.settings import C
from src.utils.paths import P
from src.utils.io_utils import save_json, read_json

INSIGHTS = []


def add_insight(category, finding, evidence, action, severity="MEDIUM"):
    INSIGHTS.append({"severity": severity, "category": category, "finding": finding, "evidence": evidence, "action": action, "outcome": "DECIDE"})


def _wm(d):
    return float(d[C["profit"]].sum() / max(d[C["revenue"]].sum(), 1) * 100)


def build_insights(df, verbose=True):
    INSIGHTS.clear()
    n = len(df)
    thr = (read_json(P["target_meta"], {}) or {}).get("threshold_margin_pct")
    clf = read_json(P["clf_metrics"], {}) or {}
    fc = read_json(P["fc_metrics"], {}) or {}
    seg = read_json(P["seg_meta"], {}) or {}
    low = df["low_margin"]
    add_insight("Margin Health", "One site-day in four sits in the weakest margin band",
                str(int(low.sum())) + " of " + str(n) + " site-days have a margin at or below " + str(round(thr or 0, 2)) + " percent; overall margin is " + str(round(_wm(df), 2)) + " percent",
                "Review the flagged site-days in the action sheet and agree one fix per site this week")
    s = df.groupby(C["site"]).apply(_wm).sort_values()
    if len(s) > 1:
        add_insight("Site Performance", str(s.index[0]) + " earns the lowest margin of the warehouses",
                    str(s.index[0]) + " " + str(round(s.iloc[0], 2)) + " percent against " + str(s.index[-1]) + " " + str(round(s.iloc[-1], 2)) + " percent",
                    "Ask the " + str(s.index[0]) + " manager for a cost walk-through before the next planning meeting")
    top = (clf.get("top_features") or [])
    feat = next((t[0] for t in top if t[0] in df.columns and df[t[0]].nunique() > 3), None)
    if feat is None and C["temp_share"] in df.columns:
        feat = C["temp_share"]
    if feat:
        q1, q3 = df[feat].quantile(0.25), df[feat].quantile(0.75)
        hi, lo = df[df[feat] >= q3], df[df[feat] <= q1]
        add_insight("Cost Drivers", feat + " is the measure most tied to weak margin days",
                    "Low-margin share is " + str(round(hi["low_margin"].mean() * 100, 1)) + " percent when it is in the top quarter (" + str(len(hi)) + " site-days) against " + str(round(lo["low_margin"].mean() * 100, 1)) + " percent in the bottom quarter (" + str(len(lo)) + " site-days)",
                    "Set a weekly limit for " + feat + " and review the site-days above it")
    if C["automation"] in df.columns and df[C["automation"]].nunique() > 1:
        a = df.groupby(C["automation"]).apply(_wm).sort_values()
        add_insight("Capacity and Automation", str(a.index[0]) + " sites earn the lowest margin by automation level",
                    ", ".join(str(k) + " " + str(round(v, 2)) + " percent" for k, v in a.items()),
                    "Check whether the " + str(a.index[0]) + " gap comes from volume or from labor mix before any investment decision")
    if "alerts" in df.columns:
        cnt = df["alerts"].str.split("|").explode()
        cnt = cnt[cnt != "NORMAL"].value_counts()
        if len(cnt):
            code = cnt.index[0]
            has = df["alerts"].str.contains(code, regex=False)
            add_insight("Service Levels", code.replace("_", " ").title() + " is the most frequent alert",
                        "Raised on " + str(int(has.sum())) + " site-days; low-margin share " + str(round(df.loc[has, "low_margin"].mean() * 100, 1)) + " percent with it against " + str(round(df.loc[~has, "low_margin"].mean() * 100, 1)) + " percent without",
                        "Assign an owner to the " + code.replace("_", " ").lower() + " action and track the count weekly")
    if "is_anomaly" in df.columns and df["is_anomaly"].sum():
        a1, a0 = df[df.is_anomaly == 1], df[df.is_anomaly == 0]
        add_insight("Operational Exceptions", "Unusual site-days carry a different margin profile",
                    str(len(a1)) + " unusual site-days average a margin of " + str(round(a1[C["margin"]].mean(), 2)) + " percent against " + str(round(a0[C["margin"]].mean(), 2)) + " percent for the rest",
                    "Walk through the unusual site-days listed in the dashboard and log the cause for each")
    if "segment" in df.columns:
        sg = df.groupby("segment")["low_margin"].mean().mul(100)
        if "High" in sg.index and "Low" in sg.index:
            add_insight("Risk Score", "The operational risk segments separate margin outcomes",
                        "Low-margin share is " + str(round(sg["High"], 1)) + " percent in the High segment against " + str(round(sg["Low"], 1)) + " percent in the Low segment",
                        "Use the High segment as the daily watch list for supervisors")
    if C["peak"] in df.columns and df[C["peak"]].nunique() > 1:
        pk = df.groupby(C["peak"]).apply(_wm)
        add_insight("Demand Patterns", "Peak season changes the margin earned",
                    "Peak days " + str(round(pk.get(1, np.nan), 2)) + " percent against off-peak " + str(round(pk.get(0, np.nan), 2)) + " percent",
                    "Plan peak staffing against the margin gap rather than volume alone", "LOW")
    sc = read_json(P["sim_dir"] / "overtime_shift.json", None)
    if isinstance(sc, dict) and sc.get("points"):
        pt = sc["points"][5]
        add_insight("Labor Efficiency", "Moving half of overtime to regular hours has a measurable payoff",
                    "At " + str(pt["x"]) + " percent shifted, savings are " + str(pt["savings"]) + " over " + str(sc["assumptions"]["period_days"]) + " days, " + str(pt["margin_points"]) + " margin points",
                    "Test a shift-pattern change at the site with the highest overtime hours")
    if clf.get("models"):
        b = next(m for m in clf["models"] if m["model"] == clf["best"])
        txt = "beats" if clf.get("beats_baseline") else "does not clearly beat"
        add_insight("Model Reliability", "The low-margin risk model " + txt + " its baselines",
                    clf["best"] + " held-out AUC " + str(round(b["test_auc"], 3)) + " against 0.5 for a naive guess; rule-based AUC " + str(round(clf["rule_baseline"]["auc"], 3)) + (" (low sample)" if clf.get("low_sample") else ""),
                    "Use the risk score as a watch list only where the model beats the baselines", "LOW")
    if fc.get("mae") is not None:
        add_insight("Demand Patterns", "Revenue per site-day " + ("can be projected a month ahead" if fc.get("beats_baseline") else "is not projected better than a naive baseline"),
                    "Held-out MAPE " + str(None if fc.get("mape") is None else round(fc["mape"], 2)) + " percent against " + str(None if fc.get("baseline_mape") is None else round(fc["baseline_mape"], 2)) + " percent for a seasonal-naive baseline",
                    "Use the projection for staffing plans only if it beats the baseline", "LOW")
    for i, ins in enumerate(INSIGHTS):
        if i < 3:
            ins["severity"] = "HIGH"
        elif ins["severity"] == "HIGH":
            ins["severity"] = "MEDIUM"
    save_json(INSIGHTS, P["insights"])
    if verbose:
        for ins in INSIGHTS:
            print("[" + ins["severity"] + "] " + ins["category"] + ": " + ins["finding"])
            print("      evidence: " + ins["evidence"])
    return INSIGHTS
