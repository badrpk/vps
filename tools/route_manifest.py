from __future__ import annotations

from dataclasses import dataclass, asdict
from hashlib import sha256
import ipaddress
import json
from typing import Iterable, List, Optional, Sequence
from urllib.parse import urlparse


def _canonical(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def _digest(value) -> str:
    return sha256(_canonical(value).encode("utf-8")).hexdigest()


@dataclass(frozen=True)
class Route:
    host: str
    backend: str
    cert: str
    key: str
    health_path: str = "/health"

    def normalized(self) -> "Route":
        host = self.host.strip().lower().rstrip(".")
        backend = self.backend.strip()
        cert = self.cert.strip()
        key = self.key.strip()
        health = self.health_path.strip() or "/health"
        if not health.startswith("/"):
            health = "/" + health
        return Route(host, backend, cert, key, health)


def _valid_hostname(host: str) -> bool:
    if not host or len(host) > 253:
        return False
    if host == "localhost":
        return True
    try:
        ipaddress.ip_address(host)
        return True
    except ValueError:
        pass
    labels = host.split(".")
    for label in labels:
        if not label or len(label) > 63:
            return False
        if label[0] == "-" or label[-1] == "-":
            return False
        if not all(ch.isalnum() or ch == "-" for ch in label):
            return False
    return True


def validate_route(route: Route) -> List[str]:
    route = route.normalized()
    errors: List[str] = []
    if not _valid_hostname(route.host):
        errors.append("invalid host")

    parsed = urlparse(route.backend)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        errors.append("backend must be an http/https URL with a host")
    if not route.cert:
        errors.append("certificate path is required")
    if not route.key:
        errors.append("private-key path is required")
    if not route.health_path.startswith("/"):
        errors.append("health path must be absolute")
    return errors


def validate_routes(routes: Iterable[Route]) -> List[str]:
    normalized = [route.normalized() for route in routes]
    errors: List[str] = []
    seen = set()
    for index, route in enumerate(normalized):
        for error in validate_route(route):
            errors.append(f"route[{index}] {route.host}: {error}")
        if route.host in seen:
            errors.append(f"duplicate SNI host: {route.host}")
        seen.add(route.host)
    return errors


def manifest(routes: Sequence[Route]) -> dict:
    normalized = sorted((route.normalized() for route in routes), key=lambda route: route.host)
    errors = validate_routes(normalized)
    if errors:
        raise ValueError("; ".join(errors))
    rows = [asdict(route) for route in normalized]
    return {
        "version": 1,
        "routes": rows,
        "route_count": len(rows),
        "manifest_hash": _digest(rows),
    }


def diagnostic_summary(routes: Sequence[Route]) -> dict:
    normalized = [route.normalized() for route in routes]
    errors = validate_routes(normalized)
    return {
        "route_count": len(normalized),
        "valid": not errors,
        "errors": errors,
        "hosts": sorted(route.host for route in normalized),
        "https_backends": sum(urlparse(route.backend).scheme == "https" for route in normalized),
    }
