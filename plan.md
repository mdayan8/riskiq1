# Project Plan: RiskIQ MVP

## 1) Product Goal
Build a production-style MVP called **RiskIQ**: an autonomous multi-agent financial compliance and decision intelligence platform with OCR, regulatory validation (GVR), AI reasoning, alerts, dashboard analytics, and PDF reporting.

---

## 2) Final Outcome (What Will Be Delivered)
- Working end-to-end pipeline:
  - Upload -> OCR/Text Extraction -> DeepSeek Structuring -> GVR Compliance -> Decision Scoring -> Monitoring/Alerts -> PDF Report -> Dashboard Views
- Modular codebase with this structure:
  - `/frontend` (React + Vite + Tailwind + UI components + charts)
  - `/backend-node` (Node API gateway + auth + orchestration + DB coordination)
  - `/ai-service-python` (FastAPI AI microservice: OCR, extraction, validation, scoring, reporting helpers)
  - `/database` (schema, migrations, seeds)
  - `/rules` (GVR rules and examples)
  - `/reports` (generated report outputs/metadata)
- Seed/demo data:
  - sample loan agreements
  - sample KYC documents
  - financial dataset samples
  - RBI-style rule examples
- Local run instructions for all services.

---

## 3) Architecture (Target)
Frontend (React) -> Node API Gateway -> Python AI Service -> PostgreSQL + MongoDB

### Responsibilities
- **Frontend**
  - Dashboard, Upload & Analysis, Data Sources, Alerts, Reports
- **Node Backend**
  - Auth/JWT, routing, orchestration triggers, DB coordination, aggregation APIs
- **Python AI Service**
  - OCR, document parsing, DeepSeek reasoning, compliance validation support, scoring, insights
- **PostgreSQL**
  - transactional/relational entities
- **MongoDB**
  - document payloads, extracted fields, AI outputs, logs

---

## 4) Core Modules

### 4.1 Authentication
- Register/login
- JWT issuance and verification
- Roles: `Admin`, `Analyst`

### 4.2 Data Source Integration
- Connector configuration for:
  - PostgreSQL
  - MongoDB
  - CSV
  - Excel
  - API endpoint
  - Manual document upload (PDF/image)
- Store connector metadata securely.

### 4.3 Document Processing Pipeline
1. Upload file
2. Detect type (native PDF/image/scanned)
3. OCR for scanned content (Tesseract)
4. Extract text blocks
5. Send text to DeepSeek R1 for structured extraction
6. Store raw + structured results in MongoDB

Extracted targets:
- names
- amounts
- interest rates
- dates
- clauses
- risk indicators

### 4.4 GVR Rulebook Engine
- Rule repository (`/rules` + DB mirror)
- Rule fields:
  - regulator
  - rule description
  - validation logic
  - severity
- Compliance agent evaluates extracted entities against rules.

### 4.5 Decision Intelligence
- Baseline ML model: Logistic Regression or RandomForest
- Input: financial/compliance features
- Output:
  - decision score
  - confidence
  - risk category

### 4.6 Multi-Agent Orchestration
- `DocumentAgent`
- `ComplianceAgent`
- `DecisionAgent`
- `MonitoringAgent`
- `ReportingAgent`
- Orchestrator executes ordered workflow automatically with status tracking.

### 4.7 Alerts
- Trigger alerts for:
  - compliance violations
  - low decision score
  - missing critical data
  - anomaly flags
- Persist in PostgreSQL and expose via API + UI.

### 4.8 Dashboard & UI
- Dashboard:
  - total analyzed docs
  - compliance distribution
  - alert counts
  - score trend chart
- Upload & Analysis:
  - upload + extraction + compliance + score + alerts
- Data Sources:
  - manage connectors
- Reports:
  - generate and download PDF
- Alerts:
  - severity-coded list (red/yellow/normal)

### 4.9 PDF Report Generator
Institutional report sections:
- document summary
- compliance status
- decision score/confidence
- risk explanation
- active alerts

### 4.10 Autonomous Workflow
On upload:
`DocumentAgent -> ComplianceAgent -> DecisionAgent -> MonitoringAgent -> ReportingAgent`

---

## 5) Data Model Plan

### PostgreSQL tables
- `users`
- `alerts`
- `decision_scores`
- `compliance_results`
- `rules`
- `reports_metadata`
- optional: `data_source_connections`, `orchestration_runs`

### MongoDB collections
- `documents`
- `extracted_data`
- `ai_outputs`
- `logs`

---

## 6) API Contract (MVP)

### Node API
- `POST /upload`
- `GET /dashboard`
- `GET /alerts`
- `POST /report`
- `POST /connect-database`
- auth:
  - `POST /auth/register`
  - `POST /auth/login`

### Python API
- `POST /analyze-document`
- `POST /decision-score`
- `POST /validate-compliance`

---

## 7) Tech Stack

### Frontend
- React (Vite)
- Tailwind CSS
- shadcn/ui (or equivalent modern component library)
- Recharts
- Axios

### Backend
- Node.js + Express (or Fastify)
- PostgreSQL client/ORM
- MongoDB client/ODM

### AI Service
- FastAPI
- DeepSeek R1 API integration
- pandas, numpy, scikit-learn
- pdfplumber / PyPDF
- pytesseract + Tesseract OCR
- ReportLab or WeasyPrint

---

## 8) Delivery Phases

### Phase 1: Foundation
- Repo scaffolding and folder structure
- Environment config
- DB bootstrapping
- Auth module + base UI shell

### Phase 2: Ingestion + AI Extraction
- Upload pipeline
- OCR + text extraction
- DeepSeek structured extraction
- Mongo persistence

### Phase 3: GVR + Decision
- Rule repository and validator
- Compliance output model
- ML score engine
- PostgreSQL score/compliance persistence

### Phase 4: Alerts + Dashboard + Reports
- Alert trigger logic
- Dashboard analytics APIs + UI charts
- PDF report generation and download

### Phase 5: Demo Readiness
- Seed scripts and sample docs
- End-to-end validation
- local run documentation

---

## 9) Quality Baseline (MVP)
- Clear module boundaries between frontend/node/python
- Typed/validated API payloads
- Basic error handling and status reporting
- Minimal tests for critical paths:
  - auth
  - upload->analysis pipeline
  - compliance decision generation
  - report generation

---

## 10) Runbook (to include in final docs)
- Prerequisites (Node, Python, PostgreSQL, MongoDB, Tesseract)
- Environment variable templates
- Start order:
  1. Databases
  2. Python AI service
  3. Node API
  4. Frontend
- Seed command
- Demo flow walkthrough

---

## 11) Priority Focus
1. Working autonomous pipeline
2. Clean and usable UI
3. Reliable AI reasoning + compliance explainability
4. Practical MVP completeness over perfection

