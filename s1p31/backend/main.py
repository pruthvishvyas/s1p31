import warnings
warnings.filterwarnings("ignore")
from src.utils.paths import P, ensure_dirs
from src.utils.io_utils import load_frame, enriched
from src.utils.runner import run_stage, verify_outputs
from src.data.loading import load_inputs
from src.data.cleaning import clean_data
from src.features.build import build_features, add_target
from src.analysis.explore import run_charts
from src.models.primary_model import fit_primary_model
from src.models.segments import run_segments
from src.models.forecasting import fit_margin_regression, build_forecast
from src.analytics.rules import apply_rules
from src.analytics.what_if import build_scenarios
from src.analytics.goals import ensure_goals, evaluate_goals
from src.analytics.findings import build_insights
from src.reporting.excel_export import write_workbook
from src.reporting.dashboard import write_dashboard, print_summary

S = {}


def _feat():
    if "feat" not in S:
        S["feat"] = enriched()
    return S["feat"]


def s_ingest():
    S["raw"] = load_inputs()


def s_clean():
    S["clean"] = clean_data(S["raw"] if "raw" in S else load_inputs())


def s_features():
    S["feat"] = add_target(build_features(S["clean"] if "clean" in S else load_frame("clean")))


def s_charts():
    run_charts(_feat())


def s_model():
    S["feat"] = fit_primary_model(_feat())


def s_segments():
    S["feat"] = run_segments(_feat())


def s_regression():
    fit_margin_regression(_feat())


def s_forecast():
    build_forecast(_feat())


def s_rules():
    S["feat"] = apply_rules(_feat())


def s_scenarios():
    build_scenarios(_feat())


def s_goals():
    ensure_goals()
    evaluate_goals(_feat())


def s_insights():
    build_insights(_feat())


def s_reports():
    write_workbook(_feat())
    write_dashboard(_feat())


def main():
    ensure_dirs()
    run_stage("Data intake", s_ingest, produces=[P["validation"]])
    run_stage("Data cleaning", s_clean, requires=[P["validation"]], produces=[P["clean"], P["cleaning_log"]])
    run_stage("Feature engineering", s_features, requires=[P["clean"]], produces=[P["features"], P["target_meta"]])
    run_stage("Exploratory charts", s_charts, requires=[P["features"]], produces=[P["chart_registry"]])
    run_stage("Low-margin risk model", s_model, requires=[P["features"]], produces=[P["clf_metrics"], P["model_file"], P["predictions"]])
    run_stage("Segments and unusual days", s_segments, requires=[P["features"]], produces=[P["segments"], P["seg_meta"]])
    run_stage("Margin regression", s_regression, requires=[P["features"]], produces=[P["reg_metrics"]])
    run_stage("Revenue forecast", s_forecast, requires=[P["features"]], produces=[P["forecast"], P["fc_metrics"]])
    run_stage("Alerts and actions", s_rules, requires=[P["features"]], produces=[P["actions"]])
    run_stage("What-if scenarios", s_scenarios, requires=[P["features"]], produces=[P["scenario_index"]])
    run_stage("Targets and goal progress", s_goals, requires=[P["features"]], produces=[P["goal_progress"], P["alerts"]])
    run_stage("Insights", s_insights, requires=[P["features"]], produces=[P["insights"]])
    run_stage("Workbook and dashboard", s_reports, requires=[P["features"]], produces=[P["workbook"], P["dash_html"]])
    verify_outputs()
    try:
        print_summary(_feat())
    except Exception as exc:
        print("Summary not printed:", exc)


if __name__ == "__main__":
    main()
