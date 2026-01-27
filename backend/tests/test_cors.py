"""CORS cross-origin request tests."""

import pytest
from rest_framework.test import APIClient


class TestCORSHeaders:
    """Tests for CORS response headers."""

    @pytest.fixture
    def api_client(self) -> APIClient:
        """DRF API test client."""
        return APIClient()

    @pytest.mark.django_db
    def test_cors_preflight_request(self, api_client: APIClient):
        """Test CORS preflight OPTIONS request."""
        response = api_client.options(
            "/api/game/sessions",
            HTTP_ORIGIN="http://localhost:8080",
            HTTP_ACCESS_CONTROL_REQUEST_METHOD="POST",
        )

        assert response.status_code == 200
        assert response.get("Access-Control-Allow-Origin") == "http://localhost:8080"
        assert "POST" in response.get("Access-Control-Allow-Methods", "")

    @pytest.mark.django_db
    def test_post_without_csrf_token(self, api_client: APIClient):
        """Test POST request works without CSRF token."""
        response = api_client.post(
            "/api/game/sessions",
            HTTP_ORIGIN="http://localhost:8080",
        )

        assert response.status_code == 200
        assert "sessionId" in response.json()

    @pytest.mark.django_db
    def test_cors_allowed_origin(self, api_client: APIClient):
        """Test allowed origin receives CORS headers."""
        response = api_client.post(
            "/api/game/sessions",
            HTTP_ORIGIN="http://localhost:8080",
        )

        assert response.status_code == 200
        assert response.get("Access-Control-Allow-Origin") == "http://localhost:8080"

    @pytest.mark.django_db
    def test_cors_127_0_0_1_origin(self, api_client: APIClient):
        """Test 127.0.0.1:8080 is also an allowed origin."""
        response = api_client.post(
            "/api/game/sessions",
            HTTP_ORIGIN="http://127.0.0.1:8080",
        )

        assert response.status_code == 200
        assert response.get("Access-Control-Allow-Origin") == "http://127.0.0.1:8080"

    @pytest.mark.django_db
    def test_cors_credentials_header(self, api_client: APIClient):
        """Test Access-Control-Allow-Credentials header is present."""
        response = api_client.post(
            "/api/game/sessions",
            HTTP_ORIGIN="http://localhost:8080",
        )

        assert response.get("Access-Control-Allow-Credentials") == "true"

    @pytest.mark.django_db
    def test_cors_disallowed_origin(self, api_client: APIClient):
        """Test disallowed origin does not receive CORS headers."""
        response = api_client.post(
            "/api/game/sessions",
            HTTP_ORIGIN="http://malicious-site.com",
        )

        assert response.get("Access-Control-Allow-Origin") is None
