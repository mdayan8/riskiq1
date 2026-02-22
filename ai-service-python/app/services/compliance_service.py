from typing import Dict, Any, List


def validate_rules(extracted_data: Dict[str, Any], rules: List[Dict[str, Any]]):
    violations = []

    for rule in rules:
        rule_id = rule.get("id")
        field = rule.get("field")
        requirement = rule.get("requirement")
        severity = rule.get("severity", "MEDIUM")

        values = extracted_data.get(field, [])
        found_count = len(values) if isinstance(values, list) else 0
        found_preview = values[:3] if isinstance(values, list) else []

        def _violation_payload():
            expected = "At least one value must exist" if requirement in {"must_exist", "min_count_1"} else "Rule condition not satisfied"
            why_flagged = f"Field '{field}' is missing or insufficient for requirement '{requirement}'."
            suggestion = f"Add or clarify '{field}' content in the document so this rule can be satisfied."
            return {
                "rule_id": rule_id,
                "severity": severity,
                "message": rule.get("description"),
                "field": field,
                "requirement": requirement,
                "expected": expected,
                "found_count": found_count,
                "found_preview": found_preview,
                "why_flagged": why_flagged,
                "suggestion": suggestion,
            }

        if requirement == "must_exist":
            if not isinstance(values, list) or len(values) == 0:
                violations.append(_violation_payload())

        if requirement == "min_count_1" and len(values) < 1:
            violations.append(_violation_payload())

    status = "PASS" if len(violations) == 0 else "FAIL"
    return {
        "summary": {
            "status": status,
            "violations_count": len(violations),
        },
        "violations": violations,
    }
