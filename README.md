# VPS Native TLS Webserver

VPS is a native C++ TLS termination, SNI, and reverse-proxy webserver.

The implementation originates from the Nifdu native TLS subsystem and is
maintained here as the standalone VPS webserver.

## Features

- C++17
- OpenSSL
- TLS 1.2+
- SNI multi-domain certificate selection
- certificate/private-key validation
- JSON host registry
- HTTPS listener
- TLS termination
- HTTP backend proxy
- www-to-bare HTTPS redirect support

## Security

Never commit real certificate files, private keys, ACME account state,
credentials, runtime data, or machine-specific TLS configuration.

Use:

    config/tls-map.example.json

as a template only.

## Ecosystem

VPS provides the TLS/network boundary for Sophyane, Xerus, Neuron,
HuobzLang, and Shmry services.
