from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Cookie, HTTPException, Request, Response

from app.schemas_auth import AuthCredentials, AuthResponse, AuthUser
from app.services.auth_service import SESSION_TTL_SECONDS, AuthError, create_session, create_user, delete_session, get_user_by_session, verify_user


router = APIRouter(prefix="/api/auth", tags=["auth"])
SESSION_COOKIE_NAME = "cryptorisk_session"


def _is_secure_request(request: Request) -> bool:
    forwarded_proto = request.headers.get("x-forwarded-proto", "")
    return request.url.scheme == "https" or forwarded_proto.lower() == "https"


def _set_session_cookie(request: Request, response: Response, token: str, max_age: int) -> None:
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=token,
        max_age=max_age,
        expires=datetime.now(timezone.utc) + timedelta(seconds=max_age),
        httponly=True,
        secure=_is_secure_request(request),
        samesite="lax",
        path="/",
    )


def _auth_error(exc: AuthError) -> HTTPException:
    return HTTPException(status_code=400, detail=str(exc))


@router.post("/register", response_model=AuthResponse)
def register(payload: AuthCredentials, request: Request, response: Response) -> AuthResponse:
    try:
        user = create_user(payload.username, payload.password)
        token, _expires_at = create_session(user.id)
        _set_session_cookie(request, response, token, SESSION_TTL_SECONDS)
        return AuthResponse(message="注册成功", user=user)
    except AuthError as exc:
        raise _auth_error(exc) from exc


@router.post("/login", response_model=AuthResponse)
def login(payload: AuthCredentials, request: Request, response: Response) -> AuthResponse:
    try:
        user = verify_user(payload.username, payload.password)
        token, _expires_at = create_session(user.id)
        _set_session_cookie(request, response, token, SESSION_TTL_SECONDS)
        return AuthResponse(message="登录成功", user=user)
    except AuthError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc


@router.get("/me", response_model=AuthUser | None)
def me(cryptorisk_session: str | None = Cookie(default=None)) -> AuthUser | None:
    return get_user_by_session(cryptorisk_session)


@router.post("/logout")
def logout(response: Response, cryptorisk_session: str | None = Cookie(default=None)):
    delete_session(cryptorisk_session)
    response.delete_cookie(SESSION_COOKIE_NAME, path="/")
    return {"status": "success", "message": "已退出登录"}
