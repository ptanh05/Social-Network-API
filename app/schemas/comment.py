from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.user import UserRead


class CommentCreate(BaseModel):
    content: str = Field(..., min_length=1)
    parent_id: int | None = None


class CommentUpdate(BaseModel):
    content: str = Field(..., min_length=1)


class CommentRead(BaseModel):
    id: int
    content: str
    post_id: int
    author_id: int
    parent_id: int | None
    created_at: datetime
    author: UserRead | None = None

    model_config = {"from_attributes": True}
