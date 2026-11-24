'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { request, setupAndLogin, createTestData } = require('./auth-test-helpers');
const sourceRoot = path.resolve(__dirname, '..');

function copyApp(dir) {
  fs.mkdirSync(dir, { recursive: true });
  for (const name of ['server.js','auth.js','cloud-auth.js','ai-provider.js','workspace-core.js']) fs.cpSync(path.join(sourceRoot,name),path.join(dir,name));
  for (const name of ['ui','monitoring']) fs.cpSync(path.join(sourceRoot,name),path.join(dir,name),{recursive:true});
  createTestData(sourceRoot,dir);
}
function start(dir,port) {
  const child=spawn(process.execPath,['server.js'],{cwd:dir,env:{...process.env,PORT:String(port),BI_DATA_DIR:'data',OPENAI_API_ENABLED:'false'},stdio:['ignore','pipe','pipe']});
  return new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Server did not start.')),7000);child.stdout.on('data',chunk=>{if(String(chunk).includes('is available at')){clearTimeout(timer);resolve(child);}});child.once('error',error=>{clearTimeout(timer);reject(error);});});
}
function stop(child){return new Promise(resolve=>{if(!child||child.exitCode!==null)return resolve();child.once('exit',resolve);child.kill('SIGTERM');setTimeout(()=>{if(child.exitCode===null)child.kill('SIGKILL');},1500).unref();});}

test('real reminders, alerts, reports, settings and backup/restore use saved workspace data', async()=>{
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'biillliiii-workspace-'));
  const dir=path.join(temp,'app');copyApp(dir);
  const port=6500+Math.floor(Math.random()*200),base=`http://127.0.0.1:${port}`;let child;
  try {
    child=await start(dir,port);const {cookie}=await setupAndLogin(base);
    let response=await request(base,'/api/projects',{method:'POST',cookie,body:{name:'Audit project',goal:'Test workspace features',type:'Other',status:'Active'}});
    assert.equal(response.status,201);const project=(await response.json()).project;
    const dueAt=new Date(Date.now()+60*60*1000).toISOString();
    response=await request(base,'/api/reminders',{method:'POST',cookie,body:{title:'Review audit',dueAt,projectId:project.id,notes:'Private note'}});
    assert.equal(response.status,201);const reminder=(await response.json()).reminder;
    response=await request(base,'/api/alerts',{cookie});assert.equal(response.status,200);assert.equal((await response.json()).alerts.length,1);
    response=await request(base,'/api/important',{method:'POST',cookie,body:{title:'Keep this',content:'Important private note'}});assert.equal(response.status,201);const important=(await response.json()).item;
    response=await request(base,'/api/important',{cookie});assert.equal((await response.json()).items.length,1);
    response=await request(base,`/api/important/${important.id}`,{method:'PATCH',cookie,body:{title:'Updated title',content:'Updated private note'}});
    assert.equal(response.status,200);assert.equal((await response.json()).item.title,'Updated title');
    response=await request(base,'/api/reports/summary',{cookie});const report=await response.json();
    assert.equal(report.totals.projects,1);assert.equal(report.totals.openReminders,1);assert.equal(JSON.stringify(report).includes('Private note'),false);
    response=await request(base,'/api/reports/summary.csv',{cookie});assert.equal(response.status,200);assert.match(response.headers.get('content-type'),/text\/csv/);
    response=await request(base,'/api/settings',{method:'PUT',cookie,body:{browserNotificationsEnabled:true,approvedApps:['notepad','code.exe']}});assert.equal(response.status,200);
    response=await request(base,'/api/backup',{cookie});assert.equal(response.status,200);const backup=await response.json();
    assert.equal(backup.format,'biillliiii-inspector-workspace-backup');assert.equal(Object.hasOwn(backup,'auth'),false);assert.equal(JSON.stringify(backup).includes('Private note'),true);assert.equal(JSON.stringify(backup).includes('Updated private note'),true);
    await request(base,`/api/reminders/${reminder.id}`,{method:'DELETE',cookie,body:{}});
    await request(base,`/api/important/${important.id}`,{method:'DELETE',cookie,body:{}});
    response=await request(base,'/api/backup/restore',{method:'POST',cookie,body:{confirmation:'RESTORE WORKSPACE',backup}});assert.equal(response.status,200);
    response=await request(base,'/api/reminders',{cookie});assert.equal((await response.json()).reminders.length,1);
    response=await request(base,'/api/alerts',{cookie});assert.equal((await response.json()).alerts.length,1);
    response=await request(base,'/api/important',{cookie});const restoredImportant=(await response.json()).items;assert.equal(restoredImportant.length,1);assert.equal(restoredImportant[0].title,'Updated title');
    assert.equal(fs.readdirSync(path.join(dir,'data','backups')).length,1);
  } finally {await stop(child);fs.rmSync(temp,{recursive:true,force:true});}
});
