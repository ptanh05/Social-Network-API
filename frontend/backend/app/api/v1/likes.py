from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import get_db, get_current_user
from app.models.user import User
from app.models.post import Post
from app.models.like import Like
from app.models.user_activity import UserActivity
from app.schemas.like import LikeStatus

router = APIRouter()


@router.post("/posts/{post_id}/like/", response_model=LikeStatus, status_code=status.HTTP_201_CREATED)
def like_post(
    post_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    existing = db.query(Like).filter(Like.user_id == current_user.id, Like.post_id == post_id).first()
    if existing:
        raise HTTPException(status_code=400, detail="Already liked")

    like = Like(user_id=current_user.id, post_id=post_id)
    db.add(like)

    activity = UserActivity(
        user_id=current_user.id,
        activity_type="like",
        metadata_json={"post_id": post_id},
    )
    db.add(activity)

    db.commit()
    return LikeStatus(liked=True)


@router.delete("/posts/{post_id}/like/", response_model=LikeStatus)
def unlike_post(
    post_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    like = db.query(Like).filter(Like.user_id == current_user.id, Like.post_id == post_id).first()
    if not like:
        raise HTTPException(status_code=404, detail="Like not found")
    db.delete(like)
    db.commit()
    return LikeStatus(liked=False)
