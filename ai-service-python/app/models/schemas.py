from pydantic import BaseModel, Field
from typing import Any, Dict, List


class AnalyzeRequest(BaseModel):
    file_path: str
    file_name: str


class AnalyzeResponse(BaseModel):
    structured_data: Dict[str, Any]
    deepseek_output: Dict[str, Any]
    rules: List[Dict[str, Any]]


class ComplianceRequest(BaseModel):
    extracted_data: Dict[str, Any]
    rules: List[Dict[str, Any]]


class DecisionRequest(BaseModel):
    extracted_data: Dict[str, Any]
    compliance_summary: Dict[str, Any]


class ReportRequest(BaseModel):
    document_ref: str
    document_name: str
    structured_data: Dict[str, Any]
    compliance: Dict[str, Any]
    decision: Dict[str, Any]
    alerts: List[Dict[str, Any]]
    suggestions: List[Dict[str, Any]] = Field(default_factory=list)
    standard_references: List[Dict[str, Any]] = Field(default_factory=list)
    models_used: List[Dict[str, Any]] = Field(default_factory=list)


class OrchestrateRequest(BaseModel):
    file_path: str
    file_name: str
    rules: List[Dict[str, Any]] = Field(default_factory=list)
    knowledge_base: List[Dict[str, Any]] = Field(default_factory=list)
    agent_prompts: List[Dict[str, Any]] = Field(default_factory=list)


class CombinedReportRequest(BaseModel):
    package_name: str
    regulator: str = "RBI"
    submissions: List[Dict[str, Any]] = Field(default_factory=list)
    analysis_summary: Dict[str, Any] = Field(default_factory=dict)


class CopilotMessage(BaseModel):
    role: str
    content: str


class SessionCopilotRequest(BaseModel):
    question: str
    session_context: Dict[str, Any]
    history: List[CopilotMessage] = Field(default_factory=list)
