import difflib, re
from config.settings import COLUMNS


def _norm(s):
    return re.sub(r"[^a-z0-9]", "", str(s).lower())


def resolve_columns(df):
    '''Map the client headers onto the expected names: exact, then normalised, then close match.'''
    actual = list(df.columns)
    norm = {_norm(c): c for c in actual}
    ren, missing_req, missing_opt = {}, [], []
    for key, (name, required) in COLUMNS.items():
        if name in actual:
            continue
        hit = norm.get(_norm(name))
        if hit is None:
            close = difflib.get_close_matches(_norm(name), list(norm), n=1, cutoff=0.85)
            if close:
                hit = norm[close[0]]
                print("Column notice: using '" + hit + "' for expected '" + name + "'")
        if hit is not None and hit not in ren:
            ren[hit] = name
        elif required:
            cands = difflib.get_close_matches(name, actual, n=3, cutoff=0.4)
            missing_req.append(name + " (closest: " + (", ".join(cands) or "none") + ")")
        else:
            missing_opt.append(name)
    if missing_req:
        raise ValueError("Required columns not found: " + "; ".join(missing_req) + ". Headers present: " + ", ".join(actual))
    return df.rename(columns=ren), missing_opt
