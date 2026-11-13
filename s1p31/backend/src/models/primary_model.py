import warnings
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.model_selection import StratifiedKFold, cross_val_score, cross_val_predict, train_test_split
from sklearn.metrics import roc_auc_score, accuracy_score, classification_report, confusion_matrix, roc_curve, recall_score, precision_score
from sklearn.inspection import permutation_importance
from sklearn.base import clone
from config import settings as ST
from config.settings import C
from src.utils.paths import P
from src.utils.io_utils import save_json, save_fig, save_model, save_csv, register_chart
from src.utils.runner import DataTooSmall
from src.features.build import model_feature_lists

T = "low_margin"


def leakage_guard(X, y, num):
    keep, dropped = [], []
    for c in num:
        s = X[c].astype(float)
        if s.nunique() < 2:
            dropped.append({"feature": c, "reason": "constant"})
            continue
        s = s.fillna(s.median())
        try:
            auc = roc_auc_score(y, s)
            auc = max(auc, 1 - auc)
        except ValueError:
            auc = 0.5
        corr = abs(float(np.corrcoef(s, y)[0, 1]))
        if auc > ST.LEAK_AUC or corr > ST.LEAK_CORR:
            dropped.append({"feature": c, "reason": "single-feature AUC " + str(round(auc, 3)) + ", correlation " + str(round(corr, 3))})
        else:
            keep.append(c)
    return keep, dropped


def _pre(num, cat):
    n = Pipeline([("imp", SimpleImputer(strategy="median")), ("sc", StandardScaler())])
    c = Pipeline([("imp", SimpleImputer(strategy="most_frequent")), ("oh", OneHotEncoder(handle_unknown="ignore"))])
    return ColumnTransformer([("num", n, num), ("cat", c, cat)])


def _models():
    m = {"Logistic Regression": LogisticRegression(max_iter=2000, class_weight="balanced"),
         "Random Forest": RandomForestClassifier(n_estimators=300, min_samples_leaf=3, class_weight="balanced_subsample", random_state=ST.RANDOM_STATE, n_jobs=-1),
         "Gradient Boosting": GradientBoostingClassifier(random_state=ST.RANDOM_STATE)}
    try:
        from xgboost import XGBClassifier
        m["XGBoost"] = XGBClassifier(n_estimators=300, max_depth=4, learning_rate=0.05, eval_metric="logloss", random_state=ST.RANDOM_STATE, verbosity=0)
    except Exception:
        pass
    try:
        from lightgbm import LGBMClassifier
        m["LightGBM"] = LGBMClassifier(n_estimators=300, learning_rate=0.05, random_state=ST.RANDOM_STATE, verbose=-1)
    except Exception:
        pass
    return m


def _rule_score(d):
    T_ = ST.THRESHOLDS
    s = pd.Series(0, index=d.index)
    for col, op, lim in ((C["ontime"], "<", T_["ontime_min"]), (C["temp_share"], ">", T_["temp_share_max"]),
                         ("overtime_ratio", ">", T_["overtime_ratio_max"]), (C["pick_acc"], "<", T_["pick_acc_min"]),
                         (C["downtime"], ">", T_["downtime_max_hrs"]), (C["absent"], ">", T_["absent_max"])):
        if col in d.columns:
            s = s + ((d[col] < lim) if op == "<" else (d[col] > lim)).astype(int)
    return s


