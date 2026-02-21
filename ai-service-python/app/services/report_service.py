import os
from datetime import datetime
from reportlab.lib.pagesizes import A4
from reportlab.lib.utils import simpleSplit
from reportlab.pdfgen import canvas
from app.core.config import REPORTS_DIR

PAGE_WIDTH, PAGE_HEIGHT = A4
MARGIN_X = 40
TOP_Y = PAGE_HEIGHT - 36
BOTTOM_Y = 56
CONTENT_W = PAGE_WIDTH - (MARGIN_X * 2)


def _risk_color(category: str):
    if category == "HIGH":
        return (0.87, 0.16, 0.20)
    if category == "MEDIUM":
        return (0.98, 0.63, 0.05)
    return (0.09, 0.78, 0.52)


def _draw_header(c, document_name: str):
    c.setFillColorRGB(0.04, 0.12, 0.23)
    c.rect(0, PAGE_HEIGHT - 82, PAGE_WIDTH, 82, fill=1, stroke=0)

    c.setFillColorRGB(1, 1, 1)
    c.setFont("Helvetica-Bold", 15)
    c.drawString(MARGIN_X, PAGE_HEIGHT - 30, "RiskIQ Regulatory Intelligence Report")

    c.setFont("Helvetica", 9)
    c.drawString(MARGIN_X, PAGE_HEIGHT - 46, f"Document: {document_name}")
    c.drawString(MARGIN_X, PAGE_HEIGHT - 60, f"Generated At (UTC): {datetime.utcnow().isoformat()}")


def _ensure_space(c, y, required_height, document_name):
    if y - required_height < BOTTOM_Y:
        c.showPage()
        _draw_header(c, document_name)
        return PAGE_HEIGHT - 100
    return y


def _section_title(c, y, title):
    c.setFont("Helvetica-Bold", 11)
    c.setFillColorRGB(0.05, 0.12, 0.22)
    c.drawString(MARGIN_X, y, title)
    c.setStrokeColorRGB(0.84, 0.88, 0.92)
    c.line(MARGIN_X, y - 5, PAGE_WIDTH - MARGIN_X, y - 5)
    return y - 16


def _paragraph(c, x, y, text, width, size=9, leading=13, color=(0.18, 0.22, 0.27)):
    c.setFont("Helvetica", size)
    c.setFillColorRGB(*color)
    lines = simpleSplit(str(text), "Helvetica", size, width)
    for ln in lines:
        c.drawString(x, y, ln)
        y -= leading
    return y


def _score_card(c, x, y, w, h, label, value, value_color=(0.06, 0.1, 0.18)):
    c.setFillColorRGB(0.97, 0.98, 0.99)
    c.setStrokeColorRGB(0.88, 0.91, 0.95)
    c.roundRect(x, y - h, w, h, 8, fill=1, stroke=1)

    c.setFont("Helvetica-Bold", 8)
    c.setFillColorRGB(0.44, 0.50, 0.58)
    c.drawString(x + 10, y - 16, label.upper())

    c.setFont("Helvetica-Bold", 14)
    c.setFillColorRGB(*value_color)
    c.drawString(x + 10, y - 36, value)


def _severity_badge(c, x, y, severity):
    if severity == "HIGH":
        bg = (0.99, 0.90, 0.91)
        fg = (0.75, 0.10, 0.13)
    elif severity == "MEDIUM":
        bg = (1.0, 0.95, 0.88)
        fg = (0.73, 0.43, 0.03)
    else:
        bg = (0.90, 0.95, 1.0)
        fg = (0.10, 0.35, 0.70)

    c.setFillColorRGB(*bg)
    c.setStrokeColorRGB(*bg)
    c.roundRect(x, y - 9, 45, 12, 6, fill=1, stroke=1)
    c.setFont("Helvetica-Bold", 7)
    c.setFillColorRGB(*fg)
    c.drawCentredString(x + 22.5, y - 5, severity)


def _highlights(compliance, decision, alerts):
    high_alerts = len([a for a in alerts if a.get("severity") == "HIGH"])
    return [
        f"Composite risk is {decision.get('risk_category', 'NA')} ({decision.get('score', 'NA')}) with confidence {decision.get('confidence', 'NA')}.",
        f"Compliance status is {compliance['summary'].get('status', 'NA')} with {compliance['summary'].get('violations_count', 0)} violation(s).",
        f"Fraud probability is {decision.get('fraud_score', 'NA')} categorized as {decision.get('fraud_label', 'NA')}.",
        f"High-severity alerts detected: {high_alerts}.",
    ]


