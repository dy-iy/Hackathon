from pydantic import BaseModel, Field


class AuthUser(BaseModel):
    id: str
    username: str
    display_name: str
    created_at: str


class AuthCredentials(BaseModel):
    username: str = Field(..., min_length=3, max_length=32)
    password: str = Field(..., min_length=6, max_length=128)


class AuthResponse(BaseModel):
    status: str = "success"
    message: str
    user: AuthUser

