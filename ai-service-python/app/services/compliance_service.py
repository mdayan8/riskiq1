from typing import Dict, Any, List


def validate_rules(extracted_data: Dict[str, Any], rules: List[Dict[str, Any]]):
    violations = []

    for rule in rules:
        rule_id = rule.get("id")
        field = rule.get("field")
        requirement = rule.get("requirement")
        severity = rule.get("severity", "MEDIUM")

        values = extracted_data.get(field, [])
        if requirement == "must_exist":
            if not isinstance(values, list) or len(values) == 0:
                violations.append({"rule_id": rule_id, "severity": severity, "message": rule.get("description")})

        if requirement == "min_count_1" and len(values) < 1:
            violations.append({"rule_id": rule_id, "severity": severity, "message": rule.get("description")})

    status = "PASS" if len(violations) == 0 else "FAIL"
    return {
        "summary": {
            "status": status,
            "violations_count": len(violations),
        },
        "violations": violations,
    }
