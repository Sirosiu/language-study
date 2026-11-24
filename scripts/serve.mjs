import http from 'node:http';
import { stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../dist/', import.meta.url));
const port = Number(process.env.PORT || 4173);
const prefix = '/' + (process.env.BASE_PATH || '').replace(/^\/+|\/+$/g, '') + '/';
const base = prefix === '//' ? '/' : prefix;
const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.webmanifest':'application/manifest+json','.mp3':'audio/mpeg','.pdf':'application/pdf','.zip':'application/zip','.woff2':'font/woff2','.png':'image/png','.svg':'image/svg+xml','.md':'text/plain; charset=utf-8','.txt':'text/plain; charset=utf-8'};
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (base !== '/' && url.pathname === base.slice(0, -1)) { res.writeHead(301, {Location:base});res.end();return; }
    if (!url.pathname.startsWith(base)) { res.writeHead(404);res.end('Not found');return; }
    const relative = decodeURIComponent(url.pathname.slice(base.length)) || 'index.html';
    const file = path.resolve(root, relative);
    if (!file.startsWith(root) || file.includes('\0')) { res.writeHead(403);res.end();return; }
    const info = await stat(file);
    if (!info.isFile()) { res.writeHead(404);res.end('Not found');return; }
    const headers = {'Content-Type':mime[path.extname(file)] || 'application/octet-stream','Cache-Control':'no-cache','Accept-Ranges':'bytes','X-Content-Type-Options':'nosniff'};
    let start=0,end=info.size-1,status=200;
    if (req.headers.range) {
      const match=/^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
      if (match) {start=match[1]?Number(match[1]):Math.max(0,info.size-Number(match[2]));end=match[1]&&match[2]?Math.min(Number(match[2]),end):end;}
      if (!match || (!match[1]&&!match[2]) || start>=info.size || end<start) {res.writeHead(416,{'Content-Range':`bytes */${info.size}`});res.end();return;}
      status=206;headers['Content-Range']=`bytes ${start}-${end}/${info.size}`;
    }
    headers['Content-Length']=String(end-start+1);res.writeHead(status,headers);
    if (req.method==='HEAD')res.end();else createReadStream(file,{start,end}).pipe(res);
  } catch {res.writeHead(404);res.end('Not found');}
});
server.listen(port,'127.0.0.1',()=>console.log(`Preview: http://127.0.0.1:${port}${base}`));
