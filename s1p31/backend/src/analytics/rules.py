import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from config import settings as ST
from config.settings import C
from src.utils.paths import P
from src.utils.io_utils import save_csv, save_fig, register_chart

T_ = ST.THRESHOLDS
RULES = {
    "LATE_SHIPPING": (C["ontime"], "<", T_["ontime_min"], "Add a pick wave or rebalance the dock schedule to recover ship cut-offs"),
    "PICK_ERRORS": (C["pick_acc"], "<", T_["pick_acc_min"], "Run a slotting and pick-path check on the failing zones"),
    "AGENCY_HEAVY": (C["temp_share"], ">", T_["temp_share_max"], "Convert recurring agency roles to permanent or cap agency hours"),
    "OVERTIME_HEAVY": ("overtime_ratio", ">", T_["overtime_ratio_max"], "Rebalance shifts to bring overtime back under the cap"),
    "BACKLOG_BUILD": ("backlog_ratio", ">", T_["backlog_ratio_max"], "Start extra hours earlier in the day to clear carry-over orders"),
    "DOWNTIME": (C["downtime"], ">", T_["downtime_max_hrs"], "Book preventive maintenance on the equipment with the most stops"),
    "FULL_STORAGE": (C["storage"], ">", T_["storage_max"], "Clear aged stock to free pick faces"),
    "ABSENCE": (C["absent"], ">", T_["absent_max"], "Review shift cover and attendance planning"),
    "STOCK_ACCURACY": (C["inv_acc"], "<", T_["inv_acc_min"], "Schedule a cycle count for the affected aisles"),
    "SAFETY": (C["safety"], ">", 0, "Hold a safety review before the next shift"),
}


def assign_alert(row):
    out = []
    for code, (col, op, lim, _) in RULES.items():
        v = row.get(col)
        if v is None or pd.isna(v):
            continue
        if (op == "<" and v < lim) or (op == ">" and v > lim):
            out.append(code)
    return "|".join(out) if out else "NORMAL"


def priority_level(alerts, prob=None):
    n = 0 if alerts == "NORMAL" else len(alerts.split("|"))
    if "SAFETY" in alerts or n >= 4:
        return "P1_URGENT"
    if n == 3 or (prob is not None and not pd.isna(prob) and prob >= 0.7 and n >= 1):
        return "P2_HIGH"
    return "P3_MEDIUM" if n >= 1 else "P4_ROUTINE"


def recommend(alerts):
    if alerts == "NORMAL":
        return "No action needed"
    return "; ".join(RULES[a][3] for a in alerts.split("|"))


def apply_rules(df, verbose=True):
    d = df.copy()
    d["alerts"] = d.apply(assign_alert, axis=1)
    probs = d["pred_prob"] if "pred_prob" in d.columns else pd.Series([None] * len(d), index=d.index)
    d["priority"] = [priority_level(a, p) for a, p in zip(d["alerts"], probs)]
    d["recommendations"] = d["alerts"].map(recommend)
    keep = ["row_id", C["date"], C["site"], "alerts", "priority", "recommendations", "low_margin"] + [c for c in ("pred_prob", "segment", "is_anomaly") if c in d.columns]
    save_csv(d[keep], P["actions"])
    counts = d["priority"].value_counts().reindex(["P1_URGENT", "P2_HIGH", "P3_MEDIUM", "P4_ROUTINE"]).fillna(0).astype(int)
    fig, ax = plt.subplots(figsize=(6, 4))
    bars = ax.bar(counts.index, counts.values, color=["#E45756", "#F58518", "#F2B134", "#59A14F"])
    ax.bar_label(bars)
    ax.set_ylabel("Site-days")
    ax.set_title("How urgent is the work this period?")
    save_fig(fig, P["reports_dir"] / "priority_distribution.png")
    register_chart({"id": "priority_breakdown", "title": "Site-days by priority", "type": "bar", "x_label": "Priority", "y_label": "Site-days",
                    "data": [{"label": k, "value": int(v)} for k, v in counts.items()], "view": "actions", "file": "priority_distribution.png"})
    if verbose:
        print("Priority counts:", counts.to_dict())
        print("Low-margin share by priority:", d.groupby("priority")["low_margin"].mean().round(3).to_dict())
    return d
