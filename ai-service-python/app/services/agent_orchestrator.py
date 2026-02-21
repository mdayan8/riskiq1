from datetime import datetime
from typing import Any, Dict, List

from app.services.compliance_service import validate_rules
from app.services.decision_service import score_decision
from app.services.deepseek_service import extract_structured_data, classify_document_type
from app.services.extract_service import extract_document_text, normalize_output, detect_document_profile
from app.services.rules_loader import load_rules


DEFAULT_AGENT_PROMPTS = {
    "DocumentAgent": (
        "You are DocumentAgent, a specialized entity extractor for RiskIQ. "
        "Extract required structured data in strict JSON. Identify critical clauses, counterparties, and fiscal metrics. "
        "Highlight 'risk_indicators' that suggest high financial exposure or jurisdictional complexity."
    ),
    "ComplianceAgent": (
        "You are ComplianceAgent, the regulatory gatekeeper. "
        "Validate extracted data against GRC/RBI rules. For every violation, explain 'Why it failed' and 'How to fix'. "
        "Use colors: SAFE=GREEN (no violations), FLAGGED=ORANGE (minor), BREACH=RED (critical)."
    ),
    "DecisionAgent": (
        "You are DecisionAgent, an ensemble model orchestrator using Logistic Regression and Random Forest signals. "
        "Analyze features (Loan Amount, Interest Spread, Violations) and output a finalized Risk Score (0.0-1.0). "
        "Color Logic: [0.0 - 0.15] => Safe (GREEN), [0.15 - 0.60] => Low/Med (ORANGE), [>0.60] => High (RED)."
    ),
    "MonitoringAgent": "You are MonitoringAgent. Detect live anomalies and drift in financial trends. Flag ORANGE/RED popups.",
    "ReportingAgent": (
        "You are ReportingAgent. Produce executive summaries integrating Logistic Regression and RandomForest probability. "
        "Explicitly mention Violation counts and specific model drivers for transparency."
    )
}

AGENT_IDENTITIES = {
    "DocumentAgent": {
        "name": "Argus Extractor",
        "role": "Document Intelligence Specialist",
        "focus": "DeepSeek-powered entity and clause extraction with semantic mapping",
    },
    "ComplianceAgent": {
        "name": "Sentinel Regulator",
        "role": "Regulatory Validation Specialist",
        "focus": "Rule-engine synchronization with RBI / BCBS GRC standards",
    },
    "DecisionAgent": {
        "name": "Orion Scorer",
        "role": "Risk Decision Specialist",
        "focus": "Ensemble ML (LogReg + RandomForest) scoring architecture",
    },
    "MonitoringAgent": {
        "name": "Pulse Watcher",
        "role": "Anomaly Monitoring Specialist",
        "focus": "Real-time telemetry and predictive drift monitoring",
    },
    "ReportingAgent": {
        "name": "Atlas Reporter",
        "role": "Audit Reporting Specialist",
        "focus": "C-level executive reporting with integrated model traceability",
    },
}

DOC_TYPE_RULE_FIELDS = {
    "loan_agreement": {
        "names", "amounts", "interest_rates", "dates", "clauses",
        "risk_indicators", "obligations", "counterparties",
        "consent_clauses", "data_protection_clauses",
    },
    "kyc_document": {
        "names", "counterparties", "dates", "risk_indicators",
        "consent_clauses", "data_protection_clauses",
    },
    "transaction_statement": {
        "names", "amounts", "dates", "counterparties", "risk_indicators",
    },
    "financial_report": {
        "amounts", "dates", "clauses", "risk_indicators", "obligations",
    },
    "compliance_policy": {
        "clauses", "obligations", "risk_indicators",
        "consent_clauses", "data_protection_clauses",
    },
    "invoice": {
        "names", "amounts", "dates", "counterparties",
    },
    "unknown": {
        "names", "amounts", "dates", "interest_rates",
    },
}


def _prompt_map(agent_prompts: List[Dict[str, Any]]) -> Dict[str, str]:
    prompts = dict(DEFAULT_AGENT_PROMPTS)
    for item in agent_prompts or []:
        name = item.get("agent_name")
        if name:
            prompts[name] = item.get("system_prompt") or prompts.get(name, "")
    return prompts


def _scope_rules_for_doc_type(rules: List[Dict[str, Any]], document_type: str) -> List[Dict[str, Any]]:
    allowed_fields = DOC_TYPE_RULE_FIELDS.get(document_type, DOC_TYPE_RULE_FIELDS["unknown"])
    scoped = [r for r in rules if r.get("field") in allowed_fields]
    if scoped:
        return scoped
    return rules


