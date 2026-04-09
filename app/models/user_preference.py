from sqlalchemy import ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class UserPreference(Base):
    __tablename__ = "user_preferences"

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True, index=True)
    topic_id: Mapped[int] = mapped_column(ForeignKey("topics.id", ondelete="CASCADE"), primary_key=True, index=True)

    user: Mapped["User"] = relationship("User", back_populates="preferences")
    topic: Mapped["Topic"] = relationship("Topic", back_populates="user_preferences")


from app.models.user import User
from app.models.topic import Topic
