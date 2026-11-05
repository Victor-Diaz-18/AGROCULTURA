"""Fixed vocabulary of the stories domain (mirrors the approved design)."""

EPOCAS = (
    "Antes de 1960",
    "1960 a 1979",
    "1980 a 1999",
    "2000 en adelante",
)

ESTADOS = ("borrador", "revision", "publicada", "rechazada")

# Where a story is shown (the narrator chooses, in "¿Dónde ocurrió?"):
#  - "aproximada": a point on the map, always rounded to about 500 m for the public (see privacy.py);
#  - "ninguna": no point and no icon on the map. The story is still published (list, search, card), and the name of the
#    place the narrator writes as a reference is for the administrators only.
UBICACION_MODOS = ("aproximada", "ninguna")

# What the public reads in the place of the name of a narrator who asked to be published without it.
NARRADOR_ANONIMO = "Narrador anónimo"
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
        # The id is kept (stories rejected before keep the text they were given). Sectors are only names of reference: this is
        # about the story having something to do with the coffee zone of Minca and its surroundings, not about a boundary.
        "id": "fuera-del-territorio",
        "etiqueta": "Sin relación con la zona",
        "texto": "Sin relación con la zona cafetera de Minca y sus alrededores",
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
    {
        "id": "falta-autorizacion",
        "etiqueta": "Falta la autorización",
        "texto": "Falta la autorización del narrador para publicarla",
    },
)

# What the administrator confirms before approving a story (the three checks of the design).
# The server asks for all of them, so an approval cannot skip the review even by calling the API directly.
# "territorio" is "se relaciona con la zona cafetera de Minca y sus alrededores": the sectors are names of reference, not a
# boundary, and nothing here decides that a story is "inside" or "outside".
COMPROBACIONES = ("tema", "territorio", "datos")
# "El narrador dio su consentimiento": also asked once the authorization is demanded (see consent.EXIGIR_CONSENTIMIENTO).
COMPROBACION_CONSENTIMIENTO = "consentimiento"

# Who "tells" a story the team uploads when nobody else is named.
NARRADOR_PROYECTO = "Equipo AGROCULTURA"
