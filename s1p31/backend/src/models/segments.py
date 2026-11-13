import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from sklearn.cluster import KMeans
from sklearn.ensemble import IsolationForest
from sklearn.decomposition import PCA
from sklearn.metrics import silhouette_score
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from config import settings as ST
from config.settings import C
from src.utils.paths import P
from src.utils.io_utils import save_json, save_fig, save_model, save_csv, register_chart
from src.utils.runner import DataTooSmall


def _cols(df):
    want = [C["uplh"], C["temp_share"], "overtime_ratio", C["ontime"], C["pick_acc"], C["storage"]]
    return [c for c in want if c in df.columns]


def run_segments(df, verbose=True):
    cols = _cols(df)
    if len(cols) < 3 or len(df) < 30:
        raise DataTooSmall("fewer than 3 usable segmentation columns or under 30 rows")
    X = df[cols].astype(float).fillna(df[cols].median())
    scaled = StandardScaler().fit_transform(X)
    km = Pipeline([("sc", StandardScaler()), ("km", KMeans(n_clusters=ST.N_SEGMENTS, n_init=10, random_state=ST.RANDOM_STATE))]).fit(X)
    lab = km.predict(X)
    order = pd.Series(df["ops_risk_score"].values).groupby(lab).mean().sort_values().index.tolist() if "ops_risk_score" in df.columns else sorted(set(lab))
    names = {c: ST.SEGMENT_LABELS[i] for i, c in enumerate(order)}
    seg = pd.Series(lab).map(names).values
    Xa = pd.concat([X, df[[C["margin"]]].astype(float)], axis=1)
    iso = IsolationForest(n_estimators=200, contamination=ST.ANOMALY_CONTAMINATION, random_state=ST.RANDOM_STATE).fit(Xa)
    flag = (iso.predict(Xa) == -1).astype(int)
    score = -iso.score_samples(Xa)
    pcs = PCA(n_components=2, random_state=ST.RANDOM_STATE).fit_transform(scaled)
    try:
        sil = float(silhouette_score(scaled, lab, sample_size=min(len(df), 1000), random_state=ST.RANDOM_STATE))
    except Exception:
        sil = None
    out = pd.DataFrame({"row_id": df["row_id"].values, "segment": seg, "is_anomaly": flag, "anomaly_score": np.round(score, 4), "pc1": np.round(pcs[:, 0], 4), "pc2": np.round(pcs[:, 1], 4)})
    save_csv(out, P["segments"])
    save_model(km, P["cluster_model"])
    save_model(iso, P["anomaly_model"])
    d = df.assign(segment=seg, is_anomaly=flag)
    sizes = d["segment"].value_counts().reindex(ST.SEGMENT_LABELS).fillna(0).astype(int)
    by_site = d.groupby(C["site"])["is_anomaly"].mean().mul(100).round(2)
    meta = {"features": cols, "silhouette": sil, "anomaly_count": int(flag.sum()), "anomaly_rate_pct": round(float(flag.mean() * 100), 2),
            "low_margin_rate_anomalies": float(d.loc[d.is_anomaly == 1, "low_margin"].mean()) if flag.sum() else None,
            "low_margin_rate_others": float(d.loc[d.is_anomaly == 0, "low_margin"].mean()),
            "segment_sizes": {k: int(v) for k, v in sizes.items()}}
    save_json(meta, P["seg_meta"])
    fig, axes = plt.subplots(1, 2, figsize=(11, 4.5))
    cmap = {"Low": "#59A14F", "Medium": "#F2B134", "High": "#E45756"}
    for s in ST.SEGMENT_LABELS:
        m = seg == s
        axes[0].scatter(pcs[m, 0], pcs[m, 1], s=10, alpha=0.6, label=s, color=cmap[s])
    axes[0].legend(title="Risk segment")
    axes[0].set_title("Segments in two principal components")
    axes[1].scatter(pcs[flag == 0, 0], pcs[flag == 0, 1], s=10, alpha=0.4, color="#4C78A8", label="Typical")
    axes[1].scatter(pcs[flag == 1, 0], pcs[flag == 1, 1], s=22, color="#E45756", label="Unusual")
    axes[1].legend()
    axes[1].set_title("Unusual site-days")
    save_fig(fig, P["reports_dir"] / "segments_anomalies.png")
    register_chart({"id": "segment_sizes", "title": "Site-days by risk segment", "type": "bar", "x_label": "Segment", "y_label": "Site-days",
                    "data": [{"label": k, "value": int(v)} for k, v in sizes.items()], "view": "overview", "file": "segments_anomalies.png"})
    register_chart({"id": "anomaly_rate_by_site", "title": "Unusual site-days by warehouse", "type": "bar", "x_label": "Warehouse", "y_label": "Share unusual (%)",
                    "data": [{"label": str(k), "value": float(v)} for k, v in by_site.items()], "view": "actions", "file": "segments_anomalies.png"})
    if verbose:
        print("Segment features:", cols, "| silhouette:", None if sil is None else round(sil, 3))
        print("Segment sizes:", meta["segment_sizes"])
        print("Unusual site-days:", meta["anomaly_count"], "| low-margin share among them:", meta["low_margin_rate_anomalies"], "vs", round(meta["low_margin_rate_others"], 3))
    return df.merge(out, on="row_id", how="left")
