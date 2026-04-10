import pytest


def test_create_post(client, auth_headers):
    response = client.post(
        "/api/v1/posts/",
        headers=auth_headers,
        json={"content": "Hello world!", "topic_ids": []},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["content"] == "Hello world!"
    assert data["author"]["username"] == "testuser"
    assert "id" in data


def test_create_post_unauthorized(client):
    response = client.post(
        "/api/v1/posts/",
        json={"content": "Hello world!"},
    )
    assert response.status_code == 401


def test_get_post(client, auth_headers, test_user):
    create_resp = client.post(
        "/api/v1/posts/",
        headers=auth_headers,
        json={"content": "My first post"},
    )
    post_id = create_resp.json()["id"]

    response = client.get(f"/api/v1/posts/{post_id}")
    assert response.status_code == 200
    assert response.json()["content"] == "My first post"


def test_update_post(client, auth_headers):
    create_resp = client.post(
        "/api/v1/posts/",
        headers=auth_headers,
        json={"content": "Original content"},
    )
    post_id = create_resp.json()["id"]

    response = client.put(
        f"/api/v1/posts/{post_id}",
        headers=auth_headers,
        json={"content": "Updated content"},
    )
    assert response.status_code == 200
    assert response.json()["content"] == "Updated content"


def test_delete_post(client, auth_headers):
    create_resp = client.post(
        "/api/v1/posts/",
        headers=auth_headers,
        json={"content": "To be deleted"},
    )
    post_id = create_resp.json()["id"]

    response = client.delete(f"/api/v1/posts/{post_id}", headers=auth_headers)
    assert response.status_code == 204

    get_resp = client.get(f"/api/v1/posts/{post_id}")
    assert get_resp.status_code == 404


def test_like_post(client, auth_headers):
    create_resp = client.post(
        "/api/v1/posts/",
        headers=auth_headers,
        json={"content": "Post to like"},
    )
    post_id = create_resp.json()["id"]

    response = client.post(f"/api/v1/likes/posts/{post_id}/like/", headers=auth_headers)
    assert response.status_code == 201
    assert response.json()["liked"] is True


def test_unlike_post(client, auth_headers):
    create_resp = client.post(
        "/api/v1/posts/",
        headers=auth_headers,
        json={"content": "Post to unlike"},
    )
    post_id = create_resp.json()["id"]

    client.post(f"/api/v1/likes/posts/{post_id}/like/", headers=auth_headers)
    response = client.delete(f"/api/v1/likes/posts/{post_id}/like/", headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["liked"] is False


def test_follow_user(client, auth_headers, second_user):
    response = client.post(
        f"/api/v1/follows/users/{second_user['id']}/follow/",
        headers=auth_headers,
    )
    assert response.status_code == 201
    assert response.json()["following"] is True


def test_unfollow_user(client, auth_headers, second_user):
    client.post(f"/api/v1/follows/users/{second_user['id']}/follow/", headers=auth_headers)
    response = client.delete(
        f"/api/v1/follows/users/{second_user['id']}/follow/",
        headers=auth_headers,
    )
    assert response.status_code == 200
    assert response.json()["following"] is False


def test_follow_self_fails(client, auth_headers, test_user):
    response = client.post(
        f"/api/v1/follows/users/{test_user['id']}/follow/",
        headers=auth_headers,
    )
    assert response.status_code == 400
    assert "Cannot follow yourself" in response.json()["detail"]


def test_create_comment(client, auth_headers):
    post_resp = client.post(
        "/api/v1/posts/",
        headers=auth_headers,
        json={"content": "Post for comments"},
    )
    post_id = post_resp.json()["id"]

    response = client.post(
        f"/api/v1/comments/posts/{post_id}/comments/",
        headers=auth_headers,
        json={"content": "This is a comment"},
    )
    assert response.status_code == 201
    assert response.json()["content"] == "This is a comment"


def test_feed(client, auth_headers):
    client.post(
        "/api/v1/posts/",
        headers=auth_headers,
        json={"content": "Feed post 1"},
    )
    response = client.get("/api/v1/posts/feed", headers=auth_headers)
    assert response.status_code == 200
    assert isinstance(response.json(), list)


def test_topics_list(client, auth_headers):
    response = client.get("/api/v1/topics/")
    assert response.status_code == 200
    assert isinstance(response.json(), list)
