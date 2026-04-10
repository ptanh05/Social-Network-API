from datetime import datetime

from pydantic import BaseModel

from app.schemas.user import UserRead


class FollowResponse(BaseModel):
    follower_id: int
    following_id: int
    created_at: datetime
    following_user: UserRead | None = None

    model_config = {"from_attributes": True}


class FollowStatus(BaseModel):
    following: bool
