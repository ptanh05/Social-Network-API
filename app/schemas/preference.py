from pydantic import BaseModel

from app.schemas.topic import TopicRead


class PreferenceUpdate(BaseModel):
    topic_ids: list[int]


class PreferenceRead(BaseModel):
    topic_ids: list[int]


class PreferenceWithTopics(BaseModel):
    topics: list[TopicRead]
