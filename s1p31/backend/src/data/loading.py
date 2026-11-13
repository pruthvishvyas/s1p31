import re
import numpy as np
import pandas as pd
from config.settings import C, COLUMNS
from src.utils.paths import P, ensure_dirs
from src.utils.io_utils import read_table, save_json
from src.utils.columns import resolve_columns

PII_TOKENS = {"email", "phone", "ssn", "dob", "ip", "address", "name", "mobile"}
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[a-z]{2,}$", re.I)
PHONE_RE = re.compile(r"^\+?[\d\s().-]{9,16}$")


def drop_pii(df):
    known = {v[0] for v in COLUMNS.values()}
    flagged = []
    for c in df.columns:
        if c in known:
            continue
        tokens = set(re.split(r"[^a-z0-9]+", c.lower()))
        by_header = bool(tokens & PII_TOKENS)
        by_value = False
        if df[c].dtype == object:
            sample = df[c].dropna().astype(str).head(200)
            if len(sample):
                share = sample.map(lambda v: bool(EMAIL_RE.match(v) or PHONE_RE.match(v))).mean()
                by_value = share > 0.5
        if by_header or by_value:
            flagged.append(c)
    return df.drop(columns=flagged), flagged


def validate(df, missing_opt, pii):
    nulls = {c: int(n) for c, n in df.isna().sum().items() if n > 0}
    rep = {"rows": int(len(df)), "cols": int(df.shape[1]), "nulls": nulls,
           "dtypes": {str(k): int(v) for k, v in df.dtypes.astype(str).value_counts().items()},
           "missing_optional_columns": missing_opt, "pii_columns_removed": pii, "checks": {}}
    for key in ("site", "automation", "day", "month", "peak"):
        if C[key] in df.columns:
            rep.setdefault("value_counts", {})[C[key]] = {str(k): int(v) for k, v in df[C[key]].value_counts().head(20).items()}
    chk = rep["checks"]
    dates = pd.to_datetime(df[C["date"]], errors="coerce")
    chk["unparsed_dates"] = int(dates.isna().sum())
    for key in ("revenue", "total_cost", "units", "orders_out"):
        v = pd.to_numeric(df[C[key]], errors="coerce")
        chk["negative_" + key] = int((v < 0).sum())
    for key in ("temp_share", "absent", "ontime", "pick_acc", "inv_acc", "storage", "dock_util"):
        if C[key] in df.columns:
            v = pd.to_numeric(df[C[key]], errors="coerce")
            chk["outside_0_100_" + key] = int(((v < 0) | (v > 100)).sum())
    rev, cost, prof, mar = (pd.to_numeric(df[C[k]], errors="coerce") for k in ("revenue", "total_cost", "profit", "margin"))
    chk["profit_identity_mismatch"] = int(((rev - cost - prof).abs() > 1.0).sum())
    chk["margin_identity_mismatch"] = int((((prof / rev.replace(0, np.nan)) * 100 - mar).abs() > 0.1).sum())
    chk["duplicate_site_days"] = int(df.duplicated([C["date"], C["site"]]).sum())
    rep["schema_ok"] = True
    return rep


def load_inputs(verbose=True):
    ensure_dirs()
    raw = read_table(P["raw_csv"])
    df, missing_opt = resolve_columns(raw)
    df, pii = drop_pii(df)
    rep = validate(df, missing_opt, pii)
    save_json(rep, P["validation"])
    if verbose:
        print("Rows:", rep["rows"], " Columns:", rep["cols"])
        print("Columns with nulls:", rep["nulls"] or "none")
        print("Optional columns missing:", missing_opt or "none", " Personal-data columns removed:", pii or "none")
        for k, v in rep["checks"].items():
            if v:
                print("  check", k, "->", v)
        for col, vc in rep.get("value_counts", {}).items():
            print("  " + col + ":", vc)
    return df
