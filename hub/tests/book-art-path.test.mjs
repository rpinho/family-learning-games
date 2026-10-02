import test from 'node:test';
import assert from 'node:assert/strict';
import {bookArtMatch} from '../book-art-path.mjs';
test('flat art and composed portrait/landscape routes are bounded, case preserving and traversal safe',()=>{
 for(const name of ['bg/forest.webp','actors/guide.svg','props/rope.png','bg/real-foreground/forestPortrait.webp','bg/real-foreground/forestLandscape.webp'])assert.equal(bookArtMatch('/book-art/'+name)?.[1],name);
 for(const name of ['bg/../config.json','bg/real-foreground/../private.png','bg/other/forest.webp','actors/real-foreground/guide.svg','bg/%2e%2e%2fsecret.png','bg/forest.webp/extra','bg/forest.webp?query','bg/forest.exe','bg/'+ 'a'.repeat(61)+'.png'])assert.equal(bookArtMatch('/book-art/'+name),null);
});
