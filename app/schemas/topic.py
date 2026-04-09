from pydantic import BaseModel


class TopicRead(BaseModel):
    id: int
    name: str
    description: str | None

    model_config = {"from_attributes": True}
