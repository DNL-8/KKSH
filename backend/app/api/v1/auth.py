from __future__ import annotations

import jwt
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from jwt import InvalidTokenError
from sqlalchemy import func
from sqlmodel import Session, select

from app.core.audit import log_event
from app.core.config import settings
from app.core.cookies import clear_auth_cookies, mint_csrf_token, set_auth_cookies, set_csrf_cookie
from app.core.deps import db_session, is_admin
from app.core.rate_limit import Rule, rate_limit
from app.core.security import (
    create_access_token,
    create_refresh_token,
    hash_password,
    verify_password,
)
from app.models import User
from app.schemas import AuthIn, AuthOut, UserOut
from app.services.tokens import (
    is_refresh_token_active,
    persist_refresh_token,
    revoke_refresh_token,
    rotate_refresh_token,
)

router = APIRouter()


def _rotate_csrf(response: Response) -> str:
    token = mint_csrf_token()
    set_csrf_cookie(response, token)
    return token


@router.get("/csrf")
def csrf(response: Response):
    """Mint a CSRF token cookie for the double-submit pattern.

    Frontend should call this once on boot, or rely on api client auto-fetch.
    """

    token = _rotate_csrf(response)
    return {"csrfToken": token}


_AUTH_RULE = Rule(
    max_requests=int(settings.rate_limit_auth_max),
    window_seconds=int(settings.rate_limit_auth_window_sec),
)


@router.post(
    "/signup",
    response_model=AuthOut,
    dependencies=[Depends(rate_limit("auth_signup", _AUTH_RULE))],
)
def signup(
    payload: AuthIn, request: Request, response: Response, session: Session = Depends(db_session)
):
    normalized_email = str(payload.email).strip().lower()
    existing = session.exec(select(User).where(func.lower(User.email) == normalized_email)).first()
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")

    user = User(email=normalized_email, password_hash=hash_password(payload.password))
    session.add(user)
    session.commit()
    session.refresh(user)

    access = create_access_token(user.id)
    refresh = create_refresh_token(user.id)
    set_auth_cookies(response, access, refresh)
    _rotate_csrf(response)
    persist_refresh_token(session, user_id=user.id, refresh_token=refresh)

    log_event(session, request, "auth.signup", user=user, metadata={"email": user.email})
    return {"user": UserOut(id=user.id, email=user.email, isAdmin=is_admin(user))}


@router.post(
    "/login",
    response_model=AuthOut,
    dependencies=[Depends(rate_limit("auth_login", _AUTH_RULE))],
)
def login(
    payload: AuthIn, request: Request, response: Response, session: Session = Depends(db_session)
):
    normalized_email = str(payload.email).strip().lower()
    candidates = session.exec(select(User).where(func.lower(User.email) == normalized_email)).all()
    user = next((u for u in candidates if verify_password(payload.password, u.password_hash)), None)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    access = create_access_token(user.id)
    refresh = create_refresh_token(user.id)
    set_auth_cookies(response, access, refresh)
    _rotate_csrf(response)
    persist_refresh_token(session, user_id=user.id, refresh_token=refresh)

    log_event(session, request, "auth.login", user=user)
    return {"user": UserOut(id=user.id, email=user.email, isAdmin=is_admin(user))}


@router.post(
    "/logout",
    dependencies=[Depends(rate_limit("auth_logout", _AUTH_RULE))],
)
def logout(request: Request, response: Response, session: Session = Depends(db_session)):
    token = request.cookies.get("refresh_token")
    if token:
        revoke_refresh_token(session, refresh_token=token)
    clear_auth_cookies(response)
    _rotate_csrf(response)
    log_event(session, request, "auth.logout", user=None)
    return {"ok": True}


@router.post(
    "/refresh",
    response_model=AuthOut,
    dependencies=[Depends(rate_limit("auth_refresh", _AUTH_RULE))],
)
def refresh_token(request: Request, response: Response, session: Session = Depends(db_session)):
    # Refresh uses the refresh_token cookie to mint a new access token.
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(status_code=401, detail="Missing refresh token")

    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token")
        user_id = payload.get("sub")
        # Backward compatible: legacy refresh tokens may not have jti.
        token_jti = payload.get("jti")
        if token_jti is not None and (not isinstance(token_jti, str) or not token_jti.strip()):
            raise HTTPException(status_code=401, detail="Invalid token")
    except (InvalidTokenError, HTTPException) as err:
        raise HTTPException(status_code=401, detail="Invalid token") from err

    user = session.exec(select(User).where(User.id == user_id)).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    # Optional DB-backed refresh token check/rotation
    if not is_refresh_token_active(session, refresh_token=token):
        raise HTTPException(status_code=401, detail="Refresh token revoked/expired")

    access = create_access_token(user.id)
    refresh = create_refresh_token(user.id)
    rotate_refresh_token(session, old_token=token, user_id=user.id, new_token=refresh)
    set_auth_cookies(response, access, refresh)
    _rotate_csrf(response)

    log_event(session, request, "auth.refresh", user=user)
    return {"user": UserOut(id=user.id, email=user.email, isAdmin=is_admin(user))}