def fit_primary_model(df, verbose=True):
    warnings.filterwarnings("ignore")
    num, cat = model_feature_lists(df)
    y = df[T].astype(int)
    counts = y.value_counts()
    if len(counts) < 2 or counts.min() < 5:
        raise DataTooSmall("fewer than 5 rows in one target class")
    num, dropped = leakage_guard(df[num], y, num)
    save_json({"dropped": dropped, "rule": "single-feature AUC > " + str(ST.LEAK_AUC) + " or |corr| > " + str(ST.LEAK_CORR)}, P["leak_log"])
    feats = num + cat
    Xtr, Xte, ytr, yte = train_test_split(df[feats], y, test_size=ST.TEST_SIZE, stratify=y, random_state=ST.RANDOM_STATE)
    if len(Xtr) < ST.MIN_TRAIN_ROWS:
        raise DataTooSmall("fewer than " + str(ST.MIN_TRAIN_ROWS) + " training rows")
    low_sample = bool(len(df) < ST.RECOMMENDED_CLASS_ROWS or counts.min() < 10)
    folds = int(max(2, min(ST.CV_FOLDS, ytr.value_counts().min())))
    skf = StratifiedKFold(n_splits=folds, shuffle=True, random_state=ST.RANDOM_STATE)
    majority_acc = float(max(yte.mean(), 1 - yte.mean()))
    rs = _rule_score(df.loc[Xte.index])
    rule_acc = float(accuracy_score(yte, (rs >= 2).astype(int)))
    try:
        rule_auc = float(roc_auc_score(yte, rs))
    except ValueError:
        rule_auc = 0.5
    if verbose:
        print("Features used:", len(feats), " dropped by the leakage check:", len(dropped), "| low sample:", low_sample)
        print("Baselines on the held-out set: majority accuracy", round(majority_acc, 3), "| rule-based accuracy", round(rule_acc, 3), "AUC", round(rule_auc, 3))
    results, fitted = [], {}
    for name, mdl in _models().items():
        pipe = Pipeline([("pre", _pre(num, cat)), ("clf", mdl)])
        try:
            cv = cross_val_score(pipe, Xtr, ytr, cv=skf, scoring="roc_auc")
            pipe.fit(Xtr, ytr)
            prob = pipe.predict_proba(Xte)[:, 1]
            r = {"model": name, "cv_auc_mean": float(cv.mean()), "cv_auc_std": float(cv.std()),
                 "test_auc": float(roc_auc_score(yte, prob)), "test_acc": float(accuracy_score(yte, prob >= 0.5))}
        except Exception as exc:
            print("Model skipped:", name, "-", exc)
            continue
        results.append(r)
        fitted[name] = pipe
        if verbose:
            print(name.ljust(20), "CV-AUC", round(r["cv_auc_mean"], 3), "+/-", round(r["cv_auc_std"], 3), "| Test-AUC", round(r["test_auc"], 3), "| Test-Acc", round(r["test_acc"], 3))
    if not results:
        raise DataTooSmall("no model could be fitted")
    best = max(results, key=lambda r: r["cv_auc_mean"])["model"]   # chosen on cross-validation, never on the test set
    pipe = fitted[best]
    prob = pipe.predict_proba(Xte)[:, 1]
    pred = (prob >= 0.5).astype(int)
    b = next(r for r in results if r["model"] == best)
    beats = bool(b["test_auc"] >= 0.55 and b["test_auc"] > rule_auc - 0.02)
    if verbose:
        print("\nBest by cross-validation:", best, "| beats the baselines:", beats)
        print(classification_report(yte, pred, target_names=["Normal", "Low margin"], zero_division=0))
    fig, axes = plt.subplots(1, 2, figsize=(11, 4.5))
    cm = confusion_matrix(yte, pred)
    axes[0].imshow(cm, cmap="Blues")
    for (i, j), v in np.ndenumerate(cm):
        axes[0].text(j, i, int(v), ha="center", va="center")
    axes[0].set_xticks([0, 1], ["Normal", "Low margin"])
    axes[0].set_yticks([0, 1], ["Normal", "Low margin"])
    axes[0].set_xlabel("Predicted")
    axes[0].set_ylabel("Actual")
    axes[0].set_title("Confusion matrix (held-out)")
    fpr, tpr, _ = roc_curve(yte, prob)
    axes[1].plot(fpr, tpr, label="AUC " + str(round(b["test_auc"], 3)))
    axes[1].plot([0, 1], [0, 1], "--", color="grey", label="Naive")
    axes[1].set_xlabel("False positive rate")
    axes[1].set_ylabel("True positive rate")
    axes[1].legend()
    axes[1].set_title("ROC curve (held-out)")
    save_fig(fig, P["reports_dir"] / "model_performance.png")
    imp = permutation_importance(pipe, Xte, yte, n_repeats=5, random_state=ST.RANDOM_STATE, scoring="roc_auc")
    top = sorted(zip(feats, imp.importances_mean), key=lambda t: -t[1])[:15]
    fig, ax = plt.subplots(figsize=(7, 5))
    ax.barh([t[0] for t in top][::-1], [t[1] for t in top][::-1], color="#4C78A8")
    ax.set_xlabel("Drop in AUC when the feature is shuffled")
    ax.set_title("Top 15 drivers of low-margin days")
    save_fig(fig, P["reports_dir"] / "feature_importance.png")
    register_chart({"id": "feature_importance", "title": "Top drivers of low-margin days", "type": "bar", "x_label": "Feature", "y_label": "AUC drop",
                    "data": [{"label": k, "value": round(float(v), 4)} for k, v in top], "view": "overview", "file": "feature_importance.png"})
    oof = cross_val_predict(clone(pipe), df[feats], y, cv=skf, method="predict_proba")[:, 1]
    out = pd.DataFrame({"row_id": df["row_id"].values, "pred_low_margin": (oof >= 0.5).astype(int), "pred_prob": np.round(oof, 4)})
    save_csv(out, P["predictions"])
    save_model(pipe, P["model_file"])
    save_json({"numeric": num, "categorical": cat}, P["feature_list"])
    metrics = {"task": "classification", "target": T, "n_rows": int(len(df)), "n_train": int(len(Xtr)), "n_test": int(len(Xte)), "folds": folds,
               "low_sample": low_sample, "naive": {"majority_accuracy": majority_acc, "auc": 0.5},
               "rule_baseline": {"accuracy": rule_acc, "auc": rule_auc}, "models": results, "best": best, "beats_baseline": beats,
               "test_recall_low_margin": float(recall_score(yte, pred, zero_division=0)), "test_precision_low_margin": float(precision_score(yte, pred, zero_division=0)),
               "leakage_dropped": dropped, "top_features": [[k, float(v)] for k, v in top], "split": "stratified, seed " + str(ST.RANDOM_STATE)}
    save_json(metrics, P["clf_metrics"])
    return df.merge(out, on="row_id", how="left")
