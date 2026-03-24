import mimetypes
from pathlib import Path

from django.conf import settings
from django.http import FileResponse
from rest_framework import permissions, status
from rest_framework.authentication import SessionAuthentication
from rest_framework.response import Response
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404

from core.models import ExamPaper
from core.api.authentication import CookieJWTAuthentication
from core.api.file_gateway import build_protected_file_response, FileAccessError, _normalize_storage_path


class IsAdminStaff(permissions.BasePermission):
    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.is_staff)


class AdminPaperPageFileView(APIView):
    authentication_classes = [SessionAuthentication, CookieJWTAuthentication]
    permission_classes = [permissions.IsAuthenticated, IsAdminStaff]

    def _build_direct_file_response(self, raw_path: str):
        storage_scope, relative_path = _normalize_storage_path(raw_path)

        if storage_scope == 'media':
            base_dir = Path(settings.MEDIA_ROOT)
        else:
            base_dir = Path(settings.BASE_DIR) / 'Data'

        file_path = (base_dir / relative_path).resolve()
        base_resolved = base_dir.resolve()

        try:
            file_path.relative_to(base_resolved)
        except ValueError as exc:
            raise FileAccessError('Path traversal detected') from exc

        if not file_path.exists() or not file_path.is_file():
            raise FileAccessError('File not found')

        content_type, _ = mimetypes.guess_type(str(file_path))
        response = FileResponse(file_path.open('rb'), content_type=content_type or 'application/octet-stream')
        response['Cache-Control'] = 'private, no-store'
        response['Pragma'] = 'no-cache'
        response['X-Content-Type-Options'] = 'nosniff'
        return response

    def get(self, request, pk, page_index):
        paper = get_object_or_404(ExamPaper, pk=pk)

        pages = paper.pages or []
        index = page_index - 1
        if index < 0 or index >= len(pages):
            return Response({'detail': 'Page not found.'}, status=status.HTTP_404_NOT_FOUND)

        raw_path = pages[index]
        try:
            if request.get_port() == '8000':
                return self._build_direct_file_response(raw_path)
            return build_protected_file_response(raw_path)
        except FileAccessError:
            return Response({'detail': 'File path is invalid.'}, status=status.HTTP_404_NOT_FOUND)
