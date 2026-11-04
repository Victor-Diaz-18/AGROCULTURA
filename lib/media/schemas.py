from pydantic import BaseModel


class MedioOut(BaseModel):
    tipo: str
    url: str
    mime: str
    bytes: int
    duracion_s: int | None = None
