import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import seaborn as sns
from config.settings import C
from src.utils.paths import P
from src.utils.io_utils import save_fig, register_chart

T = "low_margin"


def _emit(cid, title, kind, xl, yl, data, view, fig):
    save_fig(fig, P["reports_dir"] / (cid + ".png"))
    register_chart({"id": cid, "title": title, "type": kind, "x_label": xl, "y_label": yl, "data": data, "view": view, "file": cid + ".png"})


def _hist_data(s, edges):
    cnt, _ = np.histogram(s.dropna(), bins=edges)
    return [{"label": round(float(edges[i]), 2), "value": int(cnt[i])} for i in range(len(cnt))]


def run_charts(df, verbose=True):
    plt.rcParams.update({"figure.dpi": 150, "axes.spines.top": False, "axes.spines.right": False})
    done = []

    def need(*cols):
        return all(c in df.columns for c in cols)

    def c1():
        n = df[T].value_counts().reindex([0, 1]).fillna(0).astype(int)
        fig, ax = plt.subplots(figsize=(5, 4))
        bars = ax.bar(["Normal", "Low margin"], n.values, color=["#4C78A8", "#E45756"])
        ax.bar_label(bars)
        ax.set_ylabel("Site-days")
        ax.set_title("How many site-days fall in the weakest margin quarter?")
        _emit("target_balance", "Site-days by margin group", "bar", "Group", "Site-days",
              [{"label": "Normal", "value": int(n[0])}, {"label": "Low margin", "value": int(n[1])}], "overview", fig)

    def c2():
        col = C["uplh"]
        edges = np.histogram_bin_edges(df[col].dropna(), bins=20)
        fig, ax = plt.subplots(figsize=(6, 4))
        for v, lab, colr in ((0, "Normal", "#4C78A8"), (1, "Low margin", "#E45756")):
            ax.hist(df.loc[df[T] == v, col].dropna(), bins=edges, alpha=0.6, label=lab, color=colr)
        ax.set_xlabel("Units per labor hour")
        ax.set_ylabel("Site-days")
        ax.legend()
        ax.set_title("Is labor productivity different on low-margin days?")
        _emit("productivity_distribution", "Units per labor hour", "histogram", "Units per labor hour", "Site-days", _hist_data(df[col], edges), "overview", fig)

    def c3():
        cols = [c for c in [C["margin"], C["uplh"], C["temp_share"], "overtime_ratio", C["absent"], C["ontime"], C["pick_acc"],
                            C["storage"], C["downtime"], "backlog_ratio", "mispicks_per_k_units"] if c in df.columns]
        corr = df[cols].corr()
        mask = np.triu(np.ones_like(corr, dtype=bool))
        fig, ax = plt.subplots(figsize=(8, 6.5))
        sns.heatmap(corr, mask=mask, annot=True, fmt=".2f", cmap="RdYlGn", center=0, ax=ax, annot_kws={"size": 7})
        ax.set_title("Which operating measures move together with margin?")
        data = [{"label": cols[i] + " x " + cols[j], "value": round(float(corr.iloc[i, j]), 4)} for i in range(len(cols)) for j in range(i)]
        _emit("correlation_map", "Correlation of key measures", "heatmap", "Measure", "Measure", data, "overview", fig)

    def c4():
        keys = [C["automation"]] + ([C["peak"]] if C["peak"] in df.columns else [])
        g = df.groupby(keys)[T].mean().mul(100).round(2)
        piv = g.unstack() if len(keys) == 2 else g.to_frame("rate")
        fig, ax = plt.subplots(figsize=(6.5, 4))
        piv.plot(kind="bar", ax=ax, rot=0)
        ax.set_ylabel("Low-margin share of site-days (%)")
        ax.set_title("Does the low-margin share depend on automation and season?")
        data = [{"label": " | ".join(map(str, k if isinstance(k, tuple) else (k,))), "value": float(v)} for k, v in g.items()]
        _emit("rate_by_automation", "Low-margin share by automation level", "bar", "Automation | Peak flag", "Low-margin share (%)", data, "actions", fig)

    def c5():
        col = "ops_risk_score"
        edges = np.histogram_bin_edges(df[col].dropna(), bins=20)
        fig, ax = plt.subplots(figsize=(6, 4))
        for v, lab, colr in ((0, "Normal", "#4C78A8"), (1, "Low margin", "#E45756")):
            ax.hist(df.loc[df[T] == v, col], bins=edges, alpha=0.6, label=lab, color=colr)
        ax.set_xlabel("Operational risk score")
        ax.set_ylabel("Site-days")
        ax.legend()
        ax.set_title("Does the risk score separate weak-margin days?")
        _emit("risk_score_distribution", "Operational risk score", "histogram", "Risk score", "Site-days", _hist_data(df[col], edges), "actions", fig)

    def c6():
        s = df.sample(min(400, len(df)), random_state=42)
        fig, ax = plt.subplots(figsize=(6, 4.5))
        ax.scatter(s[C["temp_share"]], s[C["margin"]], c=s[T].map({0: "#4C78A8", 1: "#E45756"}), alpha=0.6, s=14)
        ax.set_xlabel("Agency labor share of hours (%)")
        ax.set_ylabel("Margin (%)")
        ax.set_title("Where does heavy agency labor sit against margin?")
        data = [{"label": round(float(x), 2), "value": round(float(y), 3)} for x, y in zip(s[C["temp_share"]], s[C["margin"]])]
        _emit("agency_share_vs_margin", "Agency labor share against margin", "scatter", "Agency labor share (%)", "Margin (%)", data, "actions", fig)

    def c7():
        piv = df.pivot_table(index=C["site"], columns="weekday", values=T, aggfunc="mean").mul(100)
        order = [d for d in ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] if d in piv.columns]
        piv = piv[order]
        fig, ax = plt.subplots(figsize=(7, 4))
        sns.heatmap(piv, annot=True, fmt=".0f", cmap="RdYlGn_r", ax=ax)
        ax.set_title("Which site and weekday combinations lose margin most often? (% of site-days)")
        data = [{"label": str(i) + "|" + str(j), "value": round(float(piv.loc[i, j]), 2)} for i in piv.index for j in piv.columns if pd.notna(piv.loc[i, j])]
        _emit("site_weekday_rate", "Low-margin share by site and weekday", "heatmap", "Weekday", "Site", data, "tracking", fig)

    def c8():
        m = df.assign(period=df[C["date"]].dt.to_period("M").astype(str)).groupby("period")[[C["profit"], C["revenue"]]].sum()
        series = (m[C["profit"]] / m[C["revenue"]].replace(0, 1) * 100).round(3)
        fig, ax = plt.subplots(figsize=(7, 4))
        ax.plot(series.index, series.values, marker="o")
        ax.set_ylabel("Margin (%)")
        ax.set_title("Is the monthly margin trending up or down?")
        plt.setp(ax.get_xticklabels(), rotation=45, ha="right")
        _emit("monthly_margin_trend", "Monthly margin", "line", "Month", "Margin (%)", [{"label": k, "value": float(v)} for k, v in series.items()], "tracking", fig)

    plan = [("target_balance", c1, [T]), ("productivity_distribution", c2, [C["uplh"], T]), ("correlation_map", c3, [C["margin"]]),
            ("rate_by_automation", c4, [C["automation"], T]), ("risk_score_distribution", c5, ["ops_risk_score", T]),
            ("agency_share_vs_margin", c6, [C["temp_share"], C["margin"]]), ("site_weekday_rate", c7, [C["site"], "weekday", T]),
            ("monthly_margin_trend", c8, [C["date"], C["profit"]])]
    for name, fn, cols in plan:
        if not need(*cols):
            print("Chart skipped (missing columns):", name)
            continue
        try:
            fn()
            done.append(name)
        except Exception as exc:
            plt.close("all")
            print("Chart skipped:", name, "-", exc)
    if verbose:
        print("Charts written to reports:", ", ".join(done))
    return done
