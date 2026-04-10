from sqlalchemy.orm import Session, joinedload

from app.models.post import Post
from app.models.post_tag import PostTag
from app.models.topic import Topic
from app.models.like import Like
from app.models.comment import Comment
from app.models.user_activity import UserActivity
from app.schemas.post import PostCreate, PostUpdate


def create_post(db: Session, author_id: int, data: PostCreate) -> Post:
    post = Post(content=data.content, author_id=author_id)
    db.add(post)
    db.flush()  # Get post.id

    if data.topic_ids:
        for topic_id in data.topic_ids:
            tag = PostTag(post_id=post.id, topic_id=topic_id)
            db.add(tag)

    # Log activity
    activity = UserActivity(
        user_id=author_id,
        activity_type="create_post",
        metadata_json={"post_id": post.id},
    )
    db.add(activity)

    db.commit()
    db.refresh(post)
    return post


def get_post(db: Session, post_id: int) -> Post | None:
    return db.query(Post).filter(Post.id == post_id).first()


def update_post(db: Session, post: Post, data: PostUpdate) -> Post:
    update_data = data.model_dump(exclude_unset=True)
    topic_ids = update_data.pop("topic_ids", None)

    for field, value in update_data.items():
        setattr(post, field, value)

    if topic_ids is not None:
        # Remove existing tags
        db.query(PostTag).filter(PostTag.post_id == post.id).delete()
        for topic_id in topic_ids:
            tag = PostTag(post_id=post.id, topic_id=topic_id)
            db.add(tag)

    db.commit()
    db.refresh(post)
    return post


def delete_post(db: Session, post_id: int) -> bool:
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        return False
    db.delete(post)
    db.commit()
    return True


def get_posts(db: Session, skip: int = 0, limit: int = 20) -> list[Post]:
    return (
        db.query(Post)
        .options(joinedload(Post.author), joinedload(Post.tags).joinedload(PostTag.topic))
        .order_by(Post.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


def explore_posts_by_topic(db: Session, topic_id: int, skip: int = 0, limit: int = 20) -> list[Post]:
    post_ids = (
        db.query(PostTag.post_id)
        .filter(PostTag.topic_id == topic_id)
        .subquery()
    )
    return (
        db.query(Post)
        .options(joinedload(Post.author), joinedload(Post.tags).joinedload(PostTag.topic))
        .filter(Post.id.in_(post_ids))
        .order_by(Post.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
