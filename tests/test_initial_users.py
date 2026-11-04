"""The administrator and the optional demo narrator come from environment variables."""

from dataclasses import replace

from lib.auth.service import ensure_admin, ensure_demo_narrator, ensure_initial_users
from lib.core.security import verify_secret


def test_the_administrator_is_created_from_the_environment(db, settings):
    assert ensure_admin(db, settings) == "creado"

    admin = db.usuarios.find_one({"usuario": settings.admin_user})
    assert admin["rol"] == "administrador"
    assert admin["clave_hash"].startswith("$2")
    assert settings.admin_password not in str(admin)


def test_the_administrator_signs_in_with_user_and_password(client, admin, settings):
    assert admin["usuario"]["rol"] == "administrador"
    assert admin["usuario"]["nombre"] == "Administración"

    wrong = client.post(
        "/api/auth/ingreso", json={"rol": "administrador", "usuario": settings.admin_user, "clave": "no-es-esa-clave"}
    )
    assert wrong.status_code == 401


def test_the_user_name_is_not_case_sensitive(client, db, settings):
    ensure_admin(db, settings)

    response = client.post(
        "/api/auth/ingreso",
        json={"rol": "administrador", "usuario": f"  {settings.admin_user.upper()} ", "clave": settings.admin_password},
    )

    assert response.status_code == 200


def test_running_it_again_changes_nothing(db, settings):
    ensure_admin(db, settings)

    assert ensure_admin(db, settings) == "sin_cambios"
    assert db.usuarios.count_documents({"rol": "administrador"}) == 1


def test_changing_admin_password_in_the_environment_updates_the_administrator(client, db, settings):
    ensure_admin(db, settings)

    renewed = replace(settings, admin_password="otra-clave-mas-larga-9876")
    assert ensure_admin(db, renewed) == "actualizado"

    sign_in = lambda clave: client.post(  # noqa: E731
        "/api/auth/ingreso", json={"rol": "administrador", "usuario": settings.admin_user, "clave": clave}
    )
    assert sign_in("otra-clave-mas-larga-9876").status_code == 200
    assert sign_in(settings.admin_password).status_code == 401


def test_a_short_administrator_password_is_refused_and_nobody_is_created(db, settings):
    weak = replace(settings, admin_password="corta")

    assert ensure_admin(db, weak) == "omitido"
    assert db.usuarios.count_documents({}) == 0


def test_without_the_variables_no_administrator_is_created(db, settings):
    assert ensure_admin(db, replace(settings, admin_user=None)) == "omitido"
    assert ensure_admin(db, replace(settings, admin_password=None)) == "omitido"
    assert db.usuarios.count_documents({}) == 0


def test_an_administrator_name_that_looks_like_a_phone_is_refused(db, settings):
    assert ensure_admin(db, replace(settings, admin_user="300 555 0192")) == "omitido"


def test_the_administrator_never_takes_over_an_existing_account_that_is_not_an_administrator(db, settings):
    from lib.auth.constants import ROL_NARRADOR

    db.usuarios.insert_one({"usuario": "equipo", "rol": ROL_NARRADOR, "nombre": "Alguien", "clave_hash": "x", "activo": True})

    assert ensure_admin(db, replace(settings, admin_user="equipo")) == "omitido"
    assert db.usuarios.find_one({"usuario": "equipo"})["rol"] == ROL_NARRADOR


def test_the_demo_narrator_is_created_only_when_configured(db, settings):
    assert ensure_demo_narrator(db, settings) == "omitido"

    configured = replace(settings, demo_narrator_phone="310 555 0101", demo_narrator_pin="2468")
    assert ensure_demo_narrator(db, configured) == "creado"

    demo = db.usuarios.find_one({"usuario": "3105550101"})
    assert demo["nombre"] == "Ana Beltrán" and demo["rol"] == "narrador"
    assert verify_secret("2468", demo["clave_hash"])


def test_the_demo_narrator_is_never_modified_once_it_exists(db, settings):
    first = replace(settings, demo_narrator_phone="3105550101", demo_narrator_pin="2468")
    ensure_demo_narrator(db, first)

    changed = replace(first, demo_narrator_pin="9999")
    assert ensure_demo_narrator(db, changed) == "sin_cambios"
    assert verify_secret("2468", db.usuarios.find_one({"usuario": "3105550101"})["clave_hash"])


def test_invalid_demo_narrator_settings_are_ignored(db, settings):
    bad = replace(settings, demo_narrator_phone="123", demo_narrator_pin="2468")

    assert ensure_demo_narrator(db, bad) == "omitido"


def test_initial_users_reports_each_step(db, settings):
    assert ensure_initial_users(db, settings) == {"administrador": "creado", "narradora_de_ejemplo": "omitido"}


def test_two_instances_starting_together_do_not_fail_creating_the_administrator(db, settings, monkeypatch):
    """The home page asks for two endpoints at once, so two cold instances can race to create the admin."""
    from lib.auth import service

    ensure_admin(db, settings)  # the other instance got there first...
    monkeypatch.setattr(service.repository, "find_by_usuario", lambda *_a, **_k: None)  # ...but this one saw nothing

    assert ensure_admin(db, settings) == "sin_cambios"  # no DuplicateKeyError
    assert db.usuarios.count_documents({"rol": "administrador"}) == 1


def test_two_instances_starting_together_do_not_fail_creating_the_demo_narrator(db, settings, monkeypatch):
    from lib.auth import service

    configured = replace(settings, demo_narrator_phone="3105550101", demo_narrator_pin="2468")
    ensure_demo_narrator(db, configured)
    monkeypatch.setattr(service.repository, "find_by_usuario", lambda *_a, **_k: None)

    assert ensure_demo_narrator(db, configured) == "sin_cambios"
    assert db.usuarios.count_documents({"usuario": "3105550101"}) == 1
