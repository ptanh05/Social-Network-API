from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.user import UserRead
from app.schemas.topic import TopicRead


class PostCreate(BaseModel):
    content: str = Field(..., min_length=1)
    topic_ids: list[int] | None = None


class PostUpdate(BaseModel):
    content: str | None = Field(None, min_length=1)
    topic_ids: list[int] | None = None


class PostRead(BaseModel):
    id: int
    content: str
    author_id: int
    created_at: datetime
    updated_at: datetime
    topics: list[TopicRead] = []
    author: UserRead | None = None
    likes_count: int = 0
    comments_count: int = 0

    model_config = {"from_attributes": True}


class PostWithFeedScore(PostRead):
    feed_score: int = 0  # 3 = preferred + following, 2 = preferred only, 1 = following only
