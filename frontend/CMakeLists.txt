cmake_minimum_required(VERSION 3.20)
project(nifdu_tls_frontend LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

add_executable(nifdu-tls main.cpp)

# Use Boost + OpenSSL headers directly
target_include_directories(nifdu-tls PRIVATE
    "C:/vcpkg/installed/x64-windows-static/include"
    "C:/vcpkg/installed/x64-windows-static/include"
)

# Link directly against vcpkg OpenSSL libs
link_directories("C:/vcpkg/installed/x64-windows-static/lib")

target_link_libraries(nifdu-tls
    PRIVATE
        libssl
        libcrypto
        ws2_32
)

if (MSVC)
    target_compile_definitions(nifdu-tls PRIVATE
        BOOST_ERROR_CODE_HEADER_ONLY
        BOOST_SYSTEM_NO_DEPRECATED
    )
    target_compile_options(nifdu-tls PRIVATE /W4 /permissive-)
endif()
