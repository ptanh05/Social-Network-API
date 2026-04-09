from fastapi import APIRouter

from app.api.v1 import (
    auth,
    users,
    posts,
    comments,
    likes,
    follows,
    topics,
    preferences,
    analytics,
)

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(posts.router, prefix="/posts", tags=["posts"])
api_router.include_router(comments.router, prefix="/posts", tags=["posts"])
api_router.include_router(likes.router, prefix="/likes", tags=["likes"])
api_router.include_router(follows.router, prefix="/follows", tags=["follows"])
api_router.include_router(topics.router, prefix="/topics", tags=["topics"])
api_router.include_router(preferences.router, prefix="/preferences", tags=["users"])
api_router.include_router(analytics.router, prefix="/analytics", tags=["analytics"])
