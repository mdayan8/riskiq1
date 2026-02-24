import base64
import os
import tempfile
import json
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from app.models.schemas import AnalyzeRequest, ComplianceRequest, DecisionRequest, ReportRequest, OrchestrateRequest, CombinedReportRequest, SessionCopilotRequest, ClauseRewriteRequest
from app.services.extract_service import extract_document_text, normalize_output
from app.services.deepseek_service import extract_structured_data, session_copilot, rewrite_clause
from app.services.rules_loader import load_rules
from app.services.compliance_service import validate_rules
from app.services.decision_service import score_decision
from app.services.report_service import generate_report, generate_combined_report
from app.services.agent_orchestrator import orchestrate_agents
from app.services.web_scrape_service import scrape_reference_url

router = APIRouter()


@router.get("/health")
def health():
    return {"status": "ok"}


@router.post("/analyze-document")
def analyze_document(payload: AnalyzeRequest):
    text = extract_document_text(payload.file_path)
    structured, deepseek_raw = extract_structured_data(text)
    normalized = normalize_output(structured)
    rules = load_rules()

    return {
        "structured_data": normalized,
        "deepseek_output": deepseek_raw,
        "rules": rules,
    }


@router.post("/validate-compliance")
def validate_compliance(payload: ComplianceRequest):
    return validate_rules(payload.extracted_data, payload.rules)


@router.post("/decision-score")
def decision_score(payload: DecisionRequest):
    return score_decision(payload.extracted_data, payload.compliance_summary)


@router.post("/generate-report")
def report(payload: ReportRequest):
    return generate_report(
        payload.document_ref,
        payload.document_name,
        payload.structured_data,
        payload.compliance,
        payload.decision,
        payload.alerts,
        payload.suggestions,
        payload.standard_references,
        payload.models_used,
    )


@router.post("/orchestrate-agents")
def orchestrate(payload: OrchestrateRequest):
    temp_path = None
    try:
        file_path = payload.file_path
        if payload.file_b64:
            suffix = os.path.splitext(payload.file_name or "document.pdf")[1] or ".pdf"
            fd, temp_path = tempfile.mkstemp(prefix="riskiq-", suffix=suffix)
            os.close(fd)
            with open(temp_path, "wb") as f:
                f.write(base64.b64decode(payload.file_b64))
            file_path = temp_path

        return orchestrate_agents(
            file_path=file_path,
            file_name=payload.file_name,
            rules=payload.rules,
            knowledge_base=payload.knowledge_base,
            agent_prompts=payload.agent_prompts,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"orchestrate_failed: {str(exc)}")
    finally:
        if temp_path and os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except Exception:
                pass


@router.post("/orchestrate-agents-upload")
async def orchestrate_upload(
    file: UploadFile = File(...),
    file_name: str = Form(""),
    file_path: str = Form(""),
    rules: str = Form("[]"),
    knowledge_base: str = Form("[]"),
    agent_prompts: str = Form("[]"),
):
    temp_path = None
    try:
        parsed_rules = json.loads(rules or "[]")
        parsed_kb = json.loads(knowledge_base or "[]")
        parsed_prompts = json.loads(agent_prompts or "[]")

        suffix = os.path.splitext(file.filename or file_name or "document.pdf")[1] or ".pdf"
        fd, temp_path = tempfile.mkstemp(prefix="riskiq-upload-", suffix=suffix)
        os.close(fd)

        content = await file.read()
        with open(temp_path, "wb") as f:
            f.write(content)

        return orchestrate_agents(
            file_path=temp_path,
            file_name=file_name or file.filename or os.path.basename(file_path or temp_path),
            rules=parsed_rules,
            knowledge_base=parsed_kb,
            agent_prompts=parsed_prompts,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"orchestrate_upload_failed: {str(exc)}")
    finally:
        if temp_path and os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except Exception:
                pass


@router.post("/generate-combined-report")
def combined_report(payload: CombinedReportRequest):
    return generate_combined_report(
        package_name=payload.package_name,
        regulator=payload.regulator,
        submissions=payload.submissions,
        analysis_summary=payload.analysis_summary,
    )


@router.post("/session-copilot")
def session_copilot_answer(payload: SessionCopilotRequest):
    parsed, raw = session_copilot(
        question=payload.question,
        session_context=payload.session_context,
        history=[m.model_dump() for m in payload.history],
    )
    return {
        "answer": parsed.get("answer", ""),
        "citations": parsed.get("citations", []),
        "follow_up": parsed.get("follow_up", ""),
        "raw": raw,
    }


@router.post("/scrape-reference")
def scrape_reference(payload: dict):
    url = str(payload.get("url", "")).strip()
    if not url:
        return {"error": "Missing url"}
    return scrape_reference_url(url)


@router.post("/rewrite-clause")
def clause_rewrite(payload: ClauseRewriteRequest):
    parsed, raw = rewrite_clause(
        violation=payload.violation,
        session_context=payload.session_context,
        current_clause=payload.current_clause,
    )
    return {
        "replacement_clause": parsed.get("replacement_clause", ""),
        "plain_language_explanation": parsed.get("plain_language_explanation", ""),
        "risk_reduction_summary": parsed.get("risk_reduction_summary", ""),
        "checklist": parsed.get("checklist", []),
        "raw": raw,
    }
