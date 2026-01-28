"""
Minimal structured logger with traceId support.
Emits JSON-like single-line logs: level, event, traceId, entry, and optional fields.
"""
import logging
import json
import os
from typing import Optional, Dict, Any
from datetime import datetime
from contextvars import ContextVar

# Context variable to store traceId per request
trace_id_var: ContextVar[Optional[str]] = ContextVar('trace_id', default=None)

class StructuredFormatter(logging.Formatter):
    """Formatter that emits JSON-like single-line logs."""
    
    def format(self, record: logging.LogRecord) -> str:
        # Get traceId from context or record
        trace_id = trace_id_var.get() or getattr(record, 'traceId', None)
        
        # Build log entry with required fields
        log_entry: Dict[str, Any] = {
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "level": record.levelname,
            "event": getattr(record, 'event', record.name),
            "message": record.getMessage(),
        }
        
        # Add traceId if available
        if trace_id:
            log_entry["traceId"] = trace_id
        
        # Add stage if present (e.g., "parse", "normalize", "tango_run", "tango_parse", "normalize_rows_for_ui", "response")
        if hasattr(record, 'stage'):
            log_entry["stage"] = record.stage
        
        # Add run_id if present (TANGO run directory)
        if hasattr(record, 'run_id'):
            log_entry["run_id"] = record.run_id
        
        # Add entry ID if present (for peptide-specific tracing - ID only, not sequence)
        if hasattr(record, 'entry'):
            log_entry["entry"] = record.entry
        
        # Add any extra fields (details - must not contain sequence data)
        if hasattr(record, 'extra_fields'):
            log_entry.update(record.extra_fields)
        
        # Emit as single-line JSON (compact, no pretty-print)
        return json.dumps(log_entry, ensure_ascii=False)

def setup_logger(name: str = "peptide_prediction", level: str = "INFO") -> logging.Logger:
    """Setup structured logger with JSON formatter."""
    logger = logging.getLogger(name)
    logger.setLevel(getattr(logging, level.upper(), logging.INFO))
    
    # Remove existing handlers to avoid duplicates
    logger.handlers.clear()
    
    # Add console handler with structured formatter
    handler = logging.StreamHandler()
    handler.setFormatter(StructuredFormatter())
    logger.addHandler(handler)
    
    # Prevent propagation to root logger
    logger.propagate = False
    
    return logger

# Global logger instance
_logger = None

def get_logger() -> logging.Logger:
    """Get or create the global logger instance."""
    global _logger
    if _logger is None:
        log_level = os.getenv("LOG_LEVEL", "INFO")
        _logger = setup_logger("peptide_prediction", log_level)
    return _logger

def set_trace_id(trace_id: str) -> None:
    """Set traceId in context for current request."""
    trace_id_var.set(trace_id)

def get_trace_id() -> Optional[str]:
    """Get traceId from context."""
    return trace_id_var.get()

def log_event(level: str, event: str, message: str, entry: Optional[str] = None, stage: Optional[str] = None, run_id: Optional[str] = None, **kwargs) -> None:
    """
    Log a structured event with traceId and optional entry, stage, run_id.
    
    Args:
        level: Log level (DEBUG, INFO, WARNING, ERROR)
        event: Event name (e.g., "upload_parse", "tango_run", "normalize")
        message: Log message
        entry: Optional entry ID for peptide-specific tracing (ID only, not sequence)
        stage: Optional stage name (e.g., "parse", "normalize", "tango_run", "tango_parse", "normalize_rows_for_ui", "response")
        run_id: Optional run directory ID (TANGO run directory)
        **kwargs: Additional fields to include in log (details - must not contain sequence data)
    """
    logger = get_logger()
    log_method = getattr(logger, level.lower(), logger.info)
    
    # Create extra dict for custom fields
    extra = {
        'event': event,
        **kwargs
    }
    if entry:
        extra['entry'] = entry  # Entry ID only, not sequence
    if stage:
        extra['stage'] = stage
    if run_id:
        extra['run_id'] = run_id
    
    log_method(message, extra=extra)

# Convenience functions
def log_info(event: str, message: str, entry: Optional[str] = None, stage: Optional[str] = None, run_id: Optional[str] = None, **kwargs) -> None:
    """Log INFO level event."""
    log_event("INFO", event, message, entry, stage, run_id, **kwargs)

def log_warning(event: str, message: str, entry: Optional[str] = None, stage: Optional[str] = None, run_id: Optional[str] = None, **kwargs) -> None:
    """Log WARNING level event."""
    log_event("WARNING", event, message, entry, stage, run_id, **kwargs)

def log_error(event: str, message: str, entry: Optional[str] = None, stage: Optional[str] = None, run_id: Optional[str] = None, **kwargs) -> None:
    """Log ERROR level event."""
    log_event("ERROR", event, message, entry, stage, run_id, **kwargs)

def log_debug(event: str, message: str, entry: Optional[str] = None, stage: Optional[str] = None, run_id: Optional[str] = None, **kwargs) -> None:
    """Log DEBUG level event."""
    log_event("DEBUG", event, message, entry, stage, run_id, **kwargs)

