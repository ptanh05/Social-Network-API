from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import get_db, get_current_user
from app.schemas.user import UserRead, UserUpdate, UserProfile
from app.schemas.pagination import PaginationParams
from app.services import user_service

router = APIRouter()


@router.get("/me", response_model=UserRead)
def get_me(current_user=Depends(get_current_user)):
    return current_user


@router.put("/me", response_model=UserRead)
def update_me(user_in: UserUpdate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    return user_service.update_user(db, current_user, user_in)


@router.get("/{user_id}/profile", response_model=UserProfile)
def get_user_profile(user_id: int, db: Session = Depends(get_db)):
    user = user_service.get_user(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    from app.models import Follow, Post

    followers_count = db.query(Follow).filter(Follow.following_id == user_id).count()
    following_count = db.query(Follow).filter(Follow.follower_id == user_id).count()
    posts_count = db.query(Post).filter(Post.author_id == user_id).count()

    return UserProfile(
        id=user.id,
        username=user.username,
        email=user.email,
        date_of_birth=user.date_of_birth,
        is_admin=user.is_admin,
        created_at=user.created_at,
        followers_count=followers_count,
        following_count=following_count,
        posts_count=posts_count,
    )


@router.get("/{user_id}", response_model=UserRead)
def get_user(user_id: int, db: Session = Depends(get_db)):
    user = user_service.get_user(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.get("/", response_model=list[UserRead])
def list_users(db: Session = Depends(get_db), params: PaginationParams = Depends()):
    users = user_service.get_users(db, skip=params.skip, limit=params.limit)
    return users
