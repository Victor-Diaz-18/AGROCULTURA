from pydantic import BaseModel, Field


class PortalCambios(BaseModel):
    """The options an administrator can change. What is not sent stays as it is."""

    nombre: str | None = Field(default=None, max_length=120)
    avisar_rechazo: bool | None = None
    datos_de_ejemplo: bool | None = None


class EtiquetaIn(BaseModel):
    nombre: str = Field(max_length=60)


class ReinicioIn(BaseModel):
    confirmar: bool = False


class ReinicioOut(BaseModel):
    historias_borradas: int
    historias_de_ejemplo: int
    archivos_borrados: int
