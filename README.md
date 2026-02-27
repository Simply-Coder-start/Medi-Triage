# Medi-Triage
### Fast, structured triage notes — so you can focus on the patient, not the paperwork.

**Medi-Triage** is a lightweight triage workflow that helps you capture symptoms, severity, and next-step recommendations in a consistent format. Built for speed, clarity, and stress-proof decision support.

> **Goal:** reduce triage friction and improve handoff quality with clean, standardized outputs.

---

## Why Medi-Triage?
Triage is high-pressure. Small delays and messy notes create downstream risk.

Medi-Triage is designed to help you:
- **Capture essential info in seconds**
- **Standardize handoffs** across staff and shifts
- **Reduce "what did they mean?" ambiguity**
- **Prioritize quickly** using a consistent severity model

---

## Key Features
- **Quick intake flow** for symptoms + vitals + context *(customizable)*
- **Severity tagging** (e.g., low / medium / high / urgent)
- **Clear triage summary output** suitable for handoff
- **Searchable history / logs** *(if enabled in this repo)*
- **Simple UI** optimized for mobile and desktop

---

## Demo
- Live demo: **(add URL)**
- Video walkthrough: **(add URL)**
- Screenshots:  
  - `docs/screenshots/triage-form.png` *(add if available)*  
  - `docs/screenshots/summary.png` *(add if available)*

---

## Tech Stack
- Frontend: HTML / CSS / JavaScript
- Backend: Python (FastAPI + Uvicorn)
- Database: SQLite
- Deployment: Docker

---

## Getting Started

### Prerequisites
- Python 3.10+
- Docker (optional)

### Install
```bash
# 1) clone
git clone https://github.com/Simply-Coder-start/Medi-Triage.git
cd Medi-Triage

# 2) install dependencies
pip install -r backend/requirements.txt
```

### Run
```bash
cd backend
uvicorn api:app --reload
```

Then open `index.html` in your browser.

### Run with Docker (optional)
```bash
cd backend
docker build -t medi-triage-backend .
docker run -p 8000:8000 medi-triage-backend
```

### Tests (optional)
```bash
cd backend
python -m pytest test_symptom_mapping.py
```

---

## Project Structure
```text
Medi-Triage/
├─ backend/
│  ├─ api.py
│  ├─ rules_engine.py
│  ├─ requirements.txt
│  ├─ Dockerfile
│  └─ ...
├─ index.html
├─ styles.css
└─ README.md
```

---

## Configuration
Create a `.env` file if needed:

```env
# Example
# GOOGLE_CLIENT_ID=...
```

---

## Roadmap
- [ ] Add printable triage summary
- [ ] Add role-based access (clinician/admin)
- [ ] Add audit logging & export
- [ ] Add configurable triage protocols

---

## Contributing
Contributions are welcome.

1. Fork the repo
2. Create a branch: `git checkout -b feature/my-change`
3. Commit: `git commit -m "Add my change"`
4. Push: `git push origin feature/my-change`
5. Open a Pull Request

---

## ⚠️ Disclaimer
> **This project is for educational and support purposes only.**

- This tool is **NOT** a substitute for professional medical judgment.
- This tool is **NOT** FDA-approved and is **NOT** a diagnostic or treatment tool.
- **Do not** rely on this application to make clinical decisions.
- **Always** follow your local clinical protocols and escalate when in doubt.
- If you or someone else is experiencing a medical emergency, **call emergency services immediately** (e.g., 911).

---

## License
MIT
