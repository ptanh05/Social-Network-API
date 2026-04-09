from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload

from app.core.deps import get_db, get_current_user
from app.models.user import User
from app.models.post import Post
from app.models.post_tag import PostTag
from app.models.like import Like
from app.models.comment import Comment
from app.models.user_activity import UserActivity
from app.schemas.post import PostCreate, PostRead, PostUpdate, PostWithFeedScore
from app.schemas.comment import CommentCreate, CommentRead
from app.schemas.pagination import PaginationParams
from app.services import post_service, feed_service

router = APIRouter()


def _post_to_read(post: Post) -> PostRead:
    return PostRead(
        id=post.id,
        content=post.content,
        author_id=post.author_id,
        created_at=post.created_at,
        updated_at=post.updated_at,
        topics=[tag.topic for tag in post.tags],
        author=post.author,
        likes_count=len(post.likes) if post.likes else 0,
        comments_count=len(post.comments) if post.comments else 0,
    )


@router.post("/", response_model=PostRead, status_code=status.HTTP_201_CREATED)
def create_post(post_in: PostCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    post = post_service.create_post(db, current_user.id, post_in)
    db.refresh(post)
    post = db.query(Post).options(
        joinedload(Post.author),
        joinedload(Post.tags).joinedload(PostTag.topic),
        joinedload(Post.likes),
        joinedload(Post.comments),
    ).filter(Post.id == post.id).first()
    return _post_to_read(post)


@router.get("/feed", response_model=list[PostWithFeedScore])
def get_feed(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    params: PaginationParams = Depends(),
):
    posts = feed_service.get_feed(db, current_user.id, skip=params.skip, limit=params.limit)
    return posts


@router.get("/explore", response_model=list[PostRead])
def explore_posts(
    topic_id: int = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    params: PaginationParams = Depends(),
):
    posts = post_service.explore_posts_by_topic(db, topic_id, skip=params.skip, limit=params.limit)
    return [_post_to_read(p) for p in posts]


# --- Comment endpoints (nested under posts) ---
@router.post("/{post_id}/comments/", response_model=CommentRead, status_code=status.HTTP_201_CREATED)
def create_comment(
    post_id: int,
    comment_in: CommentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    comment = Comment(
        content=comment_in.content,
        post_id=post_id,
        author_id=current_user.id,
        parent_id=comment_in.parent_id,
    )
    db.add(comment)
    activity = UserActivity(
        user_id=current_user.id,
        activity_type="comment",
        metadata_json={"post_id": post_id},
    )
    db.add(activity)
    db.commit()
    db.refresh(comment)
    return comment


@router.get("/{post_id}/comments/", response_model=list[CommentRead])
def list_comments(post_id: int, db: Session = Depends(get_db)):
    comments = (
        db.query(Comment)
        .options(joinedload(Comment.author))
        .filter(Comment.post_id == post_id)
        .order_by(Comment.created_at.asc())
        .all()
    )
    return comments


# --- CRUD (must be after specific routes) ---
@router.get("/{post_id}", response_model=PostRead)
def get_post(post_id: int, db: Session = Depends(get_db)):
    post = db.query(Post).options(
        joinedload(Post.author),
        joinedload(Post.tags).joinedload(PostTag.topic),
        joinedload(Post.likes),
        joinedload(Post.comments),
    ).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    return _post_to_read(post)


@router.put("/{post_id}", response_model=PostRead)
def update_post(
    post_id: int,
    post_in: PostUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    post = post_service.get_post(db, post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    if post.author_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized")
    post = post_service.update_post(db, post, post_in)
    post = db.query(Post).options(
        joinedload(Post.author),
        joinedload(Post.tags).joinedload(PostTag.topic),
        joinedload(Post.likes),
        joinedload(Post.comments),
    ).filter(Post.id == post_id).first()
    return _post_to_read(post)


@router.delete("/{post_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_post(post_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    post = post_service.get_post(db, post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    if post.author_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized")
    post_service.delete_post(db, post_id)
