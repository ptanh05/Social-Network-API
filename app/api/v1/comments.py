from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.core.deps import get_db, get_current_user
from app.models.user import User
from app.models.post import Post
from app.models.comment import Comment
from app.models.user_activity import UserActivity
from app.schemas.comment import CommentCreate, CommentRead, CommentUpdate

router = APIRouter()


@router.post("/posts/{post_id}/comments/", response_model=CommentRead, status_code=status.HTTP_201_CREATED)
def create_comment(
    post_id: int,
    comment_in: CommentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Verify post exists
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
        metadata_json={"post_id": post_id, "comment_id": None},
    )
    db.add(activity)

    db.commit()
    db.refresh(comment)
    return comment


@router.get("/posts/{post_id}/comments/", response_model=list[CommentRead])
def list_comments(post_id: int, db: Session = Depends(get_db)):
    comments = (
        db.query(Comment)
        .options(joinedload(Comment.author))
        .filter(Comment.post_id == post_id)
        .order_by(Comment.created_at.asc())
        .all()
    )
    return comments


@router.put("/{comment_id}/", response_model=CommentRead)
def update_comment(
    comment_id: int,
    comment_in: CommentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    comment = db.query(Comment).filter(Comment.id == comment_id).first()
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    if comment.author_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized")
    comment.content = comment_in.content
    db.commit()
    db.refresh(comment)
    return comment


@router.delete("/{comment_id}/", status_code=status.HTTP_204_NO_CONTENT)
def delete_comment(
    comment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    comment = db.query(Comment).filter(Comment.id == comment_id).first()
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    if comment.author_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized")
    db.delete(comment)
    db.commit()
