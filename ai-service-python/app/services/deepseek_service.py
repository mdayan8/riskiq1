import json
import requests
from app.core.config import DEEPSEEK_API_KEY, DEEPSEEK_BASE_URL, DEEPSEEK_MODEL

DOCUMENT_SYSTEM_PROMPT = """
You are DocumentAgent in RiskIQ.
Extract financial entities from document text.
Return strict JSON with keys:
names, amounts, interest_rates, dates, clauses, risk_indicators, obligations, counterparties, consent_clauses, data_protection_clauses.
Each key must map to an array.
No markdown.
""".strip()

DOCUMENT_CLASSIFIER_PROMPT = """
You are ClassificationAgent in RiskIQ.
Classify the input document text into one type:
loan_agreement, kyc_document, transaction_statement, financial_report, compliance_policy, invoice, unknown.
Return strict JSON only:
{
  "document_type": "<one_of_the_allowed_values>",
  "confidence": <float_0_to_1>,
  "reason": "<short_explanation>"
}
No markdown.
""".strip()

class DeepSeekError(RuntimeError):
    pass


def _strip_fenced_json(text: str) -> str:
    t = text.strip()
    if t.startswith("```"):
        t = t.strip("`")
        if t.startswith("json"):
            t = t[4:]
    return t.strip()


def chat_completion(system_prompt: str, user_prompt: str, expect_json: bool = False, temperature: float = 0):
    url = f"{DEEPSEEK_BASE_URL}/chat/completions"
    payload = {
        "model": DEEPSEEK_MODEL,
        "temperature": temperature,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
    }

    response = requests.post(
        url,
        headers={
            "Authorization": f"Bearer {DEEPSEEK_API_KEY}",
            "Content-Type": "application/json",
        },
        json=payload,
        timeout=120,
    )

    if response.status_code >= 400:
        raise DeepSeekError(f"DeepSeek API error {response.status_code}: {response.text}")

    data = response.json()
    content = data["choices"][0]["message"]["content"]

    if not expect_json:
        return content, data

    cleaned = _strip_fenced_json(content)
    try:
        parsed = json.loads(cleaned)
    except json.JSONDecodeError as exc:
        raise DeepSeekError("DeepSeek response was not valid JSON") from exc

    if not isinstance(parsed, dict):
        raise DeepSeekError("DeepSeek JSON payload must be an object")

    return parsed, data


def extract_structured_data(text: str, system_prompt: str = DOCUMENT_SYSTEM_PROMPT):
    return chat_completion(
        system_prompt=system_prompt,
        user_prompt=(
            "Extract financial entities and compliance-relevant information from the text and return strict JSON only.\n\n"
            + text[:15000]
        ),
        expect_json=True,
        temperature=0,
    )


def classify_document_type(text: str):
    return chat_completion(
        system_prompt=DOCUMENT_CLASSIFIER_PROMPT,
        user_prompt=("Classify this document:\n\n" + text[:8000]),
        expect_json=True,
        temperature=0,
    )
