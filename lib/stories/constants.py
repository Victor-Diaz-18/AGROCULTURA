"""Fixed vocabulary of the stories domain (mirrors the approved design)."""

EPOCAS = (
    "Antes de 1960",
    "1960 a 1979",
    "1980 a 1999",
    "2000 en adelante",
)

ESTADOS = ("borrador", "revision", "publicada", "rechazada")
ORIGENES = ("comunidad", "proyecto")
TIPOS_MEDIO = ("foto", "audio", "video")

# Rejection reasons the administrator can pick. `texto` is what the narrator
# reads in "Mis historias" and is stored with the story as a historical record.
MOTIVOS_RECHAZO = (
    {
        "id": "fuera-del-tema",
        "etiqueta": "Fuera del tema",
        "texto": "Fuera del tema: no trata de la cultura cafetera",
    },
    {
        "id": "fuera-del-territorio",
        "etiqueta": "Fuera del territorio",
        "texto": "Fuera del territorio: no ocurrió en Minca ni sectores aledaños",
    },
    {
        "id": "contenido-incompleto",
        "etiqueta": "Contenido incompleto",
        "texto": "Contenido incompleto o no se entiende",
    },
    {
        "id": "expone-datos",
        "etiqueta": "Expone datos de otros",
        "texto": "Expone datos personales de otras personas",
    },
)
