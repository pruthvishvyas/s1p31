import numpy as np
import pandas as pd
from config.settings import C
from src.utils.paths import P
from src.utils.io_utils import save_json, read_json

DEFAULT_GOALS = {
    "revenue_target": {"value": None, "unit": "monthly", "client_sets": True},
    "margin_target_pct": {"value": None, "unit": "percent", "client_sets": True},
    "on_time_target_pct": {"value": 95, "unit": "percent", "description": "Contract on-time shipping level"},
    "alert_drop_pct": {"value": 20, "unit": "percent", "description": "Alert if revenue drops by this %"},
    "forecast_horizon": {"value": 30, "unit": "days"},
}


def ensure_goals():
    if P["goals"].exists():
        cur = read_json(P["goals"], None)
        if isinstance(cur, dict):
            return cur
    save_json(DEFAULT_GOALS, P["goals"])
    return DEFAULT_GOALS


def _val(goals, key):
    g = goals.get(key, {})
    return g.get("value") if isinstance(g, dict) else None


def evaluate_goals(df, verbose=True):
    goals = ensure_goals()
    dcol = C["date"]
    last = df[dcol].max()
    win = 30 if df[dcol].nunique() >= 60 else 7
    cur = df[df[dcol] > last - pd.Timedelta(days=win)]
    prev = df[(df[dcol] <= last - pd.Timedelta(days=win)) & (df[dcol] > last - pd.Timedelta(days=2 * win))]
    prog, alerts = {"window_days": win, "as_of": str(last.date())}, []
    rev_c = float(cur[C["revenue"]].sum())
    rt = _val(goals, "revenue_target")
    prog["revenue_actual"] = round(rev_c, 2)
    prog["revenue_target"] = rt
    prog["revenue_status"] = "target not set" if not rt else ("on track" if rev_c * (30 / win) >= rt else "behind")
    mc = float(cur[C["profit"]].sum() / max(cur[C["revenue"]].sum(), 1) * 100)
    prog["margin_pct_actual"] = round(mc, 3)
    mt = _val(goals, "margin_target_pct")
    prog["margin_target_pct"] = mt
    prog["margin_status"] = "target not set" if mt is None else ("on track" if mc >= mt else "behind")
    if C["ontime"] in cur.columns:
        ot = float(cur[C["ontime"]].mean())
        prog["on_time_actual"] = round(ot, 3)
        tgt = _val(goals, "on_time_target_pct")
        prog["on_time_status"] = "on track" if tgt is None or ot >= tgt else "behind"
        if tgt is not None and ot < tgt:
            alerts.append({"id": "on_time_below_target", "severity": "HIGH", "message": "Average on-time shipping is below the target", "value": round(ot, 2), "threshold": tgt})
    if len(prev):
        pr = float(prev[C["revenue"]].sum())
        drop = (pr - rev_c) / max(pr, 1) * 100
        prog["revenue_change_pct"] = round(-drop, 2)
        lim = _val(goals, "alert_drop_pct") or 20
        if drop >= lim:
            alerts.append({"id": "revenue_drop", "severity": "HIGH", "message": "Revenue fell against the previous period", "value": round(drop, 2), "threshold": lim})
        pm = float(prev[C["profit"]].sum() / max(prev[C["revenue"]].sum(), 1) * 100)
        prog["margin_change_pts"] = round(mc - pm, 3)
        if pm - mc >= 2:
            alerts.append({"id": "margin_drop", "severity": "MEDIUM", "message": "Margin fell by two points or more against the previous period", "value": round(mc - pm, 2), "threshold": -2})
    if "priority" in cur.columns:
        p1 = int((cur["priority"] == "P1_URGENT").sum())
        prog["p1_count"] = p1
        if p1:
            alerts.append({"id": "urgent_site_days", "severity": "MEDIUM", "message": "Urgent site-days in the latest period", "value": p1, "threshold": 0})
    save_json(prog, P["goal_progress"])
    save_json(alerts, P["alerts"])
    if verbose:
        print("Goal progress:", prog)
        print("Alerts:", [a["id"] for a in alerts] or "none")
    return prog
