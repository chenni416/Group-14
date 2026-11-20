"""檔案儲存（空殼）。預計使用 Supabase Storage，介面保持與 S3 類似，之後要換服務只改實作"""

from typing import Protocol


class FileStorage(Protocol):
    def upload(self, path: str, data: bytes, content_type: str) -> str:
        """上傳檔案，回傳儲存路徑"""
        ...

    def download(self, path: str) -> bytes: ...

    def delete(self, path: str) -> None: ...
