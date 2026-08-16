from tools.route_manifest import Route, diagnostic_summary, manifest, validate_route, validate_routes


def route(host="example.com", backend="http://127.0.0.1:8080", **kwargs):
    data = dict(
        host=host,
        backend=backend,
        cert="/etc/veyron/certs/example.crt",
        key="/etc/veyron/certs/example.key",
        health_path="/health",
    )
    data.update(kwargs)
    return Route(**data)


def test_normalization():
    normalized = route(host="Example.COM.", health_path="health").normalized()
    assert normalized.host == "example.com"
    assert normalized.health_path == "/health"


def test_invalid_backend_rejected():
    errors = validate_route(route(backend="ftp://example.com/file"))
    assert any("backend" in error for error in errors)


def test_missing_cert_and_key_rejected():
    errors = validate_route(route(cert="", key=""))
    assert any("certificate" in error for error in errors)
    assert any("private-key" in error for error in errors)


def test_duplicate_sni_host_rejected():
    errors = validate_routes([route("EXAMPLE.com"), route("example.com.", backend="http://127.0.0.1:9090")])
    assert any("duplicate SNI host" in error for error in errors)


def test_invalid_hostname_rejected():
    errors = validate_route(route(host="bad host"))
    assert "invalid host" in errors


def test_manifest_is_deterministic():
    a = route("a.example.com")
    b = route("b.example.com", backend="https://127.0.0.1:8443")
    assert manifest([a, b]) == manifest([b, a])


def test_manifest_counts_routes():
    result = manifest([route()])
    assert result["route_count"] == 1
    assert len(result["manifest_hash"]) == 64


def test_diagnostics_summarize_https_backends():
    summary = diagnostic_summary([
        route("a.example.com", backend="http://127.0.0.1:8080"),
        route("b.example.com", backend="https://127.0.0.1:8443"),
    ])
    assert summary["valid"] is True
    assert summary["https_backends"] == 1
    assert summary["hosts"] == ["a.example.com", "b.example.com"]


def test_manifest_rejects_invalid_routes():
    try:
        manifest([route(backend="not-a-url")])
    except ValueError as exc:
        assert "backend" in str(exc)
    else:
        raise AssertionError("invalid route accepted")
