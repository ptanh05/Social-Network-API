import pytest


def test_get_me(client, auth_headers):
    response = client.get("/api/v1/users/me", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["username"] == "testuser"
    assert data["email"] == "test@example.com"


def test_get_me_unauthorized(client):
    response = client.get("/api/v1/users/me")
    assert response.status_code == 401


def test_update_me(client, auth_headers):
    response = client.put(
        "/api/v1/users/me",
        headers=auth_headers,
        json={"username": "updateduser", "date_of_birth": "1995-05-15"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["username"] == "updateduser"
    assert data["date_of_birth"] == "1995-05-15"


def test_get_user_by_id(client, auth_headers, test_user):
    response = client.get(f"/api/v1/users/{test_user['id']}")
    assert response.status_code == 200
    assert response.json()["username"] == "testuser"


def test_get_user_not_found(client, auth_headers):
    response = client.get("/api/v1/users/99999")
    assert response.status_code == 404


def test_list_users(client, auth_headers, test_user):
    response = client.get("/api/v1/users/", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 1


def test_health(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
