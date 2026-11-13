import json, math, hashlib
from datetime import datetime, date
from decimal import Decimal
from pathlib import Path
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import joblib
from config.settings import C
from src.utils.paths import P


def _clean(o):
    if o is pd.NaT:
        return None
    if isinstance(o, dict):
        return {str(k): _clean(v) for k, v in o.items()}
    if isinstance(o, (list, tuple, set)):
        return [_clean(v) for v in o]
    if isinstance(o, np.ndarray):
        return _clean(o.tolist())
    if isinstance(o, (bool, np.bool_)):
        return bool(o)
    if isinstance(o, (int, np.integer)):
        return int(o)
    if isinstance(o, (float, np.floating)):
        f = float(o)
        return None if (math.isnan(f) or math.isinf(f)) else f
    if isinstance(o, Decimal):
        return float(o)
    if isinstance(o, (pd.Timestamp, pd.Period, datetime, date)):
        return str(o)
    if isinstance(o, Path):
        return str(o)
    return o


def save_json(obj, path):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(_clean(obj), indent=2, ensure_ascii=False), encoding="utf-8")


def read_json(path, default=None):
    try:
        return json.loads(Path(path).read_text(encoding="utf-8"))
    except Exception:
        return default


def save_csv(df, path):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(path, index=False, encoding="utf-8")


def save_fig(fig, path):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(path, dpi=150, bbox_inches="tight", metadata={"Software": None})
    plt.close(fig)


def _sha(path):
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def save_model(obj, path):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(obj, path)
    hashes = read_json(P["hashes"], {}) or {}
    hashes[path.name] = _sha(path)
    save_json(hashes, P["hashes"])


def load_model(path):
    path = Path(path)
    hashes = read_json(P["hashes"], {}) or {}
    if hashes.get(path.name) != _sha(path):
        raise ValueError("Model file " + path.name + " does not match its recorded hash. Re-run the pipeline.")
    return joblib.load(path)


def load_required(path, producer):
    if not Path(path).exists():
        raise FileNotFoundError("Missing " + Path(path).name + ". Run the " + producer + " step first.")
    return Path(path)


def read_table(path):
    path = Path(path)
    if path.suffix.lower() in (".xlsx", ".xls"):
        df = pd.read_excel(path)
    else:
        df, last = None, None
        for enc in ("utf-8", "utf-8-sig", "latin-1", "cp1252"):
            try:
                df = pd.read_csv(path, encoding=enc)
                break
            except UnicodeDecodeError as exc:
                last = exc
            except Exception as exc:
                last = exc
                break
        if df is None or df.shape[1] <= 1:
            for enc in ("utf-8", "utf-8-sig", "latin-1", "cp1252"):
                try:
                    df = pd.read_csv(path, sep=None, engine="python", encoding=enc)
                    break
                except Exception as exc:
                    last = exc
        if df is None:
            raise ValueError("Could not read " + path.name + ": " + str(last))
    df.columns = [str(c).strip() for c in df.columns]
    df = df.loc[:, ~df.columns.str.startswith("Unnamed:")]
    return df.dropna(how="all").dropna(axis=1, how="all").reset_index(drop=True)


def load_frame(key):
    df = read_table(load_required(P[key], key))
    if C["date"] in df.columns:
        df[C["date"]] = pd.to_datetime(df[C["date"]], errors="coerce")
    return df


def enriched():
    df = load_frame("features")
    for key in ("predictions", "segments"):
        if P[key].exists():
            extra = read_table(P[key])
            cols = [c for c in extra.columns if c == "row_id" or c not in df.columns]
            df = df.merge(extra[cols], on="row_id", how="left")
    return df


def register_chart(spec):
    cur = read_json(P["chart_registry"], [])
    if not isinstance(cur, list):
        cur = []
    cur = [c for c in cur if c.get("id") != spec["id"]] + [spec]
    save_json(cur, P["chart_registry"])


def guard_text(df):
    out = df.copy()
    for c in out.columns:
        if out[c].dtype == object:
            out[c] = out[c].map(lambda v: "'" + v if isinstance(v, str) and v[:1] in ("=", "+", "-", "@") else v)
    return out
