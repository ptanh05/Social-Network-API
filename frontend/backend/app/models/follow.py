from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Follow(Base):
    __tablename__ = "follows"

    follower_id: Mapped[int] = mapped_column(ForeignKey("users.id"), primary_key=True, index=True)
    following_id: Mapped[int] = mapped_column(ForeignKey("users.id"), primary_key=True, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    follower: Mapped["User"] = relationship("User", foreign_keys=[follower_id], back_populates="following")
    following_user: Mapped["User"] = relationship("User", foreign_keys=[following_id], back_populates="followers")


from app.models.user import User
