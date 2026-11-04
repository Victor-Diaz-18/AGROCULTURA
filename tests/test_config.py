def test_public_config_lists_the_catalog_in_display_order(client):
    response = client.get("/api/config")

    assert response.status_code == 200
    body = response.json()
    assert [s["nombre"] for s in body["sectores"]] == ["Minca", "La Tagua", "San Lorenzo", "Tijereras"]
    assert body["etiquetas"] == ["#café", "#finca", "#familia", "#cosecha", "#cocina", "#oficios"]
    assert body["epocas"] == ["Antes de 1960", "1960 a 1979", "1980 a 1999", "2000 en adelante"]
    assert [m["etiqueta"] for m in body["motivos_rechazo"]] == [
        "Fuera del tema",
        "Fuera del territorio",
        "Contenido incompleto",
        "Expone datos de otros",
    ]


def test_sector_centers_are_plain_latitude_and_longitude(client):
    minca = client.get("/api/config").json()["sectores"][0]

    assert minca["id"] == "minca"
    assert 10.5 < minca["centro"]["lat"] < 11.5  # Santa Marta / Sierra Nevada area
    assert -75 < minca["centro"]["lon"] < -73.5


def test_portal_options_come_from_the_database(client, db):
    db.configuracion.update_one({"_id": "portal"}, {"$set": {"nombre_portal": "Memoria Cafetera"}})

    portal = client.get("/api/config").json()["portal"]

    assert portal["nombre"] == "Memoria Cafetera"
    assert portal["avisar_rechazo"] is False  # still "por definir"
    assert portal["datos_de_ejemplo"] is True


def test_config_falls_back_to_defaults_without_a_portal_document(client, db):
    db.configuracion.delete_many({})

    portal = client.get("/api/config").json()["portal"]

    assert portal["nombre"] == "AGROCULTURA"
