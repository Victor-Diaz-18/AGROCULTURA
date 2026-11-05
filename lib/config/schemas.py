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
    provisional: bool = False  # the point has not been confirmed with the families


class MotivoRechazo(BaseModel):
    id: str
    etiqueta: str
    texto: str


class TextoConsentimiento(BaseModel):
    texto: str
    aviso: str = ""


class Consentimiento(BaseModel):
    """The texts a narrator (or the team, for its own stories) accepts, one for every combination of name and place."""

    version: str
    narrador: dict[str, TextoConsentimiento]
    equipo: dict[str, TextoConsentimiento]


class ConfigPublica(BaseModel):
    """Everything the app needs to start, including to fill the story form offline."""

    portal: PortalPublico
    sectores: list[SectorPublico]
    etiquetas: list[str]
    epocas: list[str]
    motivos_rechazo: list[MotivoRechazo]
    consentimiento: Consentimiento
    voz_disponible: bool = False  # the server can read public content with the voice of the portal
