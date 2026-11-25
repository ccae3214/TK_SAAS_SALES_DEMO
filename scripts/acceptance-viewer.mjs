// Local-only HTTP viewer for the egress-isolated acceptance app. No arbitrary proxy target.
import { createServer, request } from 'node:http';
const server=createServer((incoming,outgoing)=>{
 const upstream=request({hostname:'app',port:8092,path:incoming.url,method:incoming.method,headers:incoming.headers},response=>{
  outgoing.writeHead(response.statusCode,response.headers);response.pipe(outgoing);
 });
 upstream.on('error',()=>{if(!outgoing.headersSent)outgoing.writeHead(502);outgoing.end('Acceptance app unavailable');});
 incoming.on('aborted',()=>upstream.destroy());incoming.pipe(upstream);
});
server.on('upgrade',(_req,socket)=>socket.destroy()); // Calls/push are outside this acceptance workstream.
server.listen(8092,'0.0.0.0',()=>console.log('Acceptance viewer ready; fixed upstream only'));
