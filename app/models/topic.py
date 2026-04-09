from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Topic(Base):
    __tablename__ = "topics"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    user_preferences: Mapped[list["UserPreference"]] = relationship("UserPreference", back_populates="topic")
    post_tags: Mapped[list["PostTag"]] = relationship("PostTag", back_populates="topic")


from app.models.user_preference import UserPreference
from app.models.post_tag import PostTag
