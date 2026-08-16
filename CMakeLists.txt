cmake_minimum_required(VERSION 3.20)

project(
    vps_native_tls
    VERSION 1.0.0
    LANGUAGES CXX
)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

find_package(OpenSSL REQUIRED)
find_package(Boost REQUIRED COMPONENTS system)

add_library(
    vps_tls_core
    src/tls_server.cpp
    src/tls_sni.cpp
)

target_include_directories(
    vps_tls_core
    PUBLIC
    ${CMAKE_CURRENT_SOURCE_DIR}/src
)

target_link_libraries(
    vps_tls_core
    PUBLIC
    OpenSSL::SSL
    OpenSSL::Crypto
    Boost::system
)

if(WIN32)
    target_link_libraries(
        vps_tls_core
        PUBLIC
        ws2_32
        crypt32
    )
endif()

add_subdirectory(frontend)
add_subdirectory(terminator)
