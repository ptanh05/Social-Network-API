from pydantic import BaseModel


class AgeGroupStats(BaseModel):
    age_group: str  # e.g. "18-24", "25-34", "35-44", "45+", "Unknown"
    count: int
    percentage: float


class DemographicsResponse(BaseModel):
    total_users: int
    age_groups: list[AgeGroupStats]


class TopicStats(BaseModel):
    topic_id: int
    topic_name: str
    user_count: int


class PopularTopicsResponse(BaseModel):
    topics: list[TopicStats]
