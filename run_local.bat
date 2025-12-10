@echo off
echo Setting up local backend...

cd backend
if not exist "venv" (
    echo Creating virtual environment...
    python -m venv venv
)

echo Activating venv...
call venv\Scripts\activate

echo Installing requirements...
pip install -r requirements.txt

echo Starting server...
set DATABASE_URL=sqlite:///./triage.db
set SECRET_KEY=dev_secret_key_123
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

pause
