import pytest


def test_register_success(client):
    response = client.post(
        "/api/v1/auth/register",
        json={
            "username": "newuser",
            "email": "new@example.com",
            "password": "password123",
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["username"] == "newuser"
    assert data["email"] == "new@example.com"
    assert "id" in data
    assert "hashed_password" not in data


def test_register_duplicate_username(client):
    client.post(
        "/api/v1/auth/register",
        json={"username": "dupuser", "email": "dup1@example.com", "password": "pass123"},
    )
    response = client.post(
        "/api/v1/auth/register",
        json={"username": "dupuser", "email": "dup2@example.com", "password": "pass123"},
    )
    assert response.status_code == 400
    assert "Username already registered" in response.json()["detail"]


def test_register_duplicate_email(client):
    client.post(
        "/api/v1/auth/register",
        json={"username": "user1", "email": "same@example.com", "password": "pass123"},
    )
    response = client.post(
        "/api/v1/auth/register",
        json={"username": "user2", "email": "same@example.com", "password": "pass123"},
    )
    assert response.status_code == 400
    assert "Email already registered" in response.json()["detail"]


def test_login_success(client, test_user):
    response = client.post(
        "/api/v1/auth/login",
        data={"username": "testuser", "password": "testpass123"},
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"


def test_login_wrong_password(client, test_user):
    response = client.post(
        "/api/v1/auth/login",
        data={"username": "testuser", "password": "wrongpassword"},
    )
    assert response.status_code == 401


def test_login_nonexistent_user(client):
    response = client.post(
        "/api/v1/auth/login",
        data={"username": "nobody", "password": "anypassword"},
    )
    assert response.status_code == 401