def generate_report(
    document_ref,
    document_name,
    structured_data,
    compliance,
    decision,
    alerts,
    suggestions=None,
    standard_references=None,
    models_used=None,
):
    os.makedirs(REPORTS_DIR, exist_ok=True)
    file_name = f"report-{document_ref}.pdf"
    full_path = os.path.join(REPORTS_DIR, file_name)

    suggestions = suggestions or []
    standard_references = standard_references or []
    models_used = models_used or []

    c = canvas.Canvas(full_path, pagesize=A4)
    _draw_header(c, document_name)
    y = PAGE_HEIGHT - 104

    # Executive scorecards
    y = _ensure_space(c, y, 92, document_name)
    y = _section_title(c, y, "Executive Snapshot")

    card_gap = 10
    card_w = (CONTENT_W - (card_gap * 3)) / 4
    card_h = 46

    risk_color = _risk_color(decision.get("risk_category", "LOW"))

    _score_card(c, MARGIN_X, y, card_w, card_h, "Composite Risk", f"{round(float(decision.get('score', 0)) * 100, 1)}%", risk_color)
    _score_card(c, MARGIN_X + (card_w + card_gap), y, card_w, card_h, "AI Confidence", f"{round(float(decision.get('confidence', 0)) * 100)}%")
    _score_card(c, MARGIN_X + ((card_w + card_gap) * 2), y, card_w, card_h, "Violations", str(compliance["summary"].get("violations_count", 0)), (0.75, 0.10, 0.13))
    _score_card(c, MARGIN_X + ((card_w + card_gap) * 3), y, card_w, card_h, "Fraud Signal", f"{round(float(decision.get('fraud_score', 0)) * 100, 1)}%")
    y -= (card_h + 18)

    # Highlights
    y = _ensure_space(c, y, 90, document_name)
    y = _section_title(c, y, "Key Highlights")
    for item in _highlights(compliance, decision, alerts):
        y = _paragraph(c, MARGIN_X + 12, y, f"- {item}", CONTENT_W - 12)
    y -= 6

    # Verification panel
    y = _ensure_space(c, y, 82, document_name)
    y = _section_title(c, y, "Two-Layer Verification")
    verification = decision.get("verification", {})
    verify_text = (
        f"AI Score: {verification.get('ai_risk_score', 'NA')} | "
        f"Source Score: {verification.get('source_risk_score', 'NA')} | "
        f"Combined Score: {verification.get('combined_risk_score', 'NA')} | "
        f"Color: {verification.get('combined_color', 'NA')}"
    )
    y = _paragraph(c, MARGIN_X, y, verify_text, CONTENT_W)
    y = _paragraph(
        c,
        MARGIN_X,
        y,
        f"Document Intelligence Confidence: {decision.get('document_intelligence_confidence', 'NA')} | Compliance Alignment: {decision.get('compliance_alignment_score', 'NA')}",
        CONTENT_W,
    )
    y -= 6

    # Compliance violations summary
    y = _ensure_space(c, y, 200, document_name)
    y = _section_title(c, y, "Compliance Violations (Top Findings)")

    violations = compliance.get("violations", [])
    if not violations:
        y = _paragraph(c, MARGIN_X, y, "No violations detected for the scoped rule set.", CONTENT_W)
    else:
        for violation in violations[:12]:
            y = _ensure_space(c, y, 22, document_name)
            _severity_badge(c, MARGIN_X, y, violation.get("severity", "LOW"))
            c.setFont("Helvetica-Bold", 8)
            c.setFillColorRGB(0.08, 0.14, 0.23)
            c.drawString(MARGIN_X + 52, y - 2, violation.get("rule_id", "UNKNOWN"))
            y = _paragraph(c, MARGIN_X + 52, y - 12, violation.get("message", ""), CONTENT_W - 58, size=8, leading=11)
            y -= 2

    # Recommendations
    y = _ensure_space(c, y, 160, document_name)
    y = _section_title(c, y, "Strategic Recommendations")
    if not suggestions:
        y = _paragraph(c, MARGIN_X, y, "No recommendations available.", CONTENT_W)
    else:
        for s in suggestions[:8]:
            y = _ensure_space(c, y, 36, document_name)
            c.setFont("Helvetica-Bold", 8)
            c.setFillColorRGB(0.08, 0.14, 0.23)
            c.drawString(MARGIN_X, y, f"[{s.get('priority', 'LOW')}] {s.get('type', 'recommendation')}")
            y = _paragraph(c, MARGIN_X + 8, y - 12, s.get("message", ""), CONTENT_W - 8, size=8)
            for action in (s.get("actions") or [])[:2]:
                y = _paragraph(c, MARGIN_X + 14, y, f"- {action}", CONTENT_W - 14, size=8, leading=11)
            y -= 2

    # Model stack + references
    y = _ensure_space(c, y, 140, document_name)
    y = _section_title(c, y, "Model Stack")
    for model in models_used[:6]:
        y = _paragraph(c, MARGIN_X + 8, y, f"- {model.get('component')}: {model.get('model')} ({model.get('provider')})", CONTENT_W - 8, size=8, leading=11)

    y -= 4
    y = _ensure_space(c, y, 140, document_name)
    y = _section_title(c, y, "Referenced Standards")
    for ref in standard_references[:10]:
        y = _paragraph(c, MARGIN_X + 8, y, f"- {ref.get('source_id')}: {ref.get('title')}", CONTENT_W - 8, size=8, leading=11)

    # Footer
    c.setFont("Helvetica", 8)
    c.setFillColorRGB(0.45, 0.50, 0.56)
    c.drawRightString(PAGE_WIDTH - MARGIN_X, 28, f"Report ID: {document_ref}")
    c.drawString(MARGIN_X, 28, "RiskIQ Autonomous Regulatory Intelligence")

    c.save()
    return {"report_path": f"reports/generated/{file_name}"}


