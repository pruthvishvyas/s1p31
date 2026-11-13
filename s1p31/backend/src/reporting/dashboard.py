import numpy as np
from config.settings import C
from src.utils.paths import P


def write_dashboard(df, verbose=True):
    import plotly.graph_objects as go
    from plotly.subplots import make_subplots
    fig = make_subplots(rows=2, cols=2, subplot_titles=("Low-margin share by warehouse (%)", "Operational risk score", "Agency labor share against margin", "Site-days by priority"))
    g = df.groupby(C["site"])["low_margin"].mean().mul(100).round(2)
    fig.add_trace(go.Bar(x=list(g.index), y=list(g.values), marker_color="#4C78A8"), row=1, col=1)
    if "ops_risk_score" in df.columns:
        fig.add_trace(go.Histogram(x=df["ops_risk_score"], marker_color="#F58518"), row=1, col=2)
    s = df.sample(min(500, len(df)), random_state=42)
    fig.add_trace(go.Scatter(x=s[C["temp_share"]], y=s[C["margin"]], mode="markers", marker=dict(size=5, color=s["low_margin"], colorscale=[[0, "#4C78A8"], [1, "#E45756"]])), row=2, col=1)
    if "priority" in df.columns:
        p = df["priority"].value_counts().reindex(["P1_URGENT", "P2_HIGH", "P3_MEDIUM", "P4_ROUTINE"]).fillna(0)
        fig.add_trace(go.Bar(x=list(p.index), y=list(p.values), marker_color="#E45756"), row=2, col=2)
    fig.update_layout(title_text="Operations dashboard", showlegend=False, height=720)
    fig.write_html(str(P["dash_html"]), include_plotlyjs="cdn")
    if verbose:
        print("Dashboard written:", P["dash_html"].name)


def print_summary(df):
    line = "=" * 60
    print(line)
    print("Site-days analysed        :", len(df))
    print("Low-margin share          :", round(df["low_margin"].mean() * 100, 1), "percent")
    print("Weighted margin           :", round(df[C["profit"]].sum() / max(df[C["revenue"]].sum(), 1) * 100, 2), "percent")
    if "is_anomaly" in df.columns:
        print("Unusual site-days         :", int(df["is_anomaly"].sum()))
    if "priority" in df.columns:
        print("Urgent (P1) site-days     :", int((df["priority"] == "P1_URGENT").sum()))
    print(line)
