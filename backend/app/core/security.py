"""
Self-hosted auth: password hashing + JWT issuance/verification.

Replaces the earlier Clerk/Supabase stub. This backend now owns the
entire auth flow — no external account needed to run this locally.
Passwords are hashed with bcrypt (via passlib) and never stored in
plain text. Tokens are signed with our own secret (JWT_SECRET_KEY) and
properly verified on every request — the earlier version used
`jwt.get_unverified_claims`, which does NOT check the signature; this
version always verifies it.
"""
from datetime import datetime, timedelta, timezone

import bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.db import get_db
from app.models.user_data import User

bearer_scheme = HTTPBearer()


def hash_password(plain_password: str) -> str:
    # bcrypt has a hard 72-byte input limit; truncate defensively rather
    # than letting an unusually long password raise an error at signup.
    password_bytes = plain_password.encode("utf-8")[:72]
    return bcrypt.hashpw(password_bytes, bcrypt.gensalt()).decode("utf-8")


def verify_password(plain_password: str, password_hash: str) -> bool:
    password_bytes = plain_password.encode("utf-8")[:72]
    return bcrypt.checkpw(password_bytes, password_hash.encode("utf-8"))


def create_access_token(user_id: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": str(user_id), "exp": expire}
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    try:
        payload = jwt.decode(
            credentials.credentials,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Token missing subject claim")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="User no longer exists")
    return user
