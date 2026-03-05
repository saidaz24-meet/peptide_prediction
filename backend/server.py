"""
DEPRECATED: Compatibility shim.

All business logic has been moved to:
  - services/upload_service.py      (CSV upload processing)
  - services/predict_service.py     (single sequence prediction)
  - services/uniprot_execute_service.py  (UniProt query execution)
  - services/feedback_service.py    (feedback submission)

HTTP route handlers live in api/routes/*.py.
The FastAPI app is created in api/main.py.
"""
from api.main import SENTRY_INITIALIZED, app

__all__ = ["app", "SENTRY_INITIALIZED"]
