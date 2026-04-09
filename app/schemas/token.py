from pydantic import BaseModel


class TokenPayload(BaseModel):
    sub: int  # user id


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
