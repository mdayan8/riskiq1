# 🛡️ RiskIQ — Autonomous AI Platform for Financial Compliance & Decision Intelligence

[![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=for-the-badge&logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Axios](https://img.shields.io/badge/Axios-5A29E4?style=for-the-badge&logo=axios&logoColor=white)](https://axios-http.com/)

---

## 🚀 Overview

**RiskIQ** is an enterprise-grade, multi-agent AI platform designed to automate financial compliance analysis, document intelligence, and decision support workflows.  

The system transforms complex agreements and structured datasets into actionable insights through autonomous agents, regulatory knowledge integration, and real-time analytics.

RiskIQ demonstrates how modern AI architectures can enhance operational efficiency, improve decision accuracy, and support regulatory readiness for financial institutions such as NBFCs, fintech platforms, and banking organizations.

---

## 🎯 Problem Statement

Financial institutions face increasing regulatory complexity, manual document processing challenges, and fragmented decision workflows, leading to inefficiencies, operational risks, and delayed insights.

RiskIQ addresses this by providing an autonomous AI system capable of analyzing documents, evaluating data, monitoring conditions, and generating intelligent reports within a unified platform.

---

## 🏗️ System Architecture

RiskIQ is built on a modular **multi-agent orchestration architecture**, where specialized AI components collaborate to execute complex workflows.

```mermaid
graph TD
    User([User / External Systems]) -->|Upload Docs/API| Ingestion[Data Ingestion Layer]
    
    subgraph "AI Intelligence Layer (Astra Swarm)"
        Ingestion --> Nexus{Nexus Core<br/>Orchestrator}
        Nexus --> Omni[OmniExtract<br/>Neural Parser]
        Nexus --> Astra[Astra Compliance<br/>Regulatory Agent]
        Nexus --> Sentinel[Sentinel Risk<br/>Inference Agent]
        Nexus --> Lexis[Lexis Report<br/>Serialization Agent]
    end
    
    subgraph "Decision & Monitoring"
        Omni --> Analysis[Analysis Results]
        Astra --> Analysis
        Sentinel --> Analysis
        Analysis --> Decision[Decision Scoring]
        Decision --> Alerts[Anomalies & Alerts]
    end
    
    subgraph "Data Persistence (Atlas Vault)"
        Analysis --> Pg[(PostgreSQL<br/>Telemetry & Metadata)]
        Omni --> Mongo[(MongoDB<br/>Unstructured Data)]
    end
    
    Nexus -->|Final Report| Lexis
    Lexis -->|Export PDF| Download[/Executive Report/]
```

---

## � Core Intelligence: The Astra Swarm

- **Nexus Core (Orchestrator)**  
  Central coordination engine responsible for workflow routing, agent communication, and execution sequencing.

- **OmniExtract (Document Intelligence Agent)**  
  AI-powered parsing and semantic extraction engine that converts unstructured documents into structured insights.

- **Astra Compliance (Regulatory Agent)**  
  Evaluates extracted data against regulatory and governance rules to compute compliance indicators.

- **Sentinel Risk (Inference Agent)**  
  Performs anomaly detection, threshold monitoring, and machine-learning-based fraud probability scoring.

- **Lexis Report (Reporting Agent)**  
  Generates high-fidelity summaries and downloadable executive PDF reports with deterministic fallbacks.

- **Atlas Vault (Data Layer)**  
  Hybrid storage architecture supporting structured telemetry (Postgres) and deep-extraction storage (MongoDB).

---

## 💎 Platform Capabilities

### 📄 Document Intelligence
- Semantic clause extraction and context understanding.
- Grounded evidence mapping with full citation support.

### 📊 Decision Analytics
- Predictive scoring models (Decision-Level Random Forest).
- Confidence indicators and real-time risk intensity gauging.

### 🔁 Continuous Monitoring
- Autonomous re-evaluation loops and real-time alert streams.
- Adaptive monitoring capability across global session data.

---

## 🛠️ Technology Stack

### **Frontend Resilience**
- **React.js + Vite** for low-latency state management.
- **Tailwind CSS** for a premium "Authoritative UI" aesthetic.
- **Recharts** for wide-aspect temporal analytics.

### **Backend Orchestration**
- **Node.js + Express** for high-concurrency agent routing.
- **Zod** schema validation for cross-agent state integrity.

### **Data Persistence**
- **PostgreSQL** (Grounded telemetry & session metadata).
- **MongoDB** (High-depth document extraction storage).

---

## 🏁 Getting Started

### 1️⃣ Clone & Install
```bash
git clone <repository-url>
cd riskiq/frontend && npm install
cd ../backend-node && npm install
```

### 2️⃣ Configure Environment
Create `.env` files in both directories with your DB credentials and AI API keys.

### 3️⃣ Execute Swarm
```bash
# Start Backend
cd backend-node && npm run dev
# Start Frontend
cd frontend && npm run dev
```

---

## 🏆 Vision
RiskIQ represents a step toward the future of intelligent financial systems — where AI agents collaborate to transform fragmented data into trustworthy, executive-ready decisions.

**RiskIQ — Autonomous Intelligence for Financial Systems** 🛡️🚀
