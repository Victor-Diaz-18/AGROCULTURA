from pydantic import BaseModel


class PortalPublico(BaseModel):
    nombre: str
    avisar_rechazo: bool
    datos_de_ejemplo: bool
    reinicio_disponible: bool = False


class Centro(BaseModel):
    lat: float
    lon: float


class SectorPublico(BaseModel):
    id: str
    nombre: str
    centro: Centro


class MotivoRechazo(BaseModel):
    id: str
    etiqueta: str
    texto: str


class ConfigPublica(BaseModel):
    """Everything the app needs to start, including to fill the story form offline."""

    portal: PortalPublico
    sectores: list[SectorPublico]
    etiquetas: list[str]
    epocas: list[str]
    motivos_rechazo: list[MotivoRechazo]
