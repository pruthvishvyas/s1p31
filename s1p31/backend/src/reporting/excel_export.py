import pandas as pd
from datetime import datetime
from config.settings import C, PROJECT_NAME, TERMINOLOGY
from src.utils.paths import P
from src.utils.io_utils import guard_text

BAD = '[]:*?/\\'


def sheet_name(s):
    return "".join("_" if ch in BAD else ch for ch in s)[:31]


def write_workbook(df, verbose=True):
    rev, prof = C["revenue"], C["profit"]
    summary = pd.DataFrame({"Measure": ["Site-days", "Total " + TERMINOLOGY["revenue"].lower(), "Gross profit", "Weighted margin (%)", "Average on-time (%)", "Low-margin share (%)", "Urgent site-days"],
                            "Value": [len(df), round(df[rev].sum(), 2), round(df[prof].sum(), 2), round(df[prof].sum() / max(df[rev].sum(), 1) * 100, 2),
                                      round(df[C["ontime"]].mean(), 2) if C["ontime"] in df.columns else None, round(df["low_margin"].mean() * 100, 2),
                                      int((df["priority"] == "P1_URGENT").sum()) if "priority" in df.columns else None]})
    sheets = {"Operations Summary": summary}
    if "priority" in df.columns:
        pr = df.groupby("priority").agg(site_days=("row_id", "count"), low_margin_share=("low_margin", "mean")).reset_index()
        pr["low_margin_share"] = (pr["low_margin_share"] * 100).round(2)
        act = df[df["priority"].isin(["P1_URGENT", "P2_HIGH"])].sort_values("priority")[[C["date"], C["site"], "priority", "alerts", "recommendations"]].head(1000)
        sheets["Priority Actions"] = pd.concat([pr, pd.DataFrame({"priority": [""]}), act.rename(columns={C["date"]: "date", C["site"]: "warehouse"})], ignore_index=True)
    else:
        sheets["Priority Actions"] = pd.DataFrame({"note": ["Not available: business rules did not run"]})
    if "segment" in df.columns:
        sg = df.groupby("segment").agg(site_days=("row_id", "count"), margin_pct=(C["margin"], "mean"), risk_score=("ops_risk_score", "mean"), low_margin_share=("low_margin", "mean")).round(3).reset_index()
        sheets["Segment Summary"] = sg
    else:
        sheets["Segment Summary"] = pd.DataFrame({"note": ["Not available: segmentation did not run"]})
    site = df.groupby(C["site"]).agg(site_days=("row_id", "count"), revenue=(rev, "sum"), profit=(prof, "sum"), low_margin_share=("low_margin", "mean")).reset_index()
    site["margin_pct"] = (site["profit"] / site["revenue"].replace(0, 1) * 100).round(2)
    site["low_margin_share"] = (site["low_margin"] if "low_margin" in site else site["low_margin_share"] * 100).round(2) if False else (site["low_margin_share"] * 100).round(2)
    sheets["Site Performance"] = site
    cap = 1048000
    allrec = df.head(cap)
    sheets["All Records"] = allrec
    path = P["workbook"]
    for attempt in range(2):
        try:
            with pd.ExcelWriter(path, engine="openpyxl") as xw:
                for name, frame in sheets.items():
                    guard_text(frame).to_excel(xw, sheet_name=sheet_name(name), index=False)
                if len(df) > cap:
                    pd.DataFrame({"note": ["Capped at the spreadsheet row limit"]}).to_excel(xw, sheet_name="Note", index=False)
                props = xw.book.properties
                props.creator, props.lastModifiedBy, props.title = "", "", PROJECT_NAME
            break
        except PermissionError:
            path = path.with_name(path.stem + "_" + datetime.now().strftime("%Y%m%d_%H%M%S") + path.suffix)
            print("Workbook is open elsewhere; saving as", path.name)
    if verbose:
        print("Workbook written:", path.name, "| sheets:", ", ".join(sheets))
    return path
