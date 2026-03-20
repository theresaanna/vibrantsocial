"""Tests for the moderation service API and logging.

Mocks the heavy ML dependencies (transformers, detoxify, torch) so tests
run without GPU libraries installed.
"""

import logging
import sys
from unittest.mock import MagicMock

import pytest

# Mock heavy ML modules before importing main
sys.modules["transformers"] = MagicMock()
sys.modules["detoxify"] = MagicMock()
sys.modules["torch"] = MagicMock()

import main  # noqa: E402
from main import app  # noqa: E402

from fastapi.testclient import TestClient  # noqa: E402

API_KEY = "test-key"


@pytest.fixture(autouse=True)
def setup_api_key():
    """Set the API key for all tests."""
    original = main.MODERATION_API_KEY
    main.MODERATION_API_KEY = API_KEY
    yield
    main.MODERATION_API_KEY = original


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def headers():
    return {"X-API-Key": API_KEY}


# ── Image scan tests ──────────────────────────────────────────────


class TestImageScan:
    def _setup_image_mocks(self):
        main.nsfw_classifier = MagicMock()
        mock_resp = MagicMock()
        mock_resp.content = b"\x89PNG\r\n\x1a\n" + b"\x00" * 100
        mock_resp.raise_for_status = MagicMock()
        main.requests.get = MagicMock(return_value=mock_resp)
        mock_image = MagicMock()
        mock_image.convert.return_value = MagicMock()
        main.Image.open = MagicMock(return_value=mock_image)
        return main.nsfw_classifier

    def test_nsfw_detected_logs(self, client, headers, caplog):
        """NSFW detection should log with image URL and score."""
        classifier = self._setup_image_mocks()
        classifier.return_value = [{"label": "nsfw", "score": 0.95}]

        with caplog.at_level(logging.INFO, logger="moderation"):
            resp = client.post(
                "/scan/image",
                json={"url": "https://example.com/image.jpg"},
                headers=headers,
            )

        assert resp.status_code == 200
        data = resp.json()
        assert data["nsfw"] is True
        assert data["score"] == 0.95
        assert any("NSFW detected" in r.message for r in caplog.records)
        assert any("example.com/image.jpg" in r.message for r in caplog.records)

    def test_normal_image_no_nsfw_log(self, client, headers, caplog):
        """Normal images should not produce NSFW log entries."""
        classifier = self._setup_image_mocks()
        classifier.return_value = [{"label": "nsfw", "score": 0.1}]

        with caplog.at_level(logging.INFO, logger="moderation"):
            resp = client.post(
                "/scan/image",
                json={"url": "https://example.com/safe.jpg"},
                headers=headers,
            )

        assert resp.status_code == 200
        assert resp.json()["nsfw"] is False
        assert not any("NSFW detected" in r.message for r in caplog.records)


# ── Text scan tests ───────────────────────────────────────────────


class TestTextScan:
    # Keys as returned by the Detoxify "original" model
    ORIGINAL_KEYS = {
        "toxicity": 0.01,
        "severe_toxic": 0.0,
        "obscene": 0.0,
        "insult": 0.01,
        "threat": 0.0,
        "identity_hate": 0.0,
    }

    # Keys as returned by the Detoxify "unbiased" model variant
    UNBIASED_KEYS = {
        "toxicity": 0.01,
        "severe_toxicity": 0.0,
        "obscenity": 0.0,
        "insult": 0.01,
        "threat": 0.0,
        "identity_attack": 0.0,
    }

    def _mock_predict(self, key_style="original", **overrides):
        """Mock the toxicity model predict method.

        key_style: "original" uses Detoxify original model keys (severe_toxic,
                   obscene, identity_hate). "unbiased" uses unbiased model keys
                   (severe_toxicity, obscenity, identity_attack).
        """
        if key_style == "original":
            defaults = dict(self.ORIGINAL_KEYS)
        else:
            defaults = dict(self.UNBIASED_KEYS)
        defaults.update(overrides)
        mock_model = MagicMock()
        mock_model.predict.return_value = defaults
        main.toxicity_model = mock_model

    def test_hate_speech_detected_logs(self, client, headers, caplog):
        """Hate speech detection should log with scores and text preview."""
        self._mock_predict(identity_hate=0.8, severe_toxic=0.2)

        with caplog.at_level(logging.INFO, logger="moderation"):
            resp = client.post(
                "/scan/text",
                json={"text": "some hateful content here"},
                headers=headers,
            )

        assert resp.status_code == 200
        assert resp.json()["is_hate_speech"] is True
        assert any("Hate speech detected" in r.message for r in caplog.records)

    def test_bullying_detected_logs(self, client, headers, caplog):
        """Bullying detection should log with scores and text preview."""
        self._mock_predict(insult=0.85, toxicity=0.3)

        with caplog.at_level(logging.INFO, logger="moderation"):
            resp = client.post(
                "/scan/text",
                json={"text": "some bullying content"},
                headers=headers,
            )

        assert resp.status_code == 200
        assert resp.json()["is_bullying"] is True
        assert any("Bullying detected" in r.message for r in caplog.records)

    def test_normal_text_no_detection_logs(self, client, headers, caplog):
        """Normal text should not produce detection log entries."""
        self._mock_predict()

        with caplog.at_level(logging.INFO, logger="moderation"):
            resp = client.post(
                "/scan/text",
                json={"text": "hello world, nice day"},
                headers=headers,
            )

        assert resp.status_code == 200
        assert resp.json()["is_hate_speech"] is False
        assert resp.json()["is_bullying"] is False
        assert not any("Hate speech" in r.message for r in caplog.records)
        assert not any("Bullying" in r.message for r in caplog.records)

    def test_empty_text_returns_zeros(self, client, headers):
        """Empty text should return all zero scores."""
        resp = client.post(
            "/scan/text",
            json={"text": ""},
            headers=headers,
        )

        assert resp.status_code == 200
        data = resp.json()
        assert data["is_hate_speech"] is False
        assert data["toxicity"] == 0.0

    def test_hate_speech_log_truncates_long_text(self, client, headers, caplog):
        """Log messages should truncate text to 200 chars."""
        long_text = "x" * 500
        self._mock_predict(identity_hate=0.9)

        with caplog.at_level(logging.INFO, logger="moderation"):
            client.post(
                "/scan/text",
                json={"text": long_text},
                headers=headers,
            )

        log_messages = [r.message for r in caplog.records if "Hate speech" in r.message]
        assert len(log_messages) == 1
        assert "x" * 200 in log_messages[0]
        assert "x" * 201 not in log_messages[0]

    def test_both_hate_speech_and_bullying_logs_both(self, client, headers, caplog):
        """When both are detected, both should be logged."""
        self._mock_predict(
            identity_hate=0.8,
            insult=0.9,
            toxicity=0.8,
            threat=0.5,
        )

        with caplog.at_level(logging.INFO, logger="moderation"):
            resp = client.post(
                "/scan/text",
                json={"text": "hateful and bullying content"},
                headers=headers,
            )

        data = resp.json()
        assert data["is_hate_speech"] is True
        assert data["is_bullying"] is True

        messages = [r.message for r in caplog.records]
        assert any("Hate speech detected" in m for m in messages)
        assert any("Bullying detected" in m for m in messages)


