from pydantic import BaseModel


class PorOrigen(BaseModel):
    comunidad: int
    proyecto: int


class PorFormato(BaseModel):
    foto: int
    audio: int
    video: int


class Estadisticas(BaseModel):
    """Counters for the header, the map cards and the admin summary."""

    publicadas: int
    en_revision: int
    rechazadas: int
    aprobadas_comunidad: int
    por_origen: PorOrigen
    sectores_con_historias: int
    total_sectores: int
    formatos: PorFormato
