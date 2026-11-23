"""登入成員：members 資料表的讀寫（規格見 docs/github.md 3.1）。

- 一個 GitHub 帳號對應一筆，以 github_id 比對（帳號改名也不會變）
- 系統內以 GitHub 帳號名稱作為使用者 ID 與預設顯示名稱；使用者可以自訂 display_name
- 每次登入同步 GitHub 帳號名稱、頭像、email，但不覆蓋使用者自訂的 display_name
"""

import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.auth import AuthUser
from app.core.errors import ApiError
from app.models import Member as MemberRow
from app.schemas.member import Member

DISPLAY_NAME_MAX = 50


def _now() -> datetime:
    return datetime.now(UTC)


def _find(db: Session, auth_user_id: uuid.UUID, user: AuthUser) -> MemberRow | None:
    row = db.scalar(select(MemberRow).where(MemberRow.auth_user_id == auth_user_id))
    if row is None and user.github_id is not None:
        # Supabase 帳號重建時 sub 會變，但 GitHub id 不變：沿用原本的成員資料
        row = db.scalar(select(MemberRow).where(MemberRow.github_id == user.github_id))
    return row


def sync_member(db: Session, user: AuthUser) -> MemberRow:
    """取得登入者對應的成員；第一次登入時建立，GitHub 資料有變動時更新"""
    if user.github_id is None or not user.github_login:
        raise ApiError("目前只支援以 GitHub 帳號登入", status=403, code="GITHUB_REQUIRED")
    auth_user_id = _parse_uuid(user.id)
    if auth_user_id is None:
        raise ApiError("登入資訊無效，請重新登入", status=401, code="INVALID_TOKEN")

    row = _find(db, auth_user_id, user)
    if row is None:
        row = MemberRow(
            auth_user_id=auth_user_id,
            github_id=user.github_id,
            github_login=user.github_login,
            email=user.email or None,
            avatar_url=user.avatar_url,
            last_login_at=_now(),
        )
        db.add(row)
        try:
            db.commit()
        except IntegrityError:
            # 同一個人同時送出兩個請求：另一個請求已經建立了，改用那一筆
            db.rollback()
            row = _find(db, auth_user_id, user)
            if row is None:
                raise
        return row

    changes = {
        "auth_user_id": auth_user_id,
        "github_id": user.github_id,
        "github_login": user.github_login,
        "email": user.email or row.email,
        "avatar_url": user.avatar_url or row.avatar_url,
    }
    changed = {k: v for k, v in changes.items() if getattr(row, k) != v}
    if changed:
        for key, value in changed.items():
            setattr(row, key, value)
        row.updated_at = _now()
        db.commit()
    return row


def touch_login(db: Session, member_id: str) -> None:
    """記錄最後登入時間（前端每次開啟時呼叫 /api/me）"""
    member_uuid = _parse_uuid(member_id)
    row = db.get(MemberRow, member_uuid) if member_uuid else None
    if row is not None:
        row.last_login_at = _now()
        db.commit()


def update_display_name(db: Session, member_id: str, display_name: str | None) -> MemberRow:
    """修改顯示名稱；空白表示恢復使用 GitHub 帳號名稱"""
    member_uuid = _parse_uuid(member_id)
    row = db.get(MemberRow, member_uuid) if member_uuid else None
    if row is None:
        raise ApiError("示範身分無法修改帳號設定，請以 GitHub 登入", status=400, code="NOT_A_GITHUB_MEMBER")
    name = (display_name or "").strip()
    if len(name) > DISPLAY_NAME_MAX:
        raise ApiError(f"顯示名稱最多 {DISPLAY_NAME_MAX} 個字", status=422, code="VALIDATION_ERROR")
    row.display_name = name or None
    row.updated_at = _now()
    db.commit()
    return row


def to_schema(row: MemberRow) -> Member:
    """轉成前端的 Member；專案內的設定在專案功能完成前先用預設值"""
    return Member(
        id=str(row.id),
        name=row.display_name or row.github_login,
        email=row.email or "",
        role="Member",
        title="",
        domain="FE",
        tags=[],
        capacity=0,
        github_login=row.github_login,
        avatar_url=row.avatar_url,
        display_name=row.display_name,
    )


def _parse_uuid(member_id: str) -> uuid.UUID | None:
    """資料庫成員的 id 是 uuid；開發用的示範成員（m1 等）不是，回傳 None"""
    try:
        return uuid.UUID(member_id)
    except ValueError:
        return None