def _build_alerts(compliance: Dict[str, Any], decision: Dict[str, Any], extracted: Dict[str, Any]) -> List[Dict[str, str]]:
    alerts: List[Dict[str, str]] = []

    for violation in compliance["violations"]:
        alerts.append({
            "severity": violation.get("severity", "MEDIUM"),
            "message": f"Compliance violation: {violation.get('rule_id', 'UNKNOWN')}",
            "source": "ComplianceAgent",
        })

    if decision["risk_category"] in {"MEDIUM", "HIGH"}:
        alerts.append({
            "severity": decision["risk_category"],
            "message": f"Decision model returned {decision['risk_category']} risk",
            "source": "DecisionAgent",
        })

    for key in ["names", "amounts", "interest_rates", "dates"]:
        if not extracted.get(key):
            alerts.append({
                "severity": "MEDIUM",
                "message": f"Missing extracted field: {key}",
                "source": "MonitoringAgent",
            })

    return alerts


def _compliance_explanation(compliance: Dict[str, Any], knowledge_base: List[Dict[str, Any]] | None) -> str:
    cited = ", ".join([k.get("source_id", "") for k in (knowledge_base or [])[:4]])
    if compliance["summary"]["status"] == "PASS":
        return f"Compliance checks passed against configured rules. Reference frameworks considered: {cited}."
    return f"Compliance check failed with {compliance['summary']['violations_count']} violation(s). Reference frameworks considered: {cited}."


def _decision_explanation(decision: Dict[str, Any]) -> str:
    f = decision.get("features", {})
    d = decision.get("drivers", {})
    v = decision.get("verification", {})
    no_rule_breach = int(d.get("rule_violations", 0)) == 0
    reason = (
        "No direct rule breaches were detected; score is influenced by model-derived behavioral indicators."
        if no_rule_breach
        else "Rule breaches materially increased risk score."
    )
    return (
        f"Risk category {decision['risk_category']} with score {decision['score']} and confidence {decision['confidence']}. "
        f"Two-layer verification: ai={v.get('ai_risk_score')}, source={v.get('source_risk_score')}, combined={v.get('combined_risk_score')} ({v.get('combined_color')}). "
        f"Document intelligence confidence={decision.get('document_intelligence_confidence')}, compliance alignment={decision.get('compliance_alignment_score')}. "
        f"Fraud probability is {decision.get('fraud_score')} ({decision.get('fraud_label')}). "
        f"Drivers: amount={f.get('loan_amount', 0)}, interest_rate={f.get('interest_rate', 0)}, "
        f"risk_indicators={f.get('risk_indicator_count', 0)}, compliance_violations={f.get('compliance_violations', 0)}. "
        f"{reason}"
    )


def _monitoring_summary(alerts: List[Dict[str, str]]) -> str:
    if not alerts:
        return "No operational anomalies detected."
    high = len([a for a in alerts if a["severity"] == "HIGH"])
    med = len([a for a in alerts if a["severity"] == "MEDIUM"])
    low = len([a for a in alerts if a["severity"] == "LOW"])
    return f"Monitoring generated {len(alerts)} alerts (HIGH={high}, MEDIUM={med}, LOW={low})."


def _reporting_summary(file_name: str, compliance: Dict[str, Any], decision: Dict[str, Any], alerts: List[Dict[str, str]]) -> str:
    return (
        f"Document {file_name} processed successfully. Compliance status is {compliance['summary']['status']} "
        f"with {compliance['summary']['violations_count']} violation(s). Decision risk category is {decision['risk_category']} "
        f"(score={decision['score']}). Total alerts generated: {len(alerts)}."
    )


def _risk_bucket(score: float) -> str:
    if score >= 0.75:
        return "HIGH"
    if score >= 0.40:
        return "MEDIUM"
    return "LOW"


def _risk_color(score: float) -> str:
    if score < 0.15:
        return "GREEN"
    if score < 0.60:
        return "ORANGE"
    return "RED"


