// A real connection failure exercises the SW when WebKit's offline emulation
// rejects requests before they reach a service worker (including cache hits).
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
export async function offlineServer() {
  const root=fileURLToPath(new URL('../dist/',import.meta.url));let blocked=false;
  const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.woff2':'font/woff2','.mp3':'audio/mpeg','.pdf':'application/pdf','.svg':'image/svg+xml','.png':'image/png'};
  const server=http.createServer(async(req,res)=>{
    if(blocked){req.socket.destroy();return}
    try{
      const pathname=new URL(req.url,'http://localhost').pathname;
      if(!pathname.startsWith('/language-study/'))throw new Error();
      const file=path.resolve(root,decodeURIComponent(pathname.slice('/language-study/'.length))||'index.html');
      if(!file.startsWith(root))throw new Error();
      const buffer=await readFile(file);res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Content-Length':buffer.length,'Cache-Control':'no-store'});res.end(buffer);
    }catch{res.writeHead(404);res.end()}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  return {url:`http://127.0.0.1:${server.address().port}/language-study/`,setBlocked:value=>{blocked=value},close:()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections()})};
}
