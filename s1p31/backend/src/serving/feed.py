import hashlib, os
from datetime import datetime
from pathlib import Path
import numpy as np
import pandas as pd
from config import settings as ST
from config.settings import C
from src.utils.paths import P
from src.utils.io_utils import read_table, save_json, read_json, load_frame

TAB = {"overview": "understand", "actions": "decide", "tracking": "monitor"}
OUT = P["output_dir"]
DIRS = {t: OUT / t for t in TAB.values()}
DIRS["meta"] = P["meta_dir"]


def _bigquery_available():
    bq = ST.BIGQUERY
    if not (bq["project_id"] and bq["dataset"] and bq["table"]):
        return False
    try:
        import google.cloud.bigquery  # noqa: F401
    except Exception:
        return False
    return bool(os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")) or (ST.PROJECT_ROOT / bq["credentials_file"]).exists()


def _load_from_bigquery(config):
    from google.cloud import bigquery
    if not os.environ.get("GOOGLE_APPLICATION_CREDENTIALS"):
        os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = str(ST.PROJECT_ROOT / config["credentials_file"])
    client = bigquery.Client(project=config["project_id"])
    df = client.query("SELECT * FROM `" + config["project_id"] + "." + config["dataset"] + "." + config["table"] + "`").to_dataframe()
    print("Source: BigQuery")
    df[C["date"]] = pd.to_datetime(df[C["date"]], errors="coerce")
    return df


def _load_from_csv(config):
    print("Source: CSV")
    return load_frame("features")


def _load_data(config):
    if _bigquery_available():
        try:
            return _load_from_bigquery(config)
        except Exception as exc:
            print("BigQuery failed, using CSV instead:", exc)
    return _load_from_csv(config)


def _put(path, obj):
    save_json(obj, path)
    return path


def _stand(reason):
    return {"status": "skipped", "reason": reason}


def _rd(path, label):
    obj = read_json(path, None)
    return obj if obj is not None else _stand(label + " is not available; the stage that writes it did not run")


def _hid(*parts):
    return hashlib.sha256("|".join(map(str, parts)).encode()).hexdigest()[:10]


def _rate(a, b):
    return round(float(a) / (float(b) if b > 0 else 1), 4)


def export_all(verbose=True):
    for d in DIRS.values():
        d.mkdir(parents=True, exist_ok=True)
    (DIRS["understand"] / "charts").mkdir(parents=True, exist_ok=True)
    (DIRS["decide"] / "simulations").mkdir(parents=True, exist_ok=True)
    df = _load_data(ST.BIGQUERY)
    for key in ("predictions", "segments", "actions"):
        if P[key].exists():
            ex = read_table(P[key])
            df = df.merge(ex[[c for c in ex.columns if c == "row_id" or c not in df.columns]], on="row_id", how="left")
    n = len(df)
    rev, prof = float(df[C["revenue"]].sum()), float(df[C["profit"]].sum())
    k = lambda key, label, val, unit: {"key": key, "label": label, "value": val, "unit": unit}
    kpis = [k("site_days", "Site-days", int(n), "count"), k("revenue", ST.TERMINOLOGY["revenue"], round(rev, 2), "currency"), k("gross_profit", "Gross profit", round(prof, 2), "currency"),
            k("margin_pct", "Margin", round(_rate(prof, rev) * 100, 4), "percent"), k("low_margin_rate", "Low-margin share", round(float(df["low_margin"].mean()) * 100, 4), "percent"),
            k("orders_shipped", "Orders shipped", int(df[C["orders_out"]].sum()), "count"), k("units_shipped", "Units shipped", int(df[C["units"]].sum()), "count"),
            k("cost_per_order", "Cost per order", _rate(df[C["total_cost"]].sum(), df[C["orders_out"]].sum()), "currency")]
    if C["ontime"] in df.columns:
        kpis.append(k("on_time_pct", "Average on-time shipping", round(float(df[C["ontime"]].mean()), 4), "percent"))
    if C["pick_acc"] in df.columns:
        kpis.append(k("pick_accuracy_pct", "Average pick accuracy", round(float(df[C["pick_acc"]].mean()), 4), "percent"))
    kpis.append(k("units_per_labor_hr", "Units per labor hour", _rate(df[C["units"]].sum(), (df[C["labor_hrs"]] + (df[C["temp_hrs"]] if C["temp_hrs"] in df.columns else 0)).sum()), "ratio"))
    if "priority" in df.columns:
        kpis.append(k("urgent_site_days", "Urgent site-days", int((df["priority"] == "P1_URGENT").sum()), "count"))
    if "is_anomaly" in df.columns:
        kpis.append(k("unusual_site_days", "Unusual site-days", int(df["is_anomaly"].fillna(0).sum()), "count"))
    files = []
    u, dd, mm = DIRS["understand"], DIRS["decide"], DIRS["monitor"]
    files.append(_put(u / "kpis.json", kpis))
    if "segment" in df.columns:
        sg = df.groupby("segment").agg(site_days=("row_id", "count"), margin_pct=(C["margin"], "mean"), risk_score=("ops_risk_score", "mean"), low_margin_rate=("low_margin", "mean")).round(4).reset_index()
        files.append(_put(u / "segments.json", sg.to_dict("records")))
    else:
        files.append(_put(u / "segments.json", _stand("segmentation did not run")))
    if "is_anomaly" in df.columns:
        a = df[df["is_anomaly"] == 1].sort_values("anomaly_score", ascending=False).head(ST.ROW_CAP)
        rows = [{"id": _hid(r[C["site"]], r[C["date"]]), "date": str(r[C["date"]])[:10], "warehouse": r[C["site"]], "margin_pct": round(float(r[C["margin"]]), 3), "score": float(r["anomaly_score"])} for _, r in a.iterrows()]
        files.append(_put(u / "anomalies.json", {"count": int(df["is_anomaly"].sum()), "rate": round(float(df["is_anomaly"].mean()), 4), "rows": rows}))
    else:
        files.append(_put(u / "anomalies.json", _stand("anomaly detection did not run")))
    reg = read_json(P["chart_registry"], [])
    reg = reg if isinstance(reg, list) else []
    index = []
    for ch in reg:
        _put(u / "charts" / (ch["id"] + ".json"), {kk: ch[kk] for kk in ("id", "title", "type", "x_label", "y_label", "data")})
        index.append({"id": ch["id"], "title": ch["title"], "type": ch["type"], "tab": TAB.get(ch.get("view"), "understand"), "file": "understand/charts/" + ch["id"] + ".json"})
    files.append(_put(u / "charts.json", index))
    files.append(_put(dd / "insights.json", _rd(P["insights"], "insights")))
    if "priority" in df.columns:
        top = df[df["priority"].isin(["P1_URGENT", "P2_HIGH"])].sort_values(["priority", C["date"]], ascending=[True, False]).head(ST.ROW_CAP)
        rows = [{"id": _hid(r[C["site"]], r[C["date"]]), "date": str(r[C["date"]])[:10], "warehouse": r[C["site"]], "priority": r["priority"], "alerts": r["alerts"], "actions": r["recommendations"]} for _, r in top.iterrows()]
        files.append(_put(dd / "recommendations.json", {"priority_counts": {k2: int(v) for k2, v in df["priority"].value_counts().items()}, "rows": rows}))
    else:
        files.append(_put(dd / "recommendations.json", _stand("business rules did not run")))
    sims = read_json(P["scenario_index"], []) or []
    for sid in sims:
        files.append(_put(dd / "simulations" / (sid + ".json"), _rd(P["sim_dir"] / (sid + ".json"), sid)))
    files.append(_put(dd / "simulations.json", [{"id": s, "file": "decide/simulations/" + s + ".json"} for s in sims]))
    files.append(_put(dd / "goals.json", _rd(P["goals"], "goals")))
    fc = read_table(P["forecast"]) if P["forecast"].exists() else None
    fcm = _rd(P["fc_metrics"], "forecast metrics")
    files.append(_put(mm / "forecast.json", {"metrics": fcm, "series": fc.to_dict("records") if fc is not None else []} if fc is not None else _stand("forecast did not run")))
    files.append(_put(mm / "goal_progress.json", _rd(P["goal_progress"], "goal progress")))
    files.append(_put(mm / "alerts.json", _rd(P["alerts"], "alerts")))
    clf = read_json(P["clf_metrics"], {}) or {}
    feats = read_json(P["feature_list"], {}) or {}
    meta = DIRS["meta"]
    files.append(_put(meta / "terminology.json", ST.TERMINOLOGY))
    files.append(_put(meta / "summary.json", {"rows": int(n), "first_date": str(df[C["date"]].min())[:10], "last_date": str(df[C["date"]].max())[:10], "sites": int(df[C["site"]].nunique()), "domain": ST.DOMAIN}))
    files.append(_put(meta / "model_meta.json", {"model_name": "primary_model", "algorithm": clf.get("best"), "feature_count": len(feats.get("numeric", [])) + len(feats.get("categorical", [])),
                                                 "feature_cols": feats, "models_ready": P["model_file"].exists()}))
    inputs = []
    for c in feats.get("numeric", [])[:8]:
        if c in df.columns:
            inputs.append({"name": c, "type": "float", "range": [round(float(df[c].min()), 3), round(float(df[c].max()), 3)]})
    runlog = P["run_log"]
    if not runlog.exists():
        _put(runlog, _stand("pipeline has not been run"))
    bq = ST.BIGQUERY
    src = {"type": "bigquery", "project_id": bq["project_id"], "dataset": bq["dataset"], "table": bq["table"], "credentials_file": bq["credentials_file"]} if _bigquery_available() else {"type": "csv", "file": "data/processed/feature_store.csv"}
    rel = lambda p: Path(p).relative_to(OUT).as_posix()
    contract = {"generated_at": datetime.now().isoformat(timespec="seconds"),
                "project": {"name": ST.PROJECT_NAME, "domain": ST.DOMAIN, "client_id": ST.CLIENT_ID, "description": ST.DESCRIPTION},
                "terminology": ST.TERMINOLOGY, "source": src,
                "outcomes": {"understand": {"kpis": "understand/kpis.json", "charts": "understand/charts.json", "segments": "understand/segments.json", "anomalies": "understand/anomalies.json"},
                             "decide": {"insights": "decide/insights.json", "recommendations": "decide/recommendations.json", "simulations": "decide/simulations.json", "goals": "decide/goals.json"},
                             "monitor": {"forecast": "monitor/forecast.json", "goal_progress": "monitor/goal_progress.json", "alerts": "monitor/alerts.json"}},
                "model": {"type": "classification", "pkl_file": P["model_file"].name, "feature_cols_file": P["feature_list"].name, "input_fields": [i["name"] for i in inputs], "output_label": "low_margin", "horizon": "same day"},
                "forecaster": {"input_schema": inputs, "output_schema": {"prediction": "int", "probability": "float", "risk_level": "str"}},
                "frontend": {"framework": "vanilla HTML/JS", "deploy_target": "cloudflare_pages"}, "files": []}
    for p in files + [meta / "model_meta.json"]:
        obj = read_json(p, None)
        contract["files"].append({"filename": rel(p), "purpose": Path(p).stem.replace("_", " "), "schema": sorted(obj.keys()) if isinstance(obj, dict) else ("list" if isinstance(obj, list) else "value")})
    for section in contract["outcomes"].values():
        for key, path in list(section.items()):
            if not (OUT / path).exists():
                _put(OUT / path, _stand(key + " was not produced"))
    _put(OUT / "frontend_contract.json", contract)
    total = sum(f.stat().st_size for f in OUT.rglob("*") if f.is_file()) / 1024
    if verbose:
        print("Active source:", src["type"], "| contract:", (OUT / "frontend_contract.json").name, "| files:", len(contract["files"]), "| total KB:", round(total, 1))
    return contract
