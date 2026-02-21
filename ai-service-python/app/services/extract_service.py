from pathlib import Path
from typing import Dict, Any
import pdfplumber
import pytesseract
from PIL import Image
from pypdf import PdfReader
import csv
import zipfile
import xml.etree.ElementTree as ET


def extract_text_from_pdf(path: Path) -> str:
    text_parts = []
    with pdfplumber.open(str(path)) as pdf:
        for page in pdf.pages:
            content = page.extract_text() or ""
            if content.strip():
                text_parts.append(content)

    text = "\n".join(text_parts).strip()
    if text:
        return text

    # Try pypdf as second pass for edge PDFs
    reader = PdfReader(str(path))
    backup_parts = []
    for page in reader.pages:
        backup_parts.append(page.extract_text() or "")

    return "\n".join(backup_parts).strip()


def extract_text_from_image(path: Path) -> str:
    image = Image.open(path)
    return pytesseract.image_to_string(image)


def extract_text_from_docx(path: Path) -> str:
    ns = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
    lines = []
    with zipfile.ZipFile(str(path)) as zf:
        xml = zf.read("word/document.xml")
    root = ET.fromstring(xml)
    for p in root.findall(".//w:p", ns):
        texts = [t.text for t in p.findall(".//w:t", ns) if t.text]
        line = "".join(texts).strip()
        if line:
            lines.append(line)
    return "\n".join(lines).strip()


def extract_text_from_tabular(path: Path) -> str:
    suffix = path.suffix.lower()
    if suffix == ".csv":
        rows = []
        with path.open("r", encoding="utf-8", errors="ignore") as f:
            reader = csv.reader(f)
            for i, row in enumerate(reader):
                if i >= 500:
                    break
                row_text = " | ".join([c.strip() for c in row if c and c.strip()])
                if row_text:
                    rows.append(row_text)
        return "\n".join(rows)
    if suffix == ".xlsx":
        ns = {"s": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
        rows = []
        with zipfile.ZipFile(str(path)) as zf:
            shared = []
            if "xl/sharedStrings.xml" in zf.namelist():
                shared_root = ET.fromstring(zf.read("xl/sharedStrings.xml"))
                for si in shared_root.findall(".//s:si", ns):
                    parts = [t.text for t in si.findall(".//s:t", ns) if t.text]
                    shared.append("".join(parts))

            sheet_names = [n for n in zf.namelist() if n.startswith("xl/worksheets/sheet") and n.endswith(".xml")]
            for sheet_name in sheet_names:
                sheet_root = ET.fromstring(zf.read(sheet_name))
                for row in sheet_root.findall(".//s:row", ns):
                    values = []
                    for c in row.findall("s:c", ns):
                        t_attr = c.attrib.get("t")
                        v = c.find("s:v", ns)
                        if v is None or v.text is None:
                            continue
                        cell = v.text
                        if t_attr == "s":
                            try:
                                cell = shared[int(cell)]
                            except Exception:
                                pass
                        values.append(str(cell).strip())
                    row_text = " | ".join([v for v in values if v])
                    if row_text:
                        rows.append(row_text)
                        if len(rows) >= 500:
                            return "\n".join(rows)
        return "\n".join(rows)

    raise ValueError("Unsupported tabular format")


def detect_input_mode(path: Path) -> str:
    suffix = path.suffix.lower()
    if suffix in {".png", ".jpg", ".jpeg", ".tiff", ".bmp"}:
        return "image_ocr"
    if suffix == ".pdf":
        return "pdf_text_or_ocr"
    if suffix == ".docx":
        return "docx_parse"
    if suffix in {".csv", ".xlsx"}:
        return "tabular_parse"
    if suffix in {".txt", ".md"}:
        return "text_parse"
    return "unknown"


def detect_document_profile(file_path: str, text: str) -> Dict[str, Any]:
    path = Path(file_path)
    ext = path.suffix.lower().lstrip(".")
    token_count = len([t for t in text.split() if t.strip()])
    looks_scanned = ext in {"png", "jpg", "jpeg", "tiff", "bmp"}
    return {
        "file_extension": ext or "unknown",
        "input_mode": detect_input_mode(path),
        "file_size_bytes": path.stat().st_size,
        "text_length": len(text),
        "token_estimate": token_count,
        "ocr_used": looks_scanned,
    }


def extract_document_text(file_path: str) -> str:
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"File not found: {file_path}")

    suffix = path.suffix.lower()
    if suffix == ".pdf":
        text = extract_text_from_pdf(path)
    elif suffix in {".png", ".jpg", ".jpeg", ".tiff", ".bmp"}:
        text = extract_text_from_image(path)
    elif suffix == ".docx":
        text = extract_text_from_docx(path)
    elif suffix in {".csv", ".xlsx"}:
        text = extract_text_from_tabular(path)
    elif suffix in {".txt", ".md"}:
        text = path.read_text(encoding="utf-8", errors="ignore")
    else:
        raise ValueError("Unsupported document type")

    if not text or len(text.strip()) < 20:
        raise ValueError("Insufficient text extracted; OCR/source quality issue")

    return text


def normalize_output(raw: Dict[str, Any]) -> Dict[str, Any]:
    required_keys = ["names", "amounts", "interest_rates", "dates", "clauses", "risk_indicators"]
    for key in required_keys:
        raw.setdefault(key, [])
    return raw
