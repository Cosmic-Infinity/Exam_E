import mimetypes
import os
from urllib.parse import quote

from django.http import HttpResponse


class FileAccessError(ValueError):
    pass


def _normalize_storage_path(raw_path: str) -> tuple[str, str]:
    if not raw_path or not isinstance(raw_path, str):
        raise FileAccessError("Invalid file path")

    normalized = raw_path.replace("\\", "/").strip().lstrip("/")
    normalized = os.path.normpath(normalized).replace("\\", "/")

    if normalized.startswith("../") or normalized == "..":
        raise FileAccessError("Path traversal detected")

    if normalized.startswith("Data/"):
        return "data", normalized[len("Data/"):]

    if normalized.startswith("media/"):
        return "media", normalized[len("media/"):]

    if normalized.startswith("mediafiles/"):
        return "media", normalized[len("mediafiles/"):]

    raise FileAccessError("Unsupported storage root")


def build_protected_file_response(raw_path: str, *, inline_filename: str | None = None) -> HttpResponse:
    storage_scope, relative_path = _normalize_storage_path(raw_path)

    if storage_scope == "data":
        internal_uri = f"/_protected_data/{relative_path}"
    else:
        internal_uri = f"/_protected_media/{relative_path}"

    content_type, _ = mimetypes.guess_type(relative_path)

    response = HttpResponse(status=200)
    response["X-Accel-Redirect"] = internal_uri
    response["Content-Type"] = content_type or "application/octet-stream"
    response["Cache-Control"] = "private, no-store"
    response["Pragma"] = "no-cache"
    response["X-Content-Type-Options"] = "nosniff"

    filename = inline_filename or os.path.basename(relative_path)
    response["Content-Disposition"] = f"inline; filename*=UTF-8''{quote(filename)}"
    return response
