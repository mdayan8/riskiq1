from typing import Dict, Any
import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler


def _build_training_data(seed: int = 42, n: int = 600):
    rng = np.random.default_rng(seed)

    loan_amount = rng.uniform(3000, 1_000_000_000, n)
    interest_rate = rng.uniform(3.5, 30, n)
    risk_indicators = rng.integers(0, 6, n)
    violations = rng.integers(0, 5, n)
    clauses_count = rng.integers(0, 10, n)

    loan_amount_log = np.log10(np.maximum(loan_amount, 1.0))
    X = np.column_stack([loan_amount_log, interest_rate, risk_indicators, violations, clauses_count])

    base_risk = (
        0.22 * ((loan_amount_log - np.log10(3000)) / (np.log10(1_000_000_000) - np.log10(3000)))
        + 0.28 * ((interest_rate - 3.5) / (30 - 3.5))
        + 0.20 * (risk_indicators / 5)
        + 0.26 * (violations / 4)
        - 0.12 * (clauses_count / 9)
    )

    fraud_signal = (
        0.18 * ((loan_amount_log - np.log10(3000)) / (np.log10(1_000_000_000) - np.log10(3000)))
        + 0.34 * (risk_indicators / 5)
        + 0.34 * (violations / 4)
        - 0.15 * (clauses_count / 9)
    )

    y_risk = (base_risk + rng.normal(0, 0.08, n) > 0.52).astype(int)
    y_fraud = (fraud_signal + rng.normal(0, 0.09, n) > 0.58).astype(int)

    return X, y_risk, y_fraud


def _build_models():
    X, y_risk, y_fraud = _build_training_data()

    risk_model = Pipeline(
        steps=[
            ("scaler", StandardScaler()),
            ("clf", LogisticRegression(max_iter=1000, class_weight="balanced")),
        ]
    )
    risk_model.fit(X, y_risk)

    fraud_model = RandomForestClassifier(
        n_estimators=250,
        max_depth=8,
        min_samples_leaf=3,
        class_weight="balanced_subsample",
        random_state=7,
    )
    fraud_model.fit(X, y_fraud)

    return risk_model, fraud_model


RISK_MODEL, FRAUD_MODEL = _build_models()


def _first_number(values, default=0.0):
    if not values:
        return default
    first = values[0]
    if isinstance(first, (int, float)):
        return float(first)

    s = str(first)
    cleaned = "".join(ch for ch in s if ch.isdigit() or ch == ".")
    return float(cleaned) if cleaned else default


def _clip(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, v))


def _bucket(score: float):
    if score >= 0.75:
        return "HIGH"
    if score >= 0.40:
        return "MEDIUM"
    return "LOW"


def score_decision(extracted_data: Dict[str, Any], compliance_summary: Dict[str, Any]):
    loan_amount = _first_number(extracted_data.get("amounts", []), 0.0)
    interest_rate = _first_number(extracted_data.get("interest_rates", []), 0.0)
    risks = len(extracted_data.get("risk_indicators", []))
    violations = int(compliance_summary.get("violations_count", 0))
    clauses_count = len(extracted_data.get("clauses", []))

    loan_amount_safe = _clip(loan_amount if loan_amount > 0 else 3000.0, 3000.0, 1_000_000_000.0)
    interest_rate_safe = _clip(interest_rate if interest_rate > 0 else 3.5, 0.1, 60.0)
    loan_amount_log = float(np.log10(max(loan_amount_safe, 1.0)))
    features = np.array([[loan_amount_log, interest_rate_safe, risks, violations, clauses_count]], dtype=float)

    risk_score = float(RISK_MODEL.predict_proba(features)[0][1])
    fraud_score = float(FRAUD_MODEL.predict_proba(features)[0][1])

    missing_core = loan_amount <= 0 or interest_rate <= 0
    if missing_core:
        risk_score = min(0.98, risk_score + 0.08)
        fraud_score = min(0.98, fraud_score + 0.08)

    if clauses_count == 0:
        risk_score = min(0.98, risk_score + 0.08)
        fraud_score = min(0.98, fraud_score + 0.05)

    # Rulebook pass should materially reduce raw model risk when fraud and indicators are not elevated.
    if violations == 0 and fraud_score < 0.55:
        risk_score = max(0.02, risk_score - 0.16)

    if violations == 0 and risks == 0 and clauses_count >= 2:
        risk_score = max(0.02, risk_score - 0.10)
        fraud_score = max(0.02, fraud_score - 0.09)

    # Compliance violations and elevated fraud should have explicit additive pressure.
    risk_score += min(0.24, violations * 0.05)
    if fraud_score >= 0.7:
        risk_score += 0.08
    elif fraud_score >= 0.5:
        risk_score += 0.03

    risk_score = max(0.01, min(0.99, risk_score))
    fraud_score = max(0.01, min(0.99, fraud_score))

    risk_category = _bucket(risk_score)
    fraud_label = _bucket(fraud_score)
    confidence = round(
        _clip(
            0.45
            + abs(risk_score - 0.5) * 0.55
            + min(0.10, violations * 0.02)
            + (0.06 if fraud_score >= 0.7 else 0.0),
            0.40,
            0.99,
        ),
        4,
    )

    if violations == 0 and fraud_score < 0.50 and risk_score >= 0.75:
        risk_category = "MEDIUM"

    return {
        "score": round(risk_score, 4),
        "fraud_score": round(fraud_score, 4),
        "fraud_label": fraud_label,
        "confidence": confidence,
        "risk_category": risk_category,
        "model": "LogReg+RandomForest-v3",
        "drivers": {
            "rule_violations": violations,
            "risk_indicators": risks,
            "fraud_signal": round(fraud_score, 4),
            "missing_core_fields": missing_core,
        },
        "features": {
            "loan_amount": loan_amount,
            "interest_rate": interest_rate,
            "risk_indicator_count": risks,
            "compliance_violations": violations,
            "clauses_count": clauses_count,
        },
    }
