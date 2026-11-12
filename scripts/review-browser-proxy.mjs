import http from 'node:http';

// Test-only bridge inside the app's network namespace: keeps the canonical local
// callback origin (localhost:8088), without changing app auth configuration.
if (process.env.LOCAL_REVIEW_ONLY !== '1') throw new Error('Review bridge is local-only');
const server = http.createServer((request, response) => {
  const upstream = http.request({ hostname: '127.0.0.1', port: 3000, path: request.url, method: request.method, headers: request.headers }, incoming => {
    response.writeHead(incoming.statusCode, incoming.headers);
    incoming.pipe(response);
  });
  upstream.on('error', () => { response.writeHead(502); response.end('Review app unavailable'); });
  request.pipe(upstream);
});
server.listen(8088, '127.0.0.1');
process.on('SIGTERM', () => server.close());
