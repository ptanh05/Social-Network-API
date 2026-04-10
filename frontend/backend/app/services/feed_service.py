from sqlalchemy import or_, and_, func
from sqlalchemy.orm import Session, joinedload

from app.models.post import Post
from app.models.post_tag import PostTag
from app.models.follow import Follow
from app.models.user_preference import UserPreference
from app.models.like import Like
from app.models.comment import Comment
from app.schemas.post import PostWithFeedScore


def get_feed(db: Session, user_id: int, skip: int = 0, limit: int = 20) -> list[PostWithFeedScore]:
    """
    Smart Feed Algorithm:
    1. Get user's preferred topic_ids
    2. Get list of user_ids the current user follows
    3. Query posts:
       - Posts matching preferred topics OR from following users → higher score
       - Score = (is_preferred_topic ? 2 : 0) + (is_from_following ? 1 : 0)
    4. Sort by score desc, then created_at desc
    """

    # Step 1: Get preferred topic IDs
    preferred_topic_ids = [
        row[0]
        for row in db.query(UserPreference.topic_id)
        .filter(UserPreference.user_id == user_id)
        .all()
    ]

    # Step 2: Get following user IDs
    following_ids = [
        row[0]
        for row in db.query(Follow.following_id)
        .filter(Follow.follower_id == user_id)
        .all()
    ]

    # Also include own posts
    all_relevant_author_ids = set(following_ids + [user_id])

    # Step 3: Build query
    if not preferred_topic_ids and not following_ids:
        # No preferences or follows — return recent posts
        posts = (
            db.query(Post)
            .options(
                joinedload(Post.author),
                joinedload(Post.tags).joinedload(PostTag.topic),
            )
            .order_by(Post.created_at.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )
        return [PostWithFeedScore.model_validate(p) for p in posts]

    # Query posts with tags joined
    posts_query = (
        db.query(Post)
        .options(
            joinedload(Post.author),
            joinedload(Post.tags).joinedload(PostTag.topic),
            joinedload(Post.likes),
            joinedload(Post.comments),
        )
    )

    # Apply filter: post must be from following users OR have preferred topics
    if preferred_topic_ids and following_ids:
        # Subquery: post_ids that have preferred topics
        preferred_post_ids = [
            row[0]
            for row in db.query(PostTag.post_id)
            .filter(PostTag.topic_id.in_(preferred_topic_ids))
            .distinct()
            .all()
        ]
        posts_query = posts_query.filter(
            or_(
                Post.author_id.in_(all_relevant_author_ids),
                Post.id.in_(preferred_post_ids),
            )
        )
    elif preferred_topic_ids:
        preferred_post_ids = [
            row[0]
            for row in db.query(PostTag.post_id)
            .filter(PostTag.topic_id.in_(preferred_topic_ids))
            .distinct()
            .all()
        ]
        posts_query = posts_query.filter(Post.id.in_(preferred_post_ids))
    elif following_ids:
        posts_query = posts_query.filter(Post.author_id.in_(all_relevant_author_ids))

    posts = posts_query.order_by(Post.created_at.desc()).all()

    # Step 4: Score and sort
    scored_posts: list[tuple[int, Post]] = []
    for post in posts:
        score = 0
        if post.author_id in following_ids:
            score += 1
        post_topic_ids = {tag.topic_id for tag in post.tags}
        if post_topic_ids & set(preferred_topic_ids):
            score += 2
        scored_posts.append((score, post))

    # Sort by score desc, then by created_at desc
    scored_posts.sort(key=lambda x: (-x[0], -x[1].created_at.timestamp()))

    # Apply skip/limit after scoring
    paged = scored_posts[skip : skip + limit]

    return [
        PostWithFeedScore(
            **{k: v for k, v in PostWithFeedScore.model_validate(p[1]).model_dump().items() if k != "feed_score"},
            feed_score=p[0],
        )
        for p in paged
    ]
