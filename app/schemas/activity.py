from datetime import datetime

from pydantic import BaseModel


class ActivityRead(BaseModel):
    id: int
    user_id: int
    activity_type: str
    metadata_json: dict | None
    created_at: datetime

    model_config = {"from_attributes": True}
