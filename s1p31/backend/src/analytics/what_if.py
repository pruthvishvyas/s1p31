import numpy as np
from config.settings import C
from src.utils.paths import P
from src.utils.io_utils import save_json


def _points(xs, fn, rev):
    return [{"x": int(x), "savings": round(float(fn(x)), 2), "margin_points": round(float(fn(x)) / rev * 100, 4)} for x in xs]


def build_scenarios(df, verbose=True):
    rev = max(float(df[C["revenue"]].sum()), 1.0)
    days = max(int(df[C["date"]].nunique()), 1)
    hrs = float((df[C["labor_hrs"]] + (df[C["temp_hrs"]] if C["temp_hrs"] in df.columns else 0)).sum())
    rate = float(df[C["labor_cost"]].sum()) / max(hrs, 1.0) if C["labor_cost"] in df.columns else 0.0
    out = []
    if C["overtime"] in df.columns and rate > 0:
        prem = 0.5     # overtime is paid at time and a half unless the client states otherwise
        ot = float(df[C["overtime"]].sum())
        out.append({"id": "overtime_shift", "title": "Move overtime hours to regular time", "variable": "share of overtime hours moved to regular time (%)",
                    "assumptions": {"overtime_premium": prem, "average_labor_cost_per_hour": round(rate, 4), "period_days": days},
                    "points": _points(range(0, 101, 10), lambda x: ot * rate * prem * x / 100, rev)})
    if C["temp_hrs"] in df.columns and rate > 0:
        prem = 0.2     # agency hours carry a markup over permanent hours; adjust to the real contract
        th = float(df[C["temp_hrs"]].sum())
        out.append({"id": "agency_conversion", "title": "Convert agency hours to permanent hours", "variable": "share of agency hours converted (%)",
                    "assumptions": {"agency_markup": prem, "average_labor_cost_per_hour": round(rate, 4), "period_days": days},
                    "points": _points(range(0, 101, 10), lambda x: th * rate * prem * x / 100, rev)})
    if C["error_cost"] in df.columns:
        ec = float(df[C["error_cost"]].sum())
        out.append({"id": "error_reduction", "title": "Cut error cost through better picking", "variable": "reduction in error cost (%)",
                    "assumptions": {"error_cost_scales_with_errors": True, "period_days": days},
                    "points": _points(range(0, 51, 5), lambda x: ec * x / 100, rev)})
    for s in out:
        s["period_total_revenue"] = round(rev, 2)
        save_json(s, P["sim_dir"] / (s["id"] + ".json"))
    save_json([s["id"] for s in out], P["scenario_index"])
    if verbose:
        for s in out:
            top = s["points"][-1]
            print(s["title"] + ": at", top["x"], "percent, savings", top["savings"], "=", top["margin_points"], "margin points over", days, "days")
    return out