def _two_layer_verification(decision: Dict[str, Any], compliance: Dict[str, Any], knowledge_base: List[Dict[str, Any]] | None) -> Dict[str, Any]:
    violations = int(compliance["summary"].get("violations_count", 0))
    status = compliance["summary"].get("status", "FAIL")
    ai_risk_score = float(decision.get("score", 0.0))
    references = len(knowledge_base or [])

    # Source layer risk score: grounded in rule-engine outcomes and regulatory coverage.
    source_risk_score = min(1.0, violations * 0.25 + (0.15 if status == "FAIL" else 0.0) + (0.08 if references == 0 else 0.0))
    combined_score = max(0.01, min(0.99, 0.70 * ai_risk_score + 0.30 * source_risk_score))
    combined_category = _risk_bucket(combined_score)
    combined_color = _risk_color(combined_score)

    return {
        "ai_risk_score": round(ai_risk_score, 4),
        "source_risk_score": round(source_risk_score, 4),
        "combined_risk_score": round(combined_score, 4),
        "combined_risk_category": combined_category,
        "combined_color": combined_color,
        "violations": violations,
        "source_references_count": references,
        "method": "Two-layer verification (AI model + source rule validation)",
    }


def _suggestions(
    compliance: Dict[str, Any], decision: Dict[str, Any], extracted: Dict[str, Any], knowledge_base: List[Dict[str, Any]] | None
) -> List[Dict[str, Any]]:
    suggestions: List[Dict[str, Any]] = []
    kb = knowledge_base or []
    cited = [
        {"source_id": item.get("source_id"), "title": item.get("title"), "source_url": item.get("source_url")}
        for item in kb[:5]
    ]

    if compliance["summary"]["status"] == "FAIL":
        suggestions.append(
            {
                "priority": "HIGH",
                "type": "compliance-remediation",
                "message": "Resolve compliance violations before final approval.",
                "actions": [
                    "Review all failed rule checks and update missing disclosures.",
                    "Attach supporting clauses for all mandatory regulatory fields.",
                ],
                "references": cited,
            }
        )

    if decision["risk_category"] in {"MEDIUM", "HIGH"}:
        suggestions.append(
            {
                "priority": "HIGH" if decision["risk_category"] == "HIGH" else "MEDIUM",
                "type": "risk-mitigation",
                "message": f"Risk category is {decision['risk_category']}; apply enhanced due diligence.",
                "actions": [
                    "Run enhanced borrower verification.",
                    "Review repayment capacity and stress assumptions.",
                    "Escalate to risk committee if thresholds require approval.",
                ],
                "references": cited,
            }
        )

    if decision.get("fraud_label") in {"MEDIUM", "HIGH"}:
        suggestions.append(
            {
                "priority": "HIGH" if decision["fraud_label"] == "HIGH" else "MEDIUM",
                "type": "fraud-control",
                "message": f"Fraud model flagged {decision['fraud_label']} probability ({decision.get('fraud_score')}).",
                "actions": [
                    "Trigger transaction pattern review and adverse-media checks.",
                    "Require secondary reviewer approval before disbursal.",
                    "Capture enhanced audit evidence for this case.",
                ],
                "references": cited,
            }
        )

    for key in ["names", "amounts", "interest_rates", "dates"]:
        if not extracted.get(key):
            suggestions.append(
                {
                    "priority": "MEDIUM",
                    "type": "data-quality",
                    "message": f"Missing critical extracted field: {key}",
                    "actions": [f"Re-upload clearer source document and verify {key} extraction."],
                    "references": cited,
                }
            )

    if not suggestions:
        suggestions.append(
            {
                "priority": "LOW",
                "type": "operational",
                "message": "No critical remediation required. Proceed with routine control checks.",
                "actions": ["Archive report and continue periodic monitoring."],
                "references": cited,
            }
        )
    return suggestions


