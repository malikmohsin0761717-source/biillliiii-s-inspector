'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
const server=fs.readFileSync(path.join(root,'server.js'),'utf8');
const ui=fs.readFileSync(path.join(root,'ui','app.js'),'utf8');
const html=fs.readFileSync(path.join(root,'ui','index.html'),'utf8');

test('v11.0.1 release version is consistent across package, server and visible UI',()=>{
  assert.equal(pkg.version,'11.0.1');
  assert.match(server,/version: '11\.0\.1'/);
  assert.match(server,/Inspector v11\.0\.1 is available/);
  assert.match(ui,/Inspector v11\.0\.1 loaded/);
  assert.match(ui,/v11\.0\.1 local-first workspace/);
  assert.match(html,/v11\.0\.1/);
  assert.doesNotMatch(ui,/v0\.(5|6|8|10)\.0/);
});

test('fresh install seed contains no illustrative projects and AI remains disabled by default',()=>{
  const seed=JSON.parse(fs.readFileSync(path.join(root,'data','projects.seed.json'),'utf8'));
  assert.deepEqual(seed.projects,[]);
  const example=fs.readFileSync(path.join(root,'.env.example'),'utf8');
  assert.match(example,/OPENAI_API_ENABLED=false/);
  assert.match(example,/OPENAI_API_KEY=/);
});

test('core view renderers are defined once and reminders/reports are real-data views',()=>{
  for(const name of ['renderImportant','renderStopped','renderReminders','renderAlerts','renderReports','renderSettings']) {
    assert.equal((ui.match(new RegExp(`function ${name}\\(`,'g'))||[]).length,1,`${name} must not be duplicated`);
  }
  assert.match(ui,/api\('\/api\/reminders'\)/);
  assert.match(ui,/api\('\/api\/reports\/summary'\)/);
  assert.match(ui,/api\('\/api\/important'\)/);
});
