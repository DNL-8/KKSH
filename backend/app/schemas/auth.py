from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field, field_validator


class ErrorOut(BaseModel):
    code: str
    message: str
    details: Optional[object] = None


class AuthIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: EmailStr) -> str:
        return str(value).strip().lower()


class UserUpdateIn(BaseModel):
    username: Optional[str] = Field(default=None, min_length=3, max_length=32, pattern=r"^[a-zA-Z0-9_]+$")


class UserOut(BaseModel):
    id: str
    username: Optional[str] = None
    email: EmailStr
    isAdmin: bool = False


class AuthOut(BaseModel):
    user: UserOut
