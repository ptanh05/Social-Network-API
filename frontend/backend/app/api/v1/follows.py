from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.core.deps import get_db, get_current_user
from app.models.user import User
from app.models.follow import Follow
from app.models.user_activity import UserActivity
from app.schemas.follow import FollowResponse, FollowStatus

router = APIRouter()


@router.post("/users/{user_id}/follow/", response_model=FollowStatus, status_code=status.HTTP_201_CREATED)
def follow_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot follow yourself")

    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    existing = db.query(Follow).filter(
        Follow.follower_id == current_user.id, Follow.following_id == user_id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Already following")

    follow = Follow(follower_id=current_user.id, following_id=user_id)
    db.add(follow)

    activity = UserActivity(
        user_id=current_user.id,
        activity_type="follow",
        metadata_json={"followed_user_id": user_id},
    )
    db.add(activity)

    db.commit()
    return FollowStatus(following=True)


@router.delete("/users/{user_id}/follow/", response_model=FollowStatus)
def unfollow_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    follow = db.query(Follow).filter(
        Follow.follower_id == current_user.id, Follow.following_id == user_id
    ).first()
    if not follow:
        raise HTTPException(status_code=404, detail="Not following")
    db.delete(follow)
    db.commit()
    return FollowStatus(following=False)