def generate_combined_report(package_name, regulator, submissions):
    os.makedirs(REPORTS_DIR, exist_ok=True)
    safe_name = "".join(ch if ch.isalnum() or ch in "-_" else "_" for ch in package_name.strip())[:64] or "submission"
    file_name = f"combined-{safe_name}-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}.pdf"
    full_path = os.path.join(REPORTS_DIR, file_name)

    c = canvas.Canvas(full_path, pagesize=A4)
    _draw_header(c, f"{regulator} Submission Package - {package_name}")
    y = PAGE_HEIGHT - 104

    y = _section_title(c, y, "Submission Overview")
    y = _paragraph(c, MARGIN_X, y, f"Regulator: {regulator}", CONTENT_W)
    y = _paragraph(c, MARGIN_X, y, f"Package Name: {package_name}", CONTENT_W)
    y = _paragraph(c, MARGIN_X, y, f"Included Sessions: {len(submissions)}", CONTENT_W)
    y -= 8

    y = _section_title(c, y, "Included Reports")
    for i, item in enumerate(submissions, start=1):
        y = _ensure_space(c, y, 72, f"{regulator} Submission Package - {package_name}")
        c.setFillColorRGB(0.97, 0.98, 0.99)
        c.setStrokeColorRGB(0.88, 0.91, 0.95)
        c.roundRect(MARGIN_X, y - 54, CONTENT_W, 50, 8, fill=1, stroke=1)
        c.setFont("Helvetica-Bold", 9)
        c.setFillColorRGB(0.06, 0.10, 0.18)
        c.drawString(MARGIN_X + 10, y - 18, f"{i}. {item.get('file_name', 'Session Document')}")
        c.setFont("Helvetica", 8)
        c.setFillColorRGB(0.30, 0.36, 0.44)
        c.drawString(MARGIN_X + 10, y - 31, f"Document Ref: {item.get('document_ref', 'NA')}")
        c.drawString(MARGIN_X + 10, y - 43, f"Risk: {item.get('risk_category', 'NA')} | Score: {item.get('score', 'NA')} | Violations: {item.get('violations', 'NA')}")
        y -= 62

    c.setFont("Helvetica", 8)
    c.setFillColorRGB(0.45, 0.50, 0.56)
    c.drawRightString(PAGE_WIDTH - MARGIN_X, 28, f"Package: {safe_name}")
    c.drawString(MARGIN_X, 28, "RiskIQ RBI Submission Simulation Package")
    c.save()

    return {"report_path": f"reports/generated/{file_name}"}
