import test from 'node:test';
import assert from 'node:assert/strict';
import {bookArtMatch} from '../book-art-path.mjs';
test('flat art and composed portrait/landscape routes are bounded, case preserving and traversal safe',()=>{
 for(const name of ['bg/forest.webp','actors/guide.svg','props/rope.png','bg/real-foreground/forestPortrait.webp','bg/real-foreground/forestLandscape.webp'])assert.equal(bookArtMatch('/book-art/'+name)?.[1],name);
 for(const name of ['bg/../config.json','bg/real-foreground/../private.png','bg/other/forest.webp','actors/real-foreground/guide.svg','bg/%2e%2e%2fsecret.png','bg/forest.webp/extra','bg/forest.webp?query','bg/forest.exe','bg/'+ 'a'.repeat(61)+'.png'])assert.equal(bookArtMatch('/book-art/'+name),null);
});
test('the Book serves a nested composed painting through its actual image handler',async t=>{
 const {mkdtemp,mkdir,writeFile}=await import('node:fs/promises'),{join}=await import('node:path'),{tmpdir}=await import('node:os'),{createServer}=await import('node:http'),{bookService}=await import('../book-service.mjs');
 const root=await mkdtemp(join(tmpdir(),'book-art-route-')),book=join(root,'book'),dir=join(book,'art','lib','bg','real-foreground'),bytes=Buffer.from('synthetic painting bytes');await mkdir(dir,{recursive:true});await writeFile(join(dir,'forestPortrait.webp'),bytes);
 const service=bookService({data:join(root,'data'),bookDir:book,players:['admin'],config:{players:[{id:'admin',name:'Admin'}]},timeZone:'UTC'}),server=createServer(async(req,res)=>{await service.handle(req,res,new URL(req.url,'http://localhost'));if(!res.headersSent){res.writeHead(404);res.end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>server.close());
 const response=await fetch(`http://127.0.0.1:${server.address().port}/book-art/bg/real-foreground/forestPortrait.webp`);assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'image/webp');assert.deepEqual(Buffer.from(await response.arrayBuffer()),bytes);
});
