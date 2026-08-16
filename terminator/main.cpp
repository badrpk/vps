#if defined(_WIN32)
#ifndef _WIN32_WINNT
#define _WIN32_WINNT 0x0A00
#endif
#endif

#include <boost/asio.hpp>
#include <boost/asio/ssl.hpp>
#include <boost/beast.hpp>
#include <boost/beast/ssl.hpp>
#include <boost/beast/http.hpp>
#include <boost/beast/version.hpp>
#include <iostream>
#include <string>
#include <thread>

namespace net  = boost::asio;
namespace ssl  = net::ssl;
namespace beast= boost::beast;
namespace http = beast::http;
using tcp = net::ip::tcp;

static inline bool starts_with(const std::string& s, const std::string& p){
    return s.size() >= p.size() && std::equal(p.begin(), p.end(), s.begin());
}

int main(int argc, char** argv){
    if(argc < 6){
        std::cerr << "Usage: nifdu_tls <listen_port> <cert.pem> <key.pem> <upstream_host> <upstream_port>\n";
        return 64;
    }
    const unsigned short listen_port = static_cast<unsigned short>(std::stoi(argv[1]));
    const std::string cert = argv[2], key = argv[3];
    const std::string upstream_host = argv[4];
    const std::string upstream_port = argv[5];

    try{
        net::io_context ioc{1};
        ssl::context ctx{ssl::context::tls_server};
        ctx.set_options(ssl::context::default_workarounds | ssl::context::no_sslv2 | ssl::context::single_dh_use);
        ctx.use_certificate_chain_file(cert);
        ctx.use_private_key_file(key, ssl::context::pem);

        tcp::acceptor acc{ioc, {tcp::v4(), listen_port}};
        std::cout << "nifdu_tls: listening on :" << listen_port << std::endl;

        for(;;){
            tcp::socket sock{ioc};
            acc.accept(sock);

            std::thread([s = std::move(sock), &ctx, upstream_host, upstream_port]() mutable {
                try{
                    beast::ssl_stream<tcp::socket> stream(std::move(s), ctx);
                    stream.handshake(ssl::stream_base::server);

                    beast::flat_buffer buffer;
                    http::request<http::string_body> req;
                    http::read(stream, buffer, req);

                    if(req.version() == 0) req.version(11);

                    // --- WWW REDIRECT: if Host begins with "www.", issue 301 to non-www over HTTPS ---
                    std::string host;
                    if(auto h = req.find(http::field::host); h != req.end()){
                        host = std::string(h->value());
                    }
                    if(starts_with(host, "www.")){
                        std::string bare = host.substr(4); // drop "www."
                        std::string target = std::string(req.target()); // includes path + query
                        http::response<http::empty_body> res{http::status::moved_permanently, req.version()};
                        res.set(http::field::location, "https://" + bare + target);
                        res.set(http::field::server, "nifdu_tls");
                        // 6 months HSTS; adjust as needed
                        res.set(http::field::strict_transport_security, "max-age=15552000; includeSubDomains; preload");
                        res.set(http::field::connection, "close");
                        res.prepare_payload();
                        http::write(stream, res);
                        beast::error_code ec; stream.shutdown(ec);
                        return;
                    }

                    // Ensure Host present when proxying
                    if(host.empty()){
                        req.set(http::field::host, upstream_host);
                    }

                    // --- Simple sync proxy to upstream :80 ---
                    net::io_context cioc;
                    tcp::resolver res{cioc};
                    auto r = res.resolve(upstream_host, upstream_port);
                    tcp::socket ups{cioc};
                    net::connect(ups, r.begin(), r.end());

                    http::write(ups, req);

                    beast::flat_buffer ubuf;
                    http::response<http::vector_body<unsigned char>> resp;
                    http::read(ups, ubuf, resp);

                    http::write(stream, resp);

                    beast::error_code ec;
                    stream.shutdown(ec);
                }catch(std::exception const&){
                    // ignore per-connection errors
                }
            }).detach();
        }
    }catch(std::exception const& e){
        std::cerr << "FATAL: " << e.what() << std::endl;
        return 1;
    }
}
