from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr
    password: str = Field(..., min_length=6)
    date_of_birth: str | None = Field(None, pattern=r"^\d{4}-\d{2}-\d{2}$")


class UserLogin(BaseModel):
    username: str
    password: str


class UserUpdate(BaseModel):
    username: str | None = Field(None, min_length=3, max_length=50)
    date_of_birth: str | None = Field(None, pattern=r"^\d{4}-\d{2}-\d{2}$")


class UserRead(BaseModel):
    id: int
    username: str
    email: EmailStr
    date_of_birth: str | None
    is_admin: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class UserInDB(BaseModel):
    id: int
    username: str
    email: EmailStr
    hashed_password: str
    is_admin: bool

    model_config = {"from_attributes": True}


class UserProfile(UserRead):
    followers_count: int = 0
    following_count: int = 0
    posts_count: int = 0
