from config.settings import PROJECT_ROOT, SLUG, INPUT_FILE

R = PROJECT_ROOT
P = {
    "raw_dir": R / "data" / "raw", "interim_dir": R / "data" / "interim", "processed_dir": R / "data" / "processed",
    "models_dir": R / "models", "reports_dir": R / "reports", "output_dir": R / "output", "logs_dir": R / "logs",
    "notebooks_dir": R / "notebooks", "meta_dir": R / "output" / "meta", "sim_dir": R / "data" / "interim" / "simulations",
}
_i, _p, _m, _r = P["interim_dir"], P["processed_dir"], P["models_dir"], P["reports_dir"]
P.update({
    "raw_csv": P["raw_dir"] / INPUT_FILE,
    "validation": _i / "validation_report.json", "cleaning_log": _i / "cleaning_log.json",
    "target_meta": _i / "target_meta.json", "leak_log": _i / "leakage_log.json",
    "chart_registry": _i / "chart_registry.json", "goal_progress": _i / "goal_progress.json",
    "alerts": _i / "alerts.json", "scenario_index": _i / "scenario_index.json",
    "clean": _p / "clean_data.csv", "features": _p / "feature_store.csv", "predictions": _p / "model_predictions.csv",
    "segments": _p / "segments_anomalies.csv", "forecast": _p / "forecast_output.csv", "actions": _p / "business_actions.csv",
    "clf_metrics": _p / "model_metrics.json", "reg_metrics": _p / "regression_metrics.json",
    "fc_metrics": _p / "forecast_metrics.json", "seg_meta": _p / "segment_meta.json",
    "model_file": _m / "primary_model.joblib", "feature_list": _m / "feature_cols.json",
    "cluster_model": _m / "segment_model.joblib", "anomaly_model": _m / "anomaly_model.joblib",
    "reg_model": _m / "margin_regressor.joblib", "hashes": _m / "model_hashes.json",
    "insights": _r / "insights.json", "workbook": _r / (SLUG + "_report.xlsx"), "dash_html": _r / "interactive_dashboard.html",
    "goals": R / "config" / "goals.json", "run_log": R / "output" / "meta" / "run_log.json",
})


def ensure_dirs():
    for k, v in P.items():
        if k.endswith("_dir"):
            v.mkdir(parents=True, exist_ok=True)
