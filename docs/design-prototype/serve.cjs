// Local preview only; serves files from this directory on loopback.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = __dirname;
const files = new Set(['index.html', 'review.html', 'styles.css', 'app.js']);
http.createServer((request, response) => {
  const name = new URL(request.url, 'http://127.0.0.1').pathname.slice(1) || 'index.html';
  if (!files.has(name)) {
    response.writeHead(404);
    response.end('Not found');
    return;
  }
  response.writeHead(200, {
    'Content-Type': name.endsWith('.css') ? 'text/css' : name.endsWith('.js') ? 'text/javascript' : 'text/html',
    'Cache-Control': 'no-store'
  });
  fs.createReadStream(path.join(root, name)).pipe(response);
}).listen(4310, '127.0.0.1', () => console.log('Design preview: http://127.0.0.1:4310'));
