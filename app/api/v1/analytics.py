from fastapi import APIRouter, Depends

from app.core.deps import get_current_admin_user
from app.core.deps import get_db
from app.models.user import User
from app.schemas.analytics import DemographicsResponse, PopularTopicsResponse
from app.services.analytics_service import get_demographics as _get_demographics
from app.services.analytics_service import get_popular_topics as _get_popular_topics
from app.schemas.pagination import PaginationParams

router = APIRouter()


@router.get("/demographics", response_model=DemographicsResponse)
def get_demographics(
    db=Depends(get_db),
    admin_user: User = Depends(get_current_admin_user),
):
    return _get_demographics(db)


@router.get("/popular-topics", response_model=PopularTopicsResponse)
def get_popular_topics(
    db=Depends(get_db),
    admin_user: User = Depends(get_current_admin_user),
    params: PaginationParams = Depends(),
):
    return _get_popular_topics(db, limit=params.limit)
