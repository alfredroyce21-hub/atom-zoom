import http.server
import socketserver
import os
import sys

PORT = 3000

class StarkHTTPHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Enable CORS and cross-origin isolation if needed
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        super().end_headers()

    def guess_type(self, path):
        if path.endswith('.js') or path.endswith('.mjs'):
            return 'application/javascript; charset=utf-8'
        if path.endswith('.css'):
            return 'text/css; charset=utf-8'
        return super().guess_type(path)

if __name__ == '__main__':
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    handler = StarkHTTPHandler
    with socketserver.TCPServer(("", PORT), handler) as httpd:
        print(f"⚛️ STARK INDUSTRIES HOLOGRAPHIC SERVER RUNNING AT: http://localhost:{PORT}")
        print("Press Ctrl+C to stop.")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down server.")
            httpd.shutdown()
