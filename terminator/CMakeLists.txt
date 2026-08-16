cmake_minimum_required(VERSION 3.22)
project(nifdu_tls LANGUAGES CXX)
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

find_package(Boost 1.80 REQUIRED COMPONENTS filesystem system iostreams regex thread)
find_package(OpenSSL REQUIRED)

add_executable(nifdu_tls main.cpp)
target_link_libraries(nifdu_tls PRIVATE
    Boost::filesystem Boost::system Boost::iostreams Boost::regex Boost::thread
    OpenSSL::SSL OpenSSL::Crypto
)

# Windows extra libs for OpenSSL/Asio sockets
if(WIN32)
  target_link_libraries(nifdu_tls PRIVATE ws2_32 crypt32 bcrypt)
endif()
