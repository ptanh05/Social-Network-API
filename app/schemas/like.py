from datetime import datetime

from pydantic import BaseModel


class LikeResponse(BaseModel):
    user_id: int
    post_id: int
    created_at: datetime

    model_config = {"from_attributes": True}


class LikeStatus(BaseModel):
    liked: bool
