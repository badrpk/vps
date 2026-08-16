#!/usr/bin/env bash
set -euo pipefail

REPO="https://github.com/badrpk/vps.git"
DEST="${VPS_HOME:-$HOME/.local/share/vps}"
BUILD="$DEST/build"

have(){ command -v "$1" >/dev/null 2>&1; }
need(){ have "$1" || { echo "Missing required command: $1" >&2; exit 2; }; }

install_deps(){
  if have apt-get; then
    SUDO=""
    if [ "$(id -u)" -ne 0 ]; then
      need sudo
      SUDO="sudo"
    fi
    $SUDO apt-get update
    $SUDO apt-get install -y \
      git cmake g++ pkg-config \
      libssl-dev libboost-system-dev libboost-filesystem-dev \
      libboost-iostreams-dev libboost-regex-dev libboost-thread-dev
    return
  fi

  if have dnf; then
    SUDO=""
    if [ "$(id -u)" -ne 0 ]; then need sudo; SUDO="sudo"; fi
    $SUDO dnf install -y git cmake gcc-c++ pkgconf-pkg-config openssl-devel boost-devel
    return
  fi

  if have pacman; then
    SUDO=""
    if [ "$(id -u)" -ne 0 ]; then need sudo; SUDO="sudo"; fi
    $SUDO pacman -S --needed --noconfirm git cmake gcc pkgconf openssl boost
    return
  fi

  if have brew; then
    brew install git cmake openssl boost
    return
  fi

  if have pkg && [ -n "${TERMUX_VERSION:-}" ]; then
    pkg update -y
    pkg install -y git cmake clang openssl boost
    return
  fi

  echo "Unable to install dependencies automatically on this platform." >&2
  echo "Install Git, CMake, a C++17 compiler, OpenSSL development files, and Boost (system/filesystem/iostreams/regex/thread), then rerun." >&2
  exit 2
}

# Install native prerequisites only when the toolchain or headers are missing.
if ! have git || ! have cmake || { ! have c++ && ! have g++ && ! have clang++; }; then
  install_deps
fi

# Probe headers because CMake requires development packages, not only runtime libraries.
probe_dir="$(mktemp -d)"
trap 'rm -rf "$probe_dir"' EXIT
cat > "$probe_dir/probe.cpp" <<'CPP'
#include <boost/system/error_code.hpp>
#include <openssl/ssl.h>
int main() { return 0; }
CPP

CXX=""
if have c++; then CXX="c++"; elif have g++; then CXX="g++"; elif have clang++; then CXX="clang++"; fi

if [ -z "$CXX" ] || ! "$CXX" -std=c++17 -fsyntax-only "$probe_dir/probe.cpp" >/dev/null 2>&1; then
  install_deps
fi

need git
need cmake

if have c++; then :
elif have g++; then :
elif have clang++; then :
else echo "Missing C++17/20 compiler (c++, g++, or clang++)" >&2; exit 2; fi

if [ -d "$DEST/.git" ]; then
  git -C "$DEST" fetch origin --tags --prune
  test -z "$(git -C "$DEST" status --porcelain)" || { echo "Refusing update: $DEST has local changes" >&2; exit 3; }
  git -C "$DEST" checkout main
  git -C "$DEST" pull --ff-only origin main
else
  rm -rf "$DEST"
  git clone --branch main "$REPO" "$DEST"
fi

cmake -S "$DEST" -B "$BUILD" -DCMAKE_BUILD_TYPE=Release
cmake --build "$BUILD" --parallel

echo "VPS installed at $DEST"
echo "Build output: $BUILD"
