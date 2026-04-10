from sqlalchemy.orm import Session

from app.core.security import create_access_token, get_password_hash, verify_password
from app.models.user import User
from app.schemas.token import TokenResponse


def authenticate_user(db: Session, username: str, password: str) -> User | None:
    user = db.query(User).filter(User.username == username).first()
    if not user:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    return user


def create_user_token(user: User) -> TokenResponse:
    access_token = create_access_token(data={"sub": str(user.id)})
    return TokenResponse(access_token=access_token)


def register_user(db: Session, username: str, email: str, password: str, date_of_birth: str | None = None) -> User:
    hashed = get_password_hash(password)
    user = User(
        username=username,
        email=email,
        hashed_password=hashed,
        date_of_birth=date_of_birth,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user