def orchestrate_agents(
    file_path: str,
    file_name: str,
    rules: List[Dict[str, Any]] | None,
    knowledge_base: List[Dict[str, Any]] | None,
    agent_prompts: List[Dict[str, Any]] | None,
):
    prompts = _prompt_map(agent_prompts)

    text = extract_document_text(file_path)
    doc_profile = detect_document_profile(file_path, text)
    doc_type, raw_classify = classify_document_type(text)
    doc_profile["document_type"] = doc_type.get("document_type", "unknown")
    doc_profile["document_type_confidence"] = round(float(doc_type.get("confidence", 0.5)), 4)
    doc_profile["document_type_reason"] = doc_type.get("reason", "")

    # Document Agent (single real-time DeepSeek call)
    structured, raw_doc_output = extract_structured_data(text=text, system_prompt=prompts["DocumentAgent"])
    normalized = normalize_output(structured)

    raw_rules = rules if rules else load_rules()
    active_rules = _scope_rules_for_doc_type(raw_rules, doc_profile["document_type"])

    # Compliance Agent (deterministic local evaluation)
    compliance = validate_rules(normalized, active_rules)
    compliance_explanation = _compliance_explanation(compliance, knowledge_base)
    compliance["explanation"] = compliance_explanation

    # Decision Agent (local ML model)
    decision = score_decision(normalized, compliance["summary"])
    verification = _two_layer_verification(decision, compliance, knowledge_base)
    decision["ai_score"] = verification["ai_risk_score"]
    decision["source_score"] = verification["source_risk_score"]
    decision["score"] = verification["combined_risk_score"]
    decision["risk_category"] = verification["combined_risk_category"]
    decision["color"] = verification["combined_color"]
    decision["verification"] = verification
    entity_keys = ["names", "amounts", "interest_rates", "dates", "clauses", "risk_indicators"]
    coverage = sum(1 for k in entity_keys if normalized.get(k)) / len(entity_keys)
    extraction_confidence = min(0.99, max(0.35, 0.45 * coverage + 0.55 * doc_profile["document_type_confidence"]))
    compliance_alignment = min(
        0.99,
        max(
            0.1,
            1.0
            - (compliance["summary"]["violations_count"] * 0.08)
            + (0.03 if compliance["summary"]["status"] == "PASS" else -0.03),
        ),
    )
    decision["document_intelligence_confidence"] = round(extraction_confidence, 4)
    decision["compliance_alignment_score"] = round(compliance_alignment, 4)
    decision_explanation = _decision_explanation(decision)
    decision["explanation"] = decision_explanation

    # Monitoring Agent (local alert synthesis)
    alerts = _build_alerts(compliance, decision, normalized)
    monitoring_summary = _monitoring_summary(alerts)

    # Reporting Agent (local executive summary)
    reporting_summary = _reporting_summary(file_name, compliance, decision, alerts)
    suggestions = _suggestions(compliance, decision, normalized, knowledge_base)

    timestamp = datetime.utcnow().isoformat()
    agent_trace = [
        {
            "agent": "DocumentAgent",
            "identity": AGENT_IDENTITIES["DocumentAgent"],
            "status": "completed",
            "output": {"structured_data": normalized},
            "timestamp": timestamp,
        },
        {
            "agent": "ComplianceAgent",
            "identity": AGENT_IDENTITIES["ComplianceAgent"],
            "status": "completed",
            "output": {
                "summary": compliance["summary"],
                "violations": compliance["violations"],
                "explanation": compliance_explanation,
            },
            "timestamp": timestamp,
        },
        {
            "agent": "DecisionAgent",
            "identity": AGENT_IDENTITIES["DecisionAgent"],
            "status": "completed",
            "output": {
                "score": decision["score"],
                "fraud_score": decision.get("fraud_score"),
                "fraud_label": decision.get("fraud_label"),
                "risk_category": decision["risk_category"],
                "confidence": decision["confidence"],
                "drivers": decision.get("drivers", {}),
                "explanation": decision_explanation,
            },
            "timestamp": timestamp,
        },
        {
            "agent": "MonitoringAgent",
            "identity": AGENT_IDENTITIES["MonitoringAgent"],
            "status": "completed",
            "output": {"alerts": alerts, "monitoring_summary": monitoring_summary},
            "timestamp": timestamp,
        },
        {
            "agent": "ReportingAgent",
            "identity": AGENT_IDENTITIES["ReportingAgent"],
            "status": "completed",
            "output": {"reporting_summary": reporting_summary},
            "timestamp": timestamp,
        },
    ]

    return {
        "structured_data": normalized,
        "document_profile": doc_profile,
        "document_type_raw": raw_classify,
        "deepseek_output": raw_doc_output,
        "rules": active_rules,
        "compliance": compliance,
        "decision": decision,
        "alerts": alerts,
        "monitoring_summary": monitoring_summary,
        "reporting_summary": reporting_summary,
        "suggestions": suggestions,
        "models_used": [
            {"component": "Document Intelligence", "model": "deepseek-reasoner", "provider": "DeepSeek"},
            {"component": "Document Type Detection", "model": "deepseek-reasoner", "provider": "DeepSeek"},
            {"component": "Risk Scoring", "model": "LogReg (scaled)", "provider": "scikit-learn"},
            {"component": "Fraud Detection", "model": "RandomForestClassifier", "provider": "scikit-learn"},
        ],
        "standard_references": [
            {
                "source_id": item.get("source_id"),
                "title": item.get("title"),
                "source_url": item.get("source_url"),
            }
            for item in (knowledge_base or [])[:8]
        ],
        "agent_trace": agent_trace,
    }
