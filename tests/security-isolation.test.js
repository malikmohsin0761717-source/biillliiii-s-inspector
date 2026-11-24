'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {spawn}=require('node:child_process');
const {request,setupAndLogin,createTestData}=require('./auth-test-helpers');
const sourceRoot=path.resolve(__dirname,'..');
function copyApp(dir){fs.mkdirSync(dir,{recursive:true});for(const name of ['server.js','auth.js','cloud-auth.js','ai-provider.js','workspace-core.js'])fs.cpSync(path.join(sourceRoot,name),path.join(dir,name));for(const name of ['ui','monitoring'])fs.cpSync(path.join(sourceRoot,name),path.join(dir,name),{recursive:true});createTestData(sourceRoot,dir);}
function startApp(dir,port,supabaseUrl){const child=spawn(process.execPath,['server.js'],{cwd:dir,env:{...process.env,PORT:String(port),BI_DATA_DIR:'data',SUPABASE_URL:supabaseUrl,SUPABASE_PUBLISHABLE_KEY:'test-publishable-key'},stdio:['ignore','pipe','pipe']});return new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('App server did not start')),7000);child.stdout.on('data',chunk=>{if(String(chunk).includes('is available at')){clearTimeout(timer);resolve(child);}});child.once('error',e=>{clearTimeout(timer);reject(e);});});}
function stop(child){return new Promise(resolve=>{if(!child||child.exitCode!==null)return resolve();child.once('exit',resolve);child.kill('SIGTERM');setTimeout(()=>{if(child.exitCode===null)child.kill('SIGKILL');},1500).unref();});}

test('cloud-only session cannot read local projects, AI histories, or sync local data without local owner login',async()=>{
  let syncRows=[];
  const supabase=http.createServer(async(req,res)=>{
    if(req.url.startsWith('/auth/v1/token?grant_type=password')){let body='';for await(const c of req)body+=c;res.writeHead(200,{'Content-Type':'application/json'});return res.end(JSON.stringify({access_token:'test-access-token',refresh_token:'test-refresh-token',expires_in:3600,user:{id:'user-a-uuid',email:'owner-a@example.test'}}));}
    if(req.url.startsWith('/rest/v1/projects')&&req.method==='GET'){assert.equal(req.headers.authorization,'Bearer test-access-token');res.writeHead(200,{'Content-Type':'application/json'});return res.end(JSON.stringify([{project_code:'BI-0007',name:'Cloud private project',status:'Active',payload:{id:'BI-0007'}}]));}
    if(req.url.startsWith('/rest/v1/projects')&&req.method==='POST'){let body='';for await(const c of req)body+=c;syncRows=JSON.parse(body);res.writeHead(201,{'Content-Type':'application/json'});return res.end('[]');}
    if(req.url==='/auth/v1/logout'){res.writeHead(204);return res.end();}
    res.writeHead(404);res.end('{}');
  });
  await new Promise(resolve=>supabase.listen(0,'127.0.0.1',resolve));
  const supabaseUrl=`http://127.0.0.1:${supabase.address().port}`;
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'biillliiii-isolation-'));const dir=path.join(temp,'app');copyApp(dir);
  const port=6700+Math.floor(Math.random()*200),base=`http://127.0.0.1:${port}`;let child;
  try{
    child=await startApp(dir,port,supabaseUrl);
    let response=await request(base,'/api/cloud-auth/login',{method:'POST',body:{email:'owner-a@example.test',password:'Test-cloud-password-2026'}});assert.equal(response.status,200);
    const cloudCookie=response.headers.get('set-cookie').split(';')[0];
    response=await request(base,'/api/cloud-auth/projects',{cookie:cloudCookie});assert.equal(response.status,200);assert.equal((await response.json()).projects[0].projectCode,'BI-0007');
    response=await request(base,'/api/projects',{cookie:cloudCookie});assert.equal(response.status,401);
    response=await request(base,'/api/ai/chatbot/conversations',{cookie:cloudCookie});assert.equal(response.status,401);
    response=await request(base,'/api/cloud-auth/sync',{method:'POST',cookie:cloudCookie,body:{projects:[{id:'BI-0001',name:'Should not sync'}]}});assert.equal(response.status,401);assert.equal(syncRows.length,0);
    const {cookie:localCookie}=await setupAndLogin(base);
    const combinedCookie=`${localCookie}; ${cloudCookie}`;
    response=await request(base,'/api/projects',{cookie:localCookie});assert.equal(response.status,200);
    response=await request(base,'/api/cloud-auth/sync',{method:'POST',cookie:combinedCookie,body:{projects:[{id:'BI-0001',name:'Local owner approved'}]}});assert.equal(response.status,200);assert.equal(syncRows[0].name,'Local owner approved');
  }finally{await stop(child);await new Promise(resolve=>supabase.close(resolve));fs.rmSync(temp,{recursive:true,force:true});}
});
