#include <boost/asio.hpp>
#include <boost/asio/ssl.hpp>
#include <iostream>
#include <thread>
#include <array>

using boost::asio::ip::tcp;
namespace ssl = boost::asio::ssl;

static const unsigned short FRONTEND_PORT = 443;
static const char* BACKEND_HOST   = "127.0.0.1";
static const unsigned short BACKEND_PORT  = 80;
static const char* CERT_FILE = "C:/nifdu/certs/nifdu.com/fullchain.pem";
static const char* KEY_FILE  = "C:/nifdu/certs/nifdu.com/nifdu.com-key.pem";

void log_info(const std::string& msg) { std::cout << msg << std::endl; }
void log_error(const std::string& msg){ std::cerr << msg << std::endl; }

template<typename Reader, typename Writer>
void pipe_stream(Reader& src, Writer& dst)
{
    boost::system::error_code ec_read, ec_write;
    std::array<char, 8192> buf;
    for (;;) {
        std::size_t n = src.read_some(boost::asio::buffer(buf), ec_read);
        if (ec_read) break;
        boost::asio::write(dst, boost::asio::buffer(buf.data(), n), ec_write);
        if (ec_write) break;
    }
}

void handle_session(tcp::socket socket, ssl::context& ctx)
{
    try {
        log_info("[TLS] New connection accepted.");
        ssl::stream<tcp::socket> tls_stream(std::move(socket), ctx);

        boost::system::error_code ec_hs;
        tls_stream.handshake(ssl::stream_base::server, ec_hs);
        if (ec_hs) {
            log_error(std::string("[TLS] Handshake failed: ") + ec_hs.message());
            return;
        }
        log_info("[TLS] Handshake OK.");

        boost::asio::io_context& ioc = static_cast<boost::asio::io_context&>(tls_stream.get_executor().context());
        tcp::resolver resolver(ioc);
        boost::system::error_code ec_resolve;
        auto resolved = resolver.resolve(BACKEND_HOST, std::to_string(BACKEND_PORT), ec_resolve);
        if (ec_resolve) {
            log_error(std::string("[BACKEND] Resolve failed: ") + ec_resolve.message());
            return;
        }

        tcp::socket backend_sock(ioc);
        boost::asio::connect(backend_sock, resolved, ec_resolve);
        if (ec_resolve) {
            log_error(std::string("[BACKEND] Connect failed: ") + ec_resolve.message());
            return;
        }
        log_info("[BACKEND] Connected to 127.0.0.1:80");

        std::thread t1([&]() {
            pipe_stream(tls_stream, backend_sock);
            boost::system::error_code ignored;
            backend_sock.shutdown(tcp::socket::shutdown_send, ignored);
        });

        std::thread t2([&]() {
            pipe_stream(backend_sock, tls_stream);
            boost::system::error_code ignored;
            tls_stream.shutdown(ignored);
        });

        t1.join();
        t2.join();
        log_info("[SESSION] Closed cleanly.");
    } catch (const std::exception& ex) {
        log_error(std::string("[SESSION] Exception: ") + ex.what());
    }
}

int main()
{
    try {
        log_info("[nifdu-tls] Minimal TLS frontend starting...");
        boost::asio::io_context ioc;
        ssl::context ctx(ssl::context::tls_server);

        ctx.set_options(
            ssl::context::default_workarounds
            | ssl::context::no_sslv2
            | ssl::context::single_dh_use
        );

        log_info(std::string("[nifdu-tls] Using certificate: ") + CERT_FILE);
        log_info(std::string("[nifdu-tls] Using private key: ") + KEY_FILE);

        ctx.use_certificate_chain_file(CERT_FILE);
        ctx.use_private_key_file(KEY_FILE, ssl::context::pem);

        tcp::acceptor acceptor(ioc, tcp::endpoint(tcp::v4(), FRONTEND_PORT));
        log_info("[nifdu-tls] Listening on 0.0.0.0:443 -> backend 127.0.0.1:80");

        for (;;) {
            tcp::socket socket(ioc);
            acceptor.accept(socket);
            std::thread(&handle_session, std::move(socket), std::ref(ctx)).detach();
        }
    } catch (const std::exception& ex) {
        log_error(std::string("[nifdu-tls] FATAL: ") + ex.what());
        return 1;
    }
}
