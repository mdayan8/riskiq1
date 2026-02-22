from fastapi import APIRouter
from app.models.schemas import AnalyzeRequest, ComplianceRequest, DecisionRequest, ReportRequest, OrchestrateRequest, CombinedReportRequest
from app.services.extract_service import extract_document_text, normalize_output
from app.services.deepseek_service import extract_structured_data
from app.services.rules_loader import load_rules
from app.services.compliance_service import validate_rules
from app.services.decision_service import score_decision
from app.services.report_service import generate_report, generate_combined_report
from app.services.agent_orchestrator import orchestrate_agents

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
    return orchestrate_agents(
        file_path=payload.file_path,
        file_name=payload.file_name,
        rules=payload.rules,
        knowledge_base=payload.knowledge_base,
        agent_prompts=payload.agent_prompts,
    )


@router.post("/generate-combined-report")
def combined_report(payload: CombinedReportRequest):
    return generate_combined_report(
        package_name=payload.package_name,
        regulator=payload.regulator,
        submissions=payload.submissions,
        analysis_summary=payload.analysis_summary,
    )
