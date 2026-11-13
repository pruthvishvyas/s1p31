import numpy as np
import pandas as pd
from config.settings import C, TEXT_KEYS, PCT_KEYS, CAP_KEYS
from src.utils.paths import P
from src.utils.io_utils import save_csv, save_json
from src.utils.runner import DataTooSmall


def clean_data(df, verbose=True):
    raw_rows = len(df)
    log = {"raw_rows": raw_rows, "removed": {}, "filled": {}, "clipped": {}, "capped": {}}
    d = df.copy()
    for c in d.columns:
        if d[c].dtype == object:
            d[c] = d[c].astype(str).str.strip().replace({"nan": np.nan, "": np.nan})
    for key, name in C.items():
        if key in TEXT_KEYS or name not in d.columns:
            continue
        if d[name].dtype == object:
            d[name] = pd.to_numeric(d[name].str.replace(r"[$,%\s]", "", regex=True), errors="coerce")
    d[C["date"]] = pd.to_datetime(d[C["date"]], errors="coerce")
    log["unparsed_dates"] = int(d[C["date"]].isna().sum())
    need = [C[k] for k in ("date", "site", "revenue", "total_cost", "orders_out", "units")]
    before = len(d)
    d = d.dropna(subset=need)
    log["removed"]["missing_key_fields"] = before - len(d)
    before = len(d)
    d = d[d[C["revenue"]] > 0]
    log["removed"]["non_positive_revenue"] = before - len(d)
    before = len(d)
    d = d.drop_duplicates([C["date"], C["site"]], keep="first")
    log["removed"]["duplicate_site_days"] = before - len(d)
    if C["day"] in d.columns:
        d[C["day"]] = d[C["day"]].astype(str).str[:3].str.title()
    for key in PCT_KEYS:
        name = C[key]
        if name in d.columns:
            out = int(((d[name] < 0) | (d[name] > 100)).sum())
            d[name] = d[name].clip(0, 100)
            if out:
                log["clipped"][name] = out
    for key in CAP_KEYS:
        name = C[key]
        if name in d.columns and d[name].notna().sum() > 10:
            q1, q3 = d[name].quantile(0.25), d[name].quantile(0.75)
            lo, hi = q1 - 3 * (q3 - q1), q3 + 3 * (q3 - q1)   # outer fences only, so real busy days are kept
            n = int(((d[name] < lo) | (d[name] > hi)).sum())
            if n:
                d[name] = d[name].clip(lo, hi)
                log["capped"][name] = n
    for name in d.select_dtypes("number").columns:
        n = int(d[name].isna().sum())
        if n:
            d[name] = d[name].fillna(d[name].median())
            log["filled"][name] = n
    d = d.sort_values([C["date"], C["site"]]).reset_index(drop=True)
    log["clean_rows"] = int(len(d))
    log["removed_share"] = round(1 - len(d) / max(raw_rows, 1), 4)
    if len(d) < 20:
        raise DataTooSmall("fewer than 20 rows left after cleaning")
    save_csv(d, P["clean"])
    save_json(log, P["cleaning_log"])
    if verbose:
        print("Raw rows:", raw_rows, " Clean rows:", len(d))
        print("Removed:", log["removed"])
        print("Values capped (before -> after counts of outliers):", log["capped"] or "none")
        print("Values clipped to 0-100:", log["clipped"] or "none", " Nulls filled:", log["filled"] or "none")
    return d
