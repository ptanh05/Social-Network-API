from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.deps import get_db, get_current_user
from app.models.user import User
from app.models.topic import Topic
from app.models.user_preference import UserPreference
from app.schemas.topic import TopicRead
from app.schemas.preference import PreferenceUpdate, PreferenceWithTopics

router = APIRouter()


@router.get("/users/me/preferences", response_model=PreferenceWithTopics)
def get_preferences(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    prefs = db.query(UserPreference).filter(UserPreference.user_id == current_user.id).all()
    topic_ids = [p.topic_id for p in prefs]
    topics = db.query(Topic).filter(Topic.id.in_(topic_ids)).all()
    return PreferenceWithTopics(topics=[TopicRead.model_validate(t) for t in topics])


@router.put("/users/me/preferences", response_model=PreferenceWithTopics)
def update_preferences(
    pref_in: PreferenceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Validate topic IDs exist
    existing_topics = db.query(Topic).filter(Topic.id.in_(pref_in.topic_ids)).all()
    if len(existing_topics) != len(pref_in.topic_ids):
        raise HTTPException(status_code=400, detail="One or more topic IDs are invalid")

    # Delete existing preferences
    db.query(UserPreference).filter(UserPreference.user_id == current_user.id).delete()

    # Add new preferences
    for topic_id in pref_in.topic_ids:
        pref = UserPreference(user_id=current_user.id, topic_id=topic_id)
        db.add(pref)

    db.commit()

    topics = db.query(Topic).filter(Topic.id.in_(pref_in.topic_ids)).all()
    return PreferenceWithTopics(topics=[TopicRead.model_validate(t) for t in topics])
