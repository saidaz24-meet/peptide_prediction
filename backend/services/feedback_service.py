"""
Feedback processing service.

Handles rate limiting, screenshot validation, and Sentry event submission.
Extracted from server.py for separation of concerns.
"""
import os
import time
import base64
import tempfile
import threading
from typing import Dict, List, Optional

import sentry_sdk

from schemas.feedback import FeedbackRequest
from services.logger import log_warning


# Thread-safe in-memory rate limiting for feedback (per-IP)
_rate_limit_lock = threading.Lock()
_feedback_rate_limit: Dict[str, List[float]] = {}


def check_rate_limit(ip: str) -> bool:
    """Check if IP has exceeded rate limit (5 requests per 10 minutes). Thread-safe."""
    now = time.time()
    window_start = now - 600  # 10 minutes

    with _rate_limit_lock:
        # Clean old entries
        if ip in _feedback_rate_limit:
            _feedback_rate_limit[ip] = [t for t in _feedback_rate_limit[ip] if t > window_start]

        if ip not in _feedback_rate_limit:
            _feedback_rate_limit[ip] = []

        request_times = _feedback_rate_limit[ip]

        # Allow at most 5 requests
        if len(request_times) >= 5:
            return False

        request_times.append(now)
        return True


def _decode_screenshot(screenshot_data: str) -> tuple:
    """
    Validate and decode a base64 screenshot data URL.

    Returns:
        Tuple of (screenshot_bytes, screenshot_filename, screenshot_content_type)

    Raises:
        ValueError with user-facing message on invalid data.
    """
    if not screenshot_data.startswith('data:image/'):
        raise ValueError("Invalid screenshot format. Must be a valid image.")

    parts = screenshot_data.split(',', 1)
    if len(parts) != 2:
        raise ValueError("Invalid screenshot data format.")

    header = parts[0]
    base64_data = parts[1]

    # Extract content type
    content_type_map = {
        'image/png': ('image/png', 'feedback_screenshot.png'),
        'image/jpeg': ('image/jpeg', 'feedback_screenshot.jpg'),
        'image/jpg': ('image/jpeg', 'feedback_screenshot.jpg'),
        'image/gif': ('image/gif', 'feedback_screenshot.gif'),
        'image/webp': ('image/webp', 'feedback_screenshot.webp'),
    }

    content_type = 'image/png'
    filename = 'feedback_screenshot.png'
    for key, (ct, fn) in content_type_map.items():
        if key in header:
            content_type = ct
            filename = fn
            break

    # Check size (max 5MB base64 ~ 7MB encoded)
    if len(screenshot_data) > 7 * 1024 * 1024:
        raise ValueError("Screenshot too large. Maximum size is 5MB.")

    try:
        screenshot_bytes = base64.b64decode(base64_data)
    except base64.binascii.Error:
        raise ValueError("Invalid base64 screenshot data.")

    if len(screenshot_bytes) > 5 * 1024 * 1024:
        raise ValueError("Screenshot too large. Maximum size is 5MB.")

    return screenshot_bytes, filename, content_type


def _send_to_sentry(
    message: str,
    feedback_data: FeedbackRequest,
    screenshot_bytes: Optional[bytes],
    screenshot_filename: Optional[str],
    screenshot_content_type: Optional[str],
) -> None:
    """Send feedback to Sentry as an INFO-level event."""
    try:
        with sentry_sdk.push_scope() as scope:
            scope.set_tag("kind", "user_feedback")
            scope.set_tag("source", "feedback_button")
            if feedback_data.pageUrl:
                scope.set_extra("pageUrl", feedback_data.pageUrl)
            if feedback_data.userAgent:
                scope.set_extra("userAgent", feedback_data.userAgent)

            message_title = message[:200] + "..." if len(message) > 200 else message
            scope.set_extra("full_message", message)

            # Add screenshot as attachment if provided
            temp_file_path = None
            if screenshot_bytes and screenshot_filename:
                try:
                    suffix = '.png' if 'png' in screenshot_filename else '.jpg'
                    temp_fd, temp_file_path = tempfile.mkstemp(suffix=suffix)
                    with os.fdopen(temp_fd, 'wb') as temp_file:
                        temp_file.write(screenshot_bytes)

                    if hasattr(scope, 'add_attachment'):
                        try:
                            scope.add_attachment(
                                path=temp_file_path,
                                filename=screenshot_filename,
                                content_type=screenshot_content_type or 'image/png'
                            )
                            scope.set_extra("has_screenshot", True)
                        except (TypeError, ValueError):
                            try:
                                scope.add_attachment(
                                    bytes=screenshot_bytes,
                                    filename=screenshot_filename,
                                    content_type=screenshot_content_type or 'image/png'
                                )
                                scope.set_extra("has_screenshot", True)
                            except Exception:
                                scope.set_extra("has_screenshot", False)
                    else:
                        scope.set_extra("has_screenshot", False)
                except Exception as attach_error:
                    log_warning("feedback_attachment_failed",
                                f"Failed to add screenshot attachment: {attach_error}",
                                **{"error": str(attach_error)})
                    scope.set_extra("has_screenshot", False)

            sentry_sdk.capture_message(f"User Feedback: {message_title}", level="info")

            # Clean up temp file
            if temp_file_path and os.path.exists(temp_file_path):
                try:
                    os.unlink(temp_file_path)
                except Exception:
                    pass
    except Exception as e:
        log_warning("feedback_sentry_failed",
                    f"Failed to send feedback to Sentry: {e}",
                    **{"error": str(e)})


async def process_feedback(
    client_ip: str,
    feedback_data: FeedbackRequest,
    sentry_initialized: bool,
) -> dict:
    """
    Process a feedback submission.

    Validates message, decodes screenshot, sends to Sentry.
    Returns {"ok": True} on success.

    Raises:
        ValueError with user-facing message on validation errors.
    """
    message = feedback_data.message.strip()
    if len(message) < 5:
        raise ValueError("Message must be at least 5 characters")
    if len(message) > 2000:
        raise ValueError("Message must not exceed 2000 characters")

    # Decode screenshot if provided
    screenshot_bytes = None
    screenshot_filename = None
    screenshot_content_type = None

    if feedback_data.screenshot:
        screenshot_bytes, screenshot_filename, screenshot_content_type = _decode_screenshot(
            feedback_data.screenshot
        )

    # Send to Sentry
    if sentry_initialized:
        _send_to_sentry(message, feedback_data, screenshot_bytes,
                        screenshot_filename, screenshot_content_type)
    else:
        log_warning("feedback_sentry_disabled",
                    "Feedback submitted but Sentry not initialized (SENTRY_DSN not set)")

    return {"ok": True}
