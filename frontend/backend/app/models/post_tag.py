from sqlalchemy import ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class PostTag(Base):
    __tablename__ = "post_tags"

    post_id: Mapped[int] = mapped_column(ForeignKey("posts.id", ondelete="CASCADE"), primary_key=True, index=True)
    topic_id: Mapped[int] = mapped_column(ForeignKey("topics.id", ondelete="CASCADE"), primary_key=True, index=True)

    post: Mapped["Post"] = relationship("Post", back_populates="tags")
    topic: Mapped["Topic"] = relationship("Topic", back_populates="post_tags")


from app.models.post import Post
from app.models.topic import Topic
