from typing import Any, Literal

from pydantic import BaseModel, Field


FavoriteType = Literal["report", "news"]


class FavoriteCreate(BaseModel):
    item_type: FavoriteType
    item_id: str = Field(..., min_length=1, max_length=128)
    title: str = Field(..., min_length=1, max_length=300)
    payload: dict[str, Any] = Field(default_factory=dict)


class FavoriteItem(BaseModel):
    id: str
    user_id: str
    item_type: FavoriteType
    item_id: str
    title: str
    payload: dict[str, Any] = Field(default_factory=dict)
    created_at: str

