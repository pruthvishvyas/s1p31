import time, traceback
from datetime import datetime
from pathlib import Path
from src.utils.paths import P
from src.utils.io_utils import save_json, read_json


class DataTooSmall(Exception):
    pass


RUN = []


def _stand_in(produces, status, reason):
    for p in produces:
        p = Path(p)
        if p.suffix == ".json" and not p.exists():
            save_json({"status": status.lower(), "reason": reason}, p)


def run_stage(name, fn, requires=(), produces=()):
    t0, status, reason = time.time(), "ok", ""
    missing = [Path(r).name for r in requires if not Path(r).exists()]
    if missing:
        status, reason = "skipped", "missing upstream output: " + ", ".join(missing)
    else:
        try:
            fn()
        except DataTooSmall as exc:
            status, reason = "skipped", str(exc)
        except Exception as exc:
            status, reason = "failed", type(exc).__name__ + ": " + str(exc)
            print(traceback.format_exc())
        if status == "ok":
            bad = [Path(p).name for p in produces if not Path(p).exists() or Path(p).stat().st_size == 0]
            if bad:
                status, reason = "failed", "no output written: " + ", ".join(bad)
    if status != "ok":
        _stand_in(produces, status, reason)
    RUN.append({"stage": name, "status": status, "seconds": round(time.time() - t0, 1), "reason": reason,
                "outputs": [Path(p).name for p in produces]})
    print("[" + status.upper().ljust(7) + "] " + name + ((" - " + reason) if reason else ""))


def verify_outputs():
    rows = []
    for r in RUN:
        for p in r["outputs"]:
            found = [x for x in P.values() if isinstance(x, Path) and x.name == p]
            ok = bool(found) and found[0].exists() and found[0].stat().st_size > 0
            if ok and found[0].suffix == ".json":
                ok = read_json(found[0], None) is not None
            rows.append((r["stage"], r["status"], p, "ok" if ok else "missing"))
    print("\n" + "stage".ljust(28) + "status".ljust(10) + "output".ljust(30) + "check")
    for s, st, o, ok in rows:
        print(s.ljust(28) + st.ljust(10) + o.ljust(30) + ok)
    hist = read_json(P["run_log"], {}) or {}
    runs = hist.get("runs", []) if isinstance(hist, dict) else []
    runs.append({"finished": datetime.now().isoformat(timespec="seconds"), "stages": RUN})
    save_json({"runs": runs[-20:], "last_run": runs[-1]["finished"]}, P["run_log"])
    return rows
