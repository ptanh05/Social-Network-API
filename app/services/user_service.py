from datetime import date, timedelta

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.user import User
from app.models.user_preference import UserPreference
from app.models.topic import Topic
from app.schemas.user import UserCreate, UserUpdate


def get_user(db: Session, user_id: int) -> User | None:
    return db.query(User).filter(User.id == user_id).first()


def get_user_by_username(db: Session, username: str) -> User | None:
    return db.query(User).filter(User.username == username).first()


def get_user_by_email(db: Session, email: str) -> User | None:
    return db.query(User).filter(User.email == email).first()


def get_users(db: Session, skip: int = 0, limit: int = 20) -> list[User]:
    return db.query(User).offset(skip).limit(limit).all()


def update_user(db: Session, user: User, data: UserUpdate) -> User:
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(user, field, value)
    db.commit()
    db.refresh(user)
    return user


def delete_user(db: Session, user_id: int) -> bool:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return False
    db.delete(user)
    db.commit()
    return True


def _calculate_age_group(dob_str: str | None) -> str:
    """Determine age group from YYYY-MM-DD string. Returns 'Unknown' if invalid."""
    if not dob_str:
        return "Unknown"
    try:
        parts = dob_str.split("-")
        if len(parts) != 3:
            return "Unknown"
        birth_date = date(int(parts[0]), int(parts[1]), int(parts[2]))
    except (ValueError, TypeError):
        return "Unknown"

    today = date.today()
    age = today.year - birth_date.year - ((today.month, today.day) < (birth_date.month, birth_date.day))

    if age < 18:
        return "Under 18"
    elif age < 25:
        return "18-24"
    elif age < 35:
        return "25-34"
    elif age < 45:
        return "35-44"
    elif age < 55:
        return "45-54"
    elif age < 65:
        return "55-64"
    else:
        return "65+"


def get_demographics(db: Session) -> dict:
    users = db.query(User).all()
    total = len(users)

    age_groups: dict[str, int] = {}
    for user in users:
        group = _calculate_age_group(user.date_of_birth)
        age_groups[group] = age_groups.get(group, 0) + 1

    if total == 0:
        return {"total_users": 0, "age_groups": []}

    from app.schemas.analytics import AgeGroupStats
    age_stats = [
        {
            "age_group": group,
            "count": count,
            "percentage": round(count / total * 100, 2),
        }
        for group, count in sorted(age_groups.items())
    ]
    return {"total_users": total, "age_groups": age_stats}


def get_popular_topics(db: Session, limit: int = 10) -> list[dict]:
    results = (
        db.query(Topic.id, Topic.name, func.count(UserPreference.user_id).label("user_count"))
        .join(UserPreference, UserPreference.topic_id == Topic.id, isouter=True)
        .group_by(Topic.id)
        .order_by(func.count(UserPreference.user_id).desc())
        .limit(limit)
        .all()
    )
    return [
        {"topic_id": r[0], "topic_name": r[1], "user_count": r[2]}
        for r in results
    ]
