import test from 'node:test'; import assert from 'node:assert/strict';
function safeName(name:string){return name.split(/[\\/]/).pop()!.replace(/[^a-zA-Z0-9._ -]/g,'_').trim();}
test('path traversal names are reduced to a basename',()=>{assert.equal(safeName('../../private.txt'),'private.txt');assert.equal(safeName('..\\secret.pdf'),'secret.pdf');});
