import numpy as np
import pandas as pd
from config import settings as ST
from config.settings import C
from src.utils.paths import P
from src.utils.io_utils import save_csv, save_json

FEATURE_DOC = {}
NUM_KEYS = ["sqft", "orders_in", "orders_out", "backlog", "lines", "units", "labor_hrs", "temp_hrs", "temp_share", "overtime",
            "absent", "uplh", "cycle", "dock_stock", "ontime", "pick_acc", "mispicks", "damaged", "returns", "inv_acc",
            "storage", "dock_util", "inbound", "outbound", "downtime", "safety", "peak"]
ENG_NUM = ["total_labor_hrs", "orders_per_labor_hr", "overtime_ratio", "fulfilment_rate", "backlog_ratio", "lines_per_order",
           "units_per_order", "mispicks_per_k_units", "damaged_per_k_units", "returns_per_100_orders", "downtime_flag",
           "units_per_k_sqft", "pallet_ratio", "service_gap_pts", "weekend_flag", "month_num"]
CAT_COLS = ["site", "automation"]


def _div(a, b):
    return a / b.replace(0, 1)    # a zero denominator only happens on an empty day


def build_features(df, verbose=True):
    f = df.copy()
    new = []
    has = lambda *ks: all(C[k] in f.columns for k in ks)

    def add(name, series, meaning, formula):
        f[name] = series
        FEATURE_DOC[name] = (meaning, formula)
        new.append(name)

    f["row_id"] = np.arange(len(f))
    dt = f[C["date"]].dt
    add("weekday", dt.day_name().str[:3], "Day of the week", "weekday of the date")
    add("weekend_flag", (dt.dayofweek >= 5).astype(int), "1 on Saturday or Sunday", "dayofweek >= 5")
    add("month_num", dt.month, "Calendar month number", "month of the date")
    hrs = f[C["labor_hrs"]] + (f[C["temp_hrs"]] if has("temp_hrs") else 0)
    add("total_labor_hrs", hrs, "All paid labor hours, permanent plus agency", "direct hours + temp hours")
    add("orders_per_labor_hr", _div(f[C["orders_out"]], hrs), "Orders shipped per labor hour", "orders shipped / total labor hours")
    if has("overtime"):
        add("overtime_ratio", _div(f[C["overtime"]], hrs), "Share of paid hours worked as overtime", "overtime hours / total labor hours")
    add("fulfilment_rate", _div(f[C["orders_out"]], f[C["orders_in"]]), "Share of received orders shipped the same day", "orders shipped / orders received")
    if has("backlog"):
        add("backlog_ratio", _div(f[C["backlog"]], f[C["orders_in"]]), "End-of-day backlog relative to the day's intake", "backlog / orders received")
    if has("lines"):
        add("lines_per_order", _div(f[C["lines"]], f[C["orders_out"]]), "Order complexity: lines per order", "order lines / orders shipped")
    add("units_per_order", _div(f[C["units"]], f[C["orders_out"]]), "Average order size in units", "units shipped / orders shipped")
    if has("mispicks"):
        add("mispicks_per_k_units", _div(f[C["mispicks"]], f[C["units"]]) * 1000, "Picking errors per thousand units", "mispicks / units * 1000")
    if has("damaged"):
        add("damaged_per_k_units", _div(f[C["damaged"]], f[C["units"]]) * 1000, "Damaged units per thousand shipped", "damaged / units * 1000")
    if has("returns"):
        add("returns_per_100_orders", _div(f[C["returns"]], f[C["orders_out"]]) * 100, "Returns handled per hundred orders", "returns / orders shipped * 100")
    if has("downtime"):
        add("downtime_flag", (f[C["downtime"]] > ST.THRESHOLDS["downtime_max_hrs"]).astype(int), "1 when equipment stoppage exceeds the planning limit", "downtime hours > limit")
    if has("sqft"):
        add("units_per_k_sqft", _div(f[C["units"]], f[C["sqft"]]) * 1000, "Units shipped per thousand square feet", "units / sqft * 1000")
    if has("inbound", "outbound"):
        add("pallet_ratio", _div(f[C["inbound"]], f[C["outbound"]]), "Inbound pallets relative to outbound", "inbound pallets / outbound pallets")
    if has("ontime", "pick_acc"):
        add("service_gap_pts", (100 - f[C["ontime"]]) + (100 - f[C["pick_acc"]]), "Combined shortfall from perfect on-time and pick accuracy", "(100 - on-time) + (100 - pick accuracy)")
    if has("labor_cost", "total_cost"):
        add("labor_cost_share", _div(f[C["labor_cost"]], f[C["total_cost"]]), "Labor share of total cost", "labor cost / total cost")
    if has("error_cost", "total_cost"):
        add("error_cost_share", _div(f[C["error_cost"]], f[C["total_cost"]]), "Error cost share of total cost", "error cost / total cost")
    add("revenue_per_order", _div(f[C["revenue"]], f[C["orders_out"]]), "Revenue earned per order shipped", "revenue / orders shipped")
    add("profit_per_order", _div(f[C["profit"]], f[C["orders_out"]]), "Gross profit per order shipped", "gross profit / orders shipped")
    parts = [(C["temp_share"], 0.15), ("overtime_ratio", 0.15), (C["absent"], 0.10), ("backlog_ratio", 0.15),
             (C["downtime"], 0.10), ("service_gap_pts", 0.20), ("mispicks_per_k_units", 0.15)]
    parts = [(c, w) for c, w in parts if c in f.columns]
    if parts:
        tot = sum(w for _, w in parts)
        score = sum(f[c].rank(pct=True) * w for c, w in parts) / tot * 100
        add("ops_risk_score", score.round(2), "Operational risk, 0 to 100, from staffing, backlog, downtime and service signals",
            "weighted percentile ranks of " + ", ".join(c for c, _ in parts))
    if verbose:
        print("New features (" + str(len(new)) + "):", ", ".join(new))
    return f


def add_target(f, verbose=True):
    thr = float(f[C["margin"]].quantile(ST.LOW_MARGIN_QUANTILE))
    f["low_margin"] = (f[C["margin"]] <= thr).astype(int)
    meta = {"target": "low_margin", "threshold_margin_pct": round(thr, 4), "quantile": ST.LOW_MARGIN_QUANTILE,
            "low_margin_rows": int(f["low_margin"].sum()), "rows": int(len(f))}
    save_json(meta, P["target_meta"])
    save_csv(f, P["features"])
    if verbose:
        print("Low-margin site-days are those at or below a margin of", round(thr, 2), "percent:", meta["low_margin_rows"], "of", len(f))
    return f


def model_feature_lists(df):
    num = [C[k] for k in NUM_KEYS if C[k] in df.columns] + [c for c in ENG_NUM if c in df.columns]
    cat = [C[k] for k in CAT_COLS if C[k] in df.columns] + (["weekday"] if "weekday" in df.columns else [])
    return num, cat
