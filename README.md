# VPS — Native TLS/SNI Webserver

**A lightweight native C++ TLS termination and reverse-proxy server for secure multi-domain services.**

VPS is the webserver component of the **Shmry Software Inc** ecosystem. It provides TLS 1.2+, SNI certificate selection, certificate/private-key validation, HTTPS termination, backend proxying, and native C++ deployment without a heavyweight application runtime.

## One-command install

Linux, macOS, WSL, ChromeOS Linux, and other Unix-like systems with CMake, OpenSSL, Boost, Git, and a C++17/20 compiler:

```bash
curl -fsSL https://raw.githubusercontent.com/badrpk/vps/main/install.sh | bash
```

Windows PowerShell with Git, CMake, OpenSSL/Boost development packages, and a supported C++ toolchain:

```powershell
irm https://raw.githubusercontent.com/badrpk/vps/main/install.ps1 | iex
```

The installer refuses to overwrite a dirty existing checkout.

## Features

- C++17/C++20
- OpenSSL TLS server contexts
- TLS 1.2+ minimum
- SNI multi-domain certificate selection
- certificate/private-key validation
- JSON TLS host registry
- HTTPS listener
- TLS termination
- HTTP backend proxy
- `www` to bare-domain HTTPS redirect support
- portable CMake build definitions

## Build from source

```bash
git clone https://github.com/badrpk/vps.git
cd vps
cmake -S . -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build --parallel
```

## Security

Never commit real certificate files, private keys, ACME account state, credentials, runtime data, or machine-specific TLS configuration.

Use:

```text
config/tls-map.example.json
```

as a template only. Certificate issuance/renewal remains an external deployment responsibility unless an ACME integration is added later.

## Shmry Software Inc ecosystem

| Product | Role |
|---|---|
| Shmry | Cloud + email server |
| Xerus | Disk-first memory |
| **VPS** | **Native TLS/SNI webserver** |
| HuobzLang | Highest-level compact language |
| Neuron | Biological intelligence |
| Nifdu | Screenshot-loop harness |
| Sophyane | Multi-option engineering harness |

VPS handles the secure network boundary while peer products provide memory, intelligence, orchestration, language, cloud, and verification capabilities.

## Ecosystem contract

See [`ecosystem.json`](ecosystem.json).

## Verification

After installation, configure a real TLS map outside Git and run the generated frontend or terminator binary from the CMake build tree. Platform support should be treated as verified only after the build succeeds with the required OpenSSL/Boost toolchain on that host.

## Contributing

Contributions are welcome in TLS hardening, portability, HTTP/2/ALPN, ACME integration, proxy performance, observability, and Shmry ecosystem interoperability.
