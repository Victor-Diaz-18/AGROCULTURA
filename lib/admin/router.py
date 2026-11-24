"""Administration (F6, F7, F12). EVERY route here requires an administrator: the router itself carries the guard."""

from fastapi import APIRouter, Depends, Query, Response
from pymongo.database import Database

from lib.admin.schemas import EtiquetaIn, PortalCambios
from lib.auth import admins, narrators
from lib.auth.deps import require_admin, require_main_admin, require_main_admin_for_trash, require_main_admin_to_delete
from lib.auth.schemas import AdminNuevoIn, AdminOut, ClaveNuevaIn, NarradorOut
from lib.catalog import service as catalog
from lib.config import service as config
from lib.config.schemas import PortalPublico
from lib.core.db import get_db
from lib.core.settings import Settings, get_settings
from lib.media.storage import Storage, get_storage
from lib.stories import review
from lib.stories.schemas import AprobarIn, CorreccionIn, HistoriaAdmin, HistoriaPapelera, HistoriaProyectoIn, RechazarIn

router = APIRouter(prefix="/admin", tags=["administración"], dependencies=[Depends(require_admin)])


# ---- reviewing stories (F6) ----------------------------------------------------


@router.get("/historias", response_model=list[HistoriaAdmin])
def list_stories(
    estado: str | None = None,
    origen: str | None = None,
    limite: int = Query(100, ge=1, le=200),
    db: Database = Depends(get_db),
):
    """Stories with all their content. The review queue (`estado=revision`) comes oldest first."""
    return review.list_stories(db, estado=estado, origen=origen, limit=limite)


@router.post("/historias/{codigo}/aprobar", response_model=HistoriaAdmin)
def approve(codigo: str, body: AprobarIn, admin: dict = Depends(require_admin), db: Database = Depends(get_db)):
    """Publishes a story waiting for review. The three checks must be confirmed."""
    return review.approve(db, codigo, admin=admin, confirmed=body.confirmaciones)


@router.post("/historias/{codigo}/rechazar", response_model=HistoriaAdmin)
def reject(codigo: str, body: RechazarIn, admin: dict = Depends(require_admin), db: Database = Depends(get_db)):
    """Rejects a story waiting for review. The reason is required: the narrator reads it in "Mis historias"."""
    return review.reject(db, codigo, admin=admin, reason_id=body.motivo)


@router.patch("/historias/{codigo}", response_model=HistoriaAdmin)
def correct_story(codigo: str, body: CorreccionIn, admin: dict = Depends(require_admin), db: Database = Depends(get_db)):
    """Corrects the title and the text of a story waiting for review. What the narrator wrote is kept for the team."""
    return review.correct(db, codigo, admin=admin, data=body)


@router.delete("/historias/{codigo}", status_code=204)
def delete_story(
    codigo: str,
    admin: dict = Depends(require_main_admin_to_delete),
    db: Database = Depends(get_db),
    storage: Storage = Depends(get_storage),
):
    """Sends a published story to the trash: it leaves the map at once, and it can be restored for 30 days. Only the main
    administrator, and only published stories: the queue is decided by approving or rejecting."""
    review.move_to_trash(db, codigo, admin=admin, delete_files=storage.delete)
    return Response(status_code=204)


# ---- the trash (only the main administrator) -----------------------------------


@router.get("/papelera", response_model=list[HistoriaPapelera], dependencies=[Depends(require_main_admin_for_trash)])
def list_trash(db: Database = Depends(get_db), storage: Storage = Depends(get_storage)):
    """The deleted stories that can still be restored, the last one first. The ones whose 30 days passed go for good."""
    return review.list_trash(db, delete_files=storage.delete)


@router.post(
    "/papelera/{codigo}/recuperar",
    response_model=HistoriaAdmin,
    dependencies=[Depends(require_main_admin_for_trash)],
)
def restore_story(codigo: str, db: Database = Depends(get_db)):
    """Publishes the story again as it was: back on the map and in its narrator's «Mis historias»."""
    return review.restore(db, codigo)


