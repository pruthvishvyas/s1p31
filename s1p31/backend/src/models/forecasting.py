import warnings
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from sklearn.pipeline import Pipeline
from sklearn.impute import SimpleImputer
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.linear_model import LinearRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, r2_score
from config import settings as ST
from config.settings import C
from src.utils.paths import P
from src.utils.io_utils import save_json, save_fig, save_model, save_csv
from src.utils.runner import DataTooSmall
from src.features.build import model_feature_lists


def fit_margin_regression(df, verbose=True):
    warnings.filterwarnings("ignore")
    num, _ = model_feature_lists(df)
    y = df[C["margin"]].astype(float)
    keep = [c for c in num if df[c].nunique() > 1 and abs(np.corrcoef(df[c].fillna(df[c].median()), y)[0, 1]) <= ST.LEAK_CORR]
    if len(df) < ST.MIN_TRAIN_ROWS * 2:
        raise DataTooSmall("fewer than " + str(ST.MIN_TRAIN_ROWS * 2) + " rows for a margin regression")
    Xtr, Xte, ytr, yte = train_test_split(df[keep], y, test_size=ST.TEST_SIZE, random_state=ST.RANDOM_STATE)
    mdl = Pipeline([("imp", SimpleImputer(strategy="median")), ("gb", GradientBoostingRegressor(n_estimators=300, max_depth=3, learning_rate=0.05, subsample=0.8, random_state=ST.RANDOM_STATE))])
    mdl.fit(Xtr, ytr)
    pred = mdl.predict(Xte)
    base = np.full(len(yte), ytr.mean())
    res = {"task": "regression", "target": C["margin"], "n_train": int(len(Xtr)), "n_test": int(len(Xte)), "low_sample": bool(len(df) < ST.RECOMMENDED_REG_ROWS),
           "mae": float(mean_absolute_error(yte, pred)), "r2": float(r2_score(yte, pred)),
           "baseline_mae": float(mean_absolute_error(yte, base)), "baseline_r2": float(r2_score(yte, base)), "features": keep}
    res["beats_baseline"] = bool(res["mae"] < res["baseline_mae"])
    save_model(mdl, P["reg_model"])
    save_json(res, P["reg_metrics"])
    fig, axes = plt.subplots(1, 2, figsize=(11, 4.5))
    axes[0].scatter(yte, pred, s=10, alpha=0.6)
    lo, hi = float(min(yte.min(), pred.min())), float(max(yte.max(), pred.max()))
    axes[0].plot([lo, hi], [lo, hi], "--", color="grey")
    axes[0].set_xlabel("Actual margin (%)")
    axes[0].set_ylabel("Predicted margin (%)")
    axes[0].set_title("Held-out margin: actual against predicted")
    axes[1].hist(yte - pred, bins=25, color="#4C78A8")
    axes[1].set_xlabel("Residual (points)")
    axes[1].set_title("Residuals")
    save_fig(fig, P["reports_dir"] / "margin_regression.png")
    if verbose:
        print("Margin regression, held-out: MAE", round(res["mae"], 3), "vs baseline", round(res["baseline_mae"], 3), "| R2", round(res["r2"], 3))
    return res


def _design(idx, t0):
    t = (np.arange(len(idx)) + t0).astype(float)
    dow = (idx.dayofweek.values[:, None] == np.arange(7)).astype(float)
    return np.column_stack([t, dow])


def _mape(a, f):
    a, f = np.asarray(a, float), np.asarray(f, float)
    m = a != 0
    return float(np.mean(np.abs(a[m] - f[m]) / np.abs(a[m])) * 100) if m.any() else None


def build_forecast(df, verbose=True):
    daily = df.groupby(C["date"])[C["revenue"]].mean().sort_index().asfreq("D")
    filled = int(daily.isna().sum())
    daily = daily.interpolate().bfill().ffill()
    n = len(daily)
    if n < 28:
        raise DataTooSmall("fewer than 28 days of history for a forecast")
    test_n = max(14, int(n * 0.2))
    train, test = daily.iloc[:-test_n], daily.iloc[-test_n:]
    if len(train) < 14:
        raise DataTooSmall("fewer than two weekly cycles before the holdout period")
    seasonal = np.resize(train.values[-7:], test_n)
    lr = LinearRegression().fit(_design(train.index, 0), train.values)
    pred = lr.predict(_design(test.index, len(train)))
    m = {"task": "forecast", "series": "average revenue per site-day", "n_days": int(n), "holdout_days": int(test_n), "filled_days": filled,
         "mae": float(mean_absolute_error(test, pred)), "mape": _mape(test, pred),
         "baseline_mae": float(mean_absolute_error(test, seasonal)), "baseline_mape": _mape(test, seasonal), "baseline": "seasonal naive (last 7 days repeated)",
         "horizon_days": ST.HORIZON_DAYS}
    m["beats_baseline"] = bool(m["mae"] < m["baseline_mae"])
    full = LinearRegression().fit(_design(daily.index, 0), daily.values)
    fidx = pd.date_range(daily.index[-1] + pd.Timedelta(days=1), periods=ST.HORIZON_DAYS, freq="D")
    fut = full.predict(_design(fidx, n))
    rows = [(d, v, "actual") for d, v in daily.iloc[-60:].items()] + [(d, v, "holdout_prediction") for d, v in zip(test.index, pred)] + [(d, v, "forecast") for d, v in zip(fidx, fut)]
    out = pd.DataFrame(rows, columns=["date", "value", "kind"])
    out["value"] = out["value"].round(2)
    save_csv(out, P["forecast"])
    save_json(m, P["fc_metrics"])
    if verbose:
        print("Forecast of", m["series"], "- holdout", test_n, "days: MAE", round(m["mae"], 1), "MAPE", None if m["mape"] is None else round(m["mape"], 2),
              "| seasonal-naive MAE", round(m["baseline_mae"], 1), "| beats baseline:", m["beats_baseline"])
    return out
