cmake_minimum_required(VERSION 3.20)
project(vps_tls_frontend LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

find_package(OpenSSL REQUIRED)
find_package(Boost REQUIRED COMPONENTS system)

add_executable(vps-tls-frontend main.cpp)

target_link_libraries(vps-tls-frontend
    PRIVATE
        OpenSSL::SSL
        OpenSSL::Crypto
        Boost::system
)

if (WIN32)
    target_link_libraries(vps-tls-frontend PRIVATE ws2_32 crypt32 bcrypt)
endif()

if (MSVC)
    target_compile_definitions(vps-tls-frontend PRIVATE
        BOOST_ERROR_CODE_HEADER_ONLY
        BOOST_SYSTEM_NO_DEPRECATED
    )
    target_compile_options(vps-tls-frontend PRIVATE /W4 /permissive-)
else()
    target_compile_options(vps-tls-frontend PRIVATE -Wall -Wextra -Wpedantic)
endif()
