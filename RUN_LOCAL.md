# Run RiskIQ Locally

## 1. Prerequisites
- Node.js 20+
- Python 3.11+
- PostgreSQL 14+
- MongoDB 6+
- Tesseract installed and available in PATH
- DeepSeek API key

## 2. Configure Environment Files

### Node API
```bash
cd backend-node
cp .env.example .env
```
Update `.env` values as needed.

### AI Service
```bash
cd ../ai-service-python
cp .env.example .env
```
Set real values for:
- `DEEPSEEK_API_KEY`
- `DEEPSEEK_BASE_URL`
- `DEEPSEEK_MODEL`

### Frontend
```bash
cd ../frontend
cp .env.example .env
```

## 3. Create Database + Schema + Seed

### PostgreSQL
```bash
createdb riskiq
psql -d riskiq -f database/postgres/schema.sql
psql -d riskiq -f database/postgres/seed.sql
```

### MongoDB
MongoDB collections are auto-created on first write.

## 4. Install Dependencies

### Node API
```bash
cd backend-node
npm install
```

### AI Service
```bash
cd ../ai-service-python
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### Frontend
```bash
cd ../frontend
npm install
```

## 5. Start Services

### Terminal 1: AI Service
```bash
cd ai-service-python
source .venv/bin/activate
./run.sh
```

### Terminal 2: Node API
```bash
cd backend-node
npm run dev
```

### Terminal 3: Frontend
```bash
cd frontend
npm run dev
```

## 6. Login and Test Flow
- Open frontend URL (usually `http://localhost:5173`)
- Login with seeded user:
  - email: `admin@riskiq.local`
  - password: `password`
- Upload supported file (`pdf`, `png`, `jpg`, `jpeg`, `tiff`, `bmp`)
- Verify:
  - extraction output
  - compliance result
  - decision score
  - alerts
  - generated report

## 7. Key APIs
- Node:
  - `POST /auth/register`
  - `POST /auth/login`
  - `POST /upload`
  - `POST /upload-async`
  - `GET /workflow-status/:jobId`
  - `GET /sessions`
  - `GET /sessions/:id`
  - `GET /dashboard`
  - `GET /alerts`
  - `GET /reports`
  - `POST /report`
  - `POST /connect-database`
  - `POST /knowledge-base/refresh`
- Python:
  - `POST /analyze-document`
  - `POST /validate-compliance`
  - `POST /decision-score`
  - `POST /generate-report`

## 8. Docker (Optional, Recommended)
If Docker Desktop is installed, you can run the full stack with one command.

1. Create docker env file:
```bash
cp .env.docker.example .env.docker
```
Set `DEEPSEEK_API_KEY` in `.env.docker`.

2. Start all services:
```bash
docker compose --env-file .env.docker up --build
```

3. Access:
- Frontend: `http://localhost:5173`
- Node API: `http://localhost:4000`
- AI service: `http://localhost:8000`
