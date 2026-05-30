from __future__ import annotations

from fastapi import APIRouter, Cookie, HTTPException

from app.api.auth import SESSION_COOKIE_NAME
from app.schemas_auth import AuthUser
from app.schemas_favorites import FavoriteCreate, FavoriteItem, FavoriteType
from app.services.auth_service import add_favorite, delete_favorite, get_user_by_session, list_favorites


router = APIRouter(prefix="/api/favorites", tags=["favorites"])


def _current_user(token: str | None) -> AuthUser:
    user = get_user_by_session(token)
    if not user:
        raise HTTPException(status_code=401, detail="请先登录后再收藏")
    return user


@router.get("", response_model=list[FavoriteItem])
def favorites(
    item_type: FavoriteType | None = None,
    cryptorisk_session: str | None = Cookie(default=None, alias=SESSION_COOKIE_NAME),
) -> list[FavoriteItem]:
    user = _current_user(cryptorisk_session)
    return list_favorites(user.id, item_type)


@router.post("", response_model=FavoriteItem)
def create_favorite(
    payload: FavoriteCreate,
    cryptorisk_session: str | None = Cookie(default=None, alias=SESSION_COOKIE_NAME),
) -> FavoriteItem:
    user = _current_user(cryptorisk_session)
    return add_favorite(user.id, payload)


@router.delete("/{item_type}/{item_id}")
def remove_favorite(
    item_type: FavoriteType,
    item_id: str,
    cryptorisk_session: str | None = Cookie(default=None, alias=SESSION_COOKIE_NAME),
):
    user = _current_user(cryptorisk_session)
    delete_favorite(user.id, item_type, item_id)
    return {"status": "success", "message": "已取消收藏"}

