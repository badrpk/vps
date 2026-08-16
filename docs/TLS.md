# VPS TLS

The native TLS core creates one OpenSSL context per hostname and uses SNI
to choose the correct context during the TLS handshake.

The implementation:

1. creates an OpenSSL TLS server context;
2. requires TLS 1.2 or newer;
3. loads a certificate chain;
4. loads the corresponding private key;
5. validates that certificate and key match;
6. registers host-specific contexts;
7. switches contexts using the SNI hostname.

Actual certificates and private keys belong on the deployment host and
must not be committed to Git.