class TestTextScanKeyCompatibility:
    """Verify that both Detoxify key naming conventions are supported."""

    def _mock_predict(self, scores):
        mock_model = MagicMock()
        mock_model.predict.return_value = scores
        main.toxicity_model = mock_model

    def test_original_model_keys(self, client, headers):
        """Detoxify 'original' model keys (severe_toxic, obscene, identity_hate)."""
        self._mock_predict({
            "toxicity": 0.1,
            "severe_toxic": 0.2,
            "obscene": 0.3,
            "insult": 0.4,
            "threat": 0.05,
            "identity_hate": 0.06,
        })
        resp = client.post(
            "/scan/text",
            json={"text": "test content"},
            headers=headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["toxicity"] == 0.1
        assert data["severe_toxicity"] == 0.2
        assert data["obscenity"] == 0.3
        assert data["insult"] == 0.4
        assert data["threat"] == 0.05
        assert data["identity_attack"] == 0.06

    def test_unbiased_model_keys(self, client, headers):
        """Detoxify 'unbiased' model keys (severe_toxicity, obscenity, identity_attack)."""
        self._mock_predict({
            "toxicity": 0.1,
            "severe_toxicity": 0.2,
            "obscenity": 0.3,
            "insult": 0.4,
            "threat": 0.05,
            "identity_attack": 0.06,
        })
        resp = client.post(
            "/scan/text",
            json={"text": "test content"},
            headers=headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["toxicity"] == 0.1
        assert data["severe_toxicity"] == 0.2
        assert data["obscenity"] == 0.3
        assert data["insult"] == 0.4
        assert data["threat"] == 0.05
        assert data["identity_attack"] == 0.06

    def test_hate_speech_with_original_keys(self, client, headers):
        """Hate speech detection works with original model key names."""
        self._mock_predict({
            "toxicity": 0.1,
            "severe_toxic": 0.0,
            "obscene": 0.0,
            "insult": 0.1,
            "threat": 0.0,
            "identity_hate": 0.8,
        })
        resp = client.post(
            "/scan/text",
            json={"text": "hateful content"},
            headers=headers,
        )
        assert resp.status_code == 200
        assert resp.json()["is_hate_speech"] is True

    def test_missing_keys_default_to_zero(self, client, headers):
        """Missing keys should default to 0.0 instead of raising KeyError."""
        self._mock_predict({"toxicity": 0.5})
        resp = client.post(
            "/scan/text",
            json={"text": "partial keys"},
            headers=headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["toxicity"] == 0.5
        assert data["severe_toxicity"] == 0.0
        assert data["obscenity"] == 0.0
        assert data["identity_attack"] == 0.0


# ── Auth tests ────────────────────────────────────────────────────


class TestAuth:
    def test_invalid_api_key_returns_401(self, client):
        resp = client.post(
            "/scan/text",
            json={"text": "test"},
            headers={"X-API-Key": "wrong-key"},
        )
        assert resp.status_code == 401

    def test_missing_api_key_returns_422(self, client):
        resp = client.post("/scan/text", json={"text": "test"})
        assert resp.status_code == 422


# ── Health check ──────────────────────────────────────────────────


class TestHealth:
    def test_health_endpoint(self, client):
        resp = client.get("/health")
        assert resp.status_code == 200
        assert resp.json()["status"] == "ok"
