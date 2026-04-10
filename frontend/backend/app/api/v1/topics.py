from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import get_db
from app.schemas.topic import TopicRead
from app.models.topic import Topic

router = APIRouter()


@router.get("/", response_model=list[TopicRead])
def list_topics(db: Session = Depends(get_db)):
    topics = db.query(Topic).all()
    return topics
