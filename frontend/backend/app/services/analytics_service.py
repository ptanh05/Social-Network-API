from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.user import User
from app.models.topic import Topic
from app.models.user_preference import UserPreference
from app.schemas.analytics import DemographicsResponse, PopularTopicsResponse, AgeGroupStats, TopicStats


def _calculate_age_group(dob_str: str | None) -> str:
    if not dob_str:
        return "Unknown"
    try:
        parts = dob_str.split("-")
        if len(parts) != 3:
            return "Unknown"
        from datetime import date
        birth_date = date(int(parts[0]), int(parts[1]), int(parts[2]))
    except (ValueError, TypeError, IndexError):
        return "Unknown"

    from datetime import date
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


def get_demographics(db: Session) -> DemographicsResponse:
    users = db.query(User).all()
    total = len(users)

    age_groups: dict[str, int] = {}
    for user in users:
        group = _calculate_age_group(user.date_of_birth)
        age_groups[group] = age_groups.get(group, 0) + 1

    if total == 0:
        return DemographicsResponse(total_users=0, age_groups=[])

    age_stats = [
        AgeGroupStats(
            age_group=group,
            count=count,
            percentage=round(count / total * 100, 2),
        )
        for group, count in sorted(age_groups.items())
    ]
    return DemographicsResponse(total_users=total, age_groups=age_stats)


def get_popular_topics(db: Session, limit: int = 10) -> PopularTopicsResponse:
    results = (
        db.query(
            Topic.id.label("topic_id"),
            Topic.name.label("topic_name"),
            func.count(UserPreference.user_id).label("user_count"),
        )
        .outerjoin(UserPreference, UserPreference.topic_id == Topic.id)
        .group_by(Topic.id)
        .order_by(func.count(UserPreference.user_id).desc())
        .limit(limit)
        .all()
    )
    topics = [
        TopicStats(topic_id=r.topic_id, topic_name=r.topic_name, user_count=r.user_count)
        for r in results
    ]
    return PopularTopicsResponse(topics=topics)