@router.delete("/papelera/{codigo}", status_code=204, dependencies=[Depends(require_main_admin_to_delete)])
def delete_story_forever(codigo: str, db: Database = Depends(get_db), storage: Storage = Depends(get_storage)):
    """Deletes a story of the trash for good, with its photos, audio and video. It cannot be undone."""
    review.delete_forever(db, codigo, delete_files=storage.delete)
    return Response(status_code=204)


# ---- the team's own stories (F12) ----------------------------------------------


@router.post("/historias-proyecto", response_model=HistoriaAdmin, status_code=201)
def create_project_story(
    body: HistoriaProyectoIn,
    response: Response,
    admin: dict = Depends(require_admin),
    db: Database = Depends(get_db),
):
    """Publishes a story of the team at once. Sending the same `client_id` again does not duplicate it."""
    story, created = review.create_project_story(db, admin=admin, data=body)
    if not created:
        response.status_code = 200
    return story


# ---- administrators (only the main one, the one from ADMIN_USER, manages them) ----


@router.get("/administradores", response_model=list[AdminOut], dependencies=[Depends(require_main_admin)])
def list_admins(db: Database = Depends(get_db), settings: Settings = Depends(get_settings)):
    """Every administrator, active or not, with who created each one and when."""
    return admins.list_admins(db, settings)


@router.post("/administradores", response_model=AdminOut, status_code=201)
def create_admin(
    body: AdminNuevoIn,
    admin: dict = Depends(require_main_admin),
    db: Database = Depends(get_db),
    settings: Settings = Depends(get_settings),
):
    """Creates another administrator (password of 10 or more characters). Records who created it."""
    return admins.create_admin(db, settings, creator=admin, usuario=body.usuario, nombre=body.nombre, clave=body.clave)


@router.post("/administradores/{user_id}/desactivar", response_model=AdminOut)
def deactivate_admin(
    user_id: str,
    admin: dict = Depends(require_main_admin),
    db: Database = Depends(get_db),
    settings: Settings = Depends(get_settings),
):
    """Deactivates an administrator: their session stops working at once. The main one cannot be deactivated."""
    return admins.deactivate_admin(db, settings, actor=admin, user_id=user_id)


@router.post("/administradores/{user_id}/reactivar", response_model=AdminOut, dependencies=[Depends(require_main_admin)])
def reactivate_admin(user_id: str, db: Database = Depends(get_db), settings: Settings = Depends(get_settings)):
    """Lets a deactivated administrator sign in again."""
    return admins.reactivate_admin(db, settings, user_id=user_id)


# ---- narrators (any administrator helps a family that forgot its password) -------


@router.get("/narradores", response_model=list[NarradorOut])
def list_narrators(db: Database = Depends(get_db)):
    """Every narrator account, by name, with how many stories each one sent. Never their password."""
    return narrators.list_narrators(db)


@router.post("/narradores/{user_id}/clave", response_model=NarradorOut)
def reset_narrator_password(
    user_id: str,
    body: ClaveNuevaIn,
    admin: dict = Depends(require_admin),
    db: Database = Depends(get_db),
    settings: Settings = Depends(get_settings),
):
    """Gives a narrator the password the administrator wrote. Their open sessions close; it records who did it."""
    return narrators.reset_password(db, settings, actor=admin, user_id=user_id, clave=body.clave)


# ---- portal options (F7) -------------------------------------------------------


@router.patch("/portal", response_model=PortalPublico)
def update_portal(body: PortalCambios, db: Database = Depends(get_db), settings: Settings = Depends(get_settings)):
    """Portal name, "avisar al narrador si se rechaza" and the "datos de ejemplo" label."""
    return config.update_portal(
        db,
        settings,
        nombre=body.nombre,
        avisar_rechazo=body.avisar_rechazo,
        datos_de_ejemplo=body.datos_de_ejemplo,
    )


@router.post("/etiquetas", response_model=list[str], status_code=201)
def add_tag(body: EtiquetaIn, db: Database = Depends(get_db)):
    """Adds a tag narrators can choose. Returns the full list."""
    return catalog.add_tag(db, body.nombre)


@router.delete("/etiquetas", response_model=list[str])
def remove_tag(nombre: str = Query(..., max_length=60), db: Database = Depends(get_db)):
    """Removes a tag from the choices (stories that already have it keep it). Returns the full list."""
    return catalog.remove_tag(db, nombre)
