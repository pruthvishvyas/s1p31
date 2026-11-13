# s1p31

## Business Problem

A warehouse fulfilment operation needs to see where margin is lost, which operating conditions sit behind weak days, and what to do about them this week.

## The Core Finding

Across 1,000 site-days, the overall margin is 8.91%. 25.1% of site-days fall in the weakest margin band.

## Dataset

1,000 daily site records from 2025-10-01 to 2026-09-15, 4 warehouses.

## Project Structure

```
s1p31/
  .gitignore
  README.md
  backend/
    export_for_frontend.py
    main.py
    requirements.txt
    config/
      __init__.py
      goals.json
      settings.py
    data/
      interim/
        alerts.json
        chart_registry.json
        cleaning_log.json
        goal_progress.json
        leakage_log.json
        scenario_index.json
        target_meta.json
        validation_report.json
        simulations/
          agency_conversion.json
          error_reduction.json
          overtime_shift.json
      processed/
        business_actions.csv
        clean_data.csv
        feature_store.csv
        forecast_metrics.json
        forecast_output.csv
        model_metrics.json
        model_predictions.csv
        regression_metrics.json
        segment_meta.json
        segments_anomalies.csv
      raw/
        s1p31.csv
    logs/
    models/
      anomaly_model.joblib
      feature_cols.json
      margin_regressor.joblib
      model_hashes.json
      primary_model.joblib
      segment_model.joblib
    notebooks/
      s1p31_analysis.ipynb
    output/
      frontend_contract.json
      decide/
        goals.json
        insights.json
        recommendations.json
        simulations.json
        simulations/
          agency_conversion.json
          error_reduction.json
          overtime_shift.json
      meta/
```

## How It Works

The raw file is validated and cleaned, then turned into operating ratios and a risk score. A model compares conditions on weak-margin days with the rest, a segmentation groups site-days by risk, a rule layer raises alerts with actions, scenarios price the main levers, and a forecast looks a month ahead.

## Models

| Model | Status |
| --- | --- |
| Low-margin risk model | Ready |
| Segments | Ready |
| Unusual-day detector | Ready |
| Margin regressor | Ready |

## Key Insights

- One site-day in four sits in the weakest margin band (251 of 1000 site-days have a margin at or below 0.6 percent; overall margin is 8.91 percent)
- WH-South (Atlanta) earns the lowest margin of the warehouses (WH-South (Atlanta) -10.15 percent against WH-Central (Dallas) 17.77 percent)
- overtime_ratio is the measure most tied to weak margin days (Low-margin share is 42.4 percent when it is in the top quarter (250 site-days) against 10.9 percent in the bottom quarter (258 site-days))

## How to Run

1. Open a terminal in the backend folder.
2. Install the packages: pip install -r requirements.txt
3. Run the pipeline: python main.py (or open the notebook in notebooks/).
4. Refresh the dashboard data: python export_for_frontend.py
5. Read the reports in reports/ and the data files in output/.
6. Start the dashboard from the frontend folder using its own README.

## Output Files

| File | Purpose |
| --- | --- |
| reports/*.png | Charts |
| reports/s1p31_report.xlsx | Workbook |
| reports/interactive_dashboard.html | Interactive dashboard |
| reports/insights.json | Insights |
| output/ | Dashboard data |

## Tech Stack

Python, pandas, scikit-learn, matplotlib, seaborn, plotly, openpyxl, joblib.