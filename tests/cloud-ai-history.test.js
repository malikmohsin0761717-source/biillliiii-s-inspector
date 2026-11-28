'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const api=fs.readFileSync(path.join(root,'api','cloud-ai.js'),'utf8');
const sql=fs.readFileSync(path.join(root,'supabase','migrations','202611280001_cloud_ai_history.sql'),'utf8');
test('cloud AI history requires same-origin owner session and keeps modes separate',()=>{
 assert.ok(api.includes('assertSameOrigin(req)'));
 assert.ok(api.includes('requireSession(await getSession(req,res))'));
 assert.ok(api.includes("new Set(['chatbot','teacher','analyst'])"));
 assert.ok(api.includes('mode=eq.\${mode}'));
 assert.ok(api.includes('AI Inspector mode only supports read-only response requests'));
 assert.doesNotMatch(api,/SUPABASE_SERVICE_ROLE_KEY|service_role/i);
});
test('cloud AI schema enforces owner-only RLS for histories and teacher progress',()=>{
 for(const table of ['ai_conversations','ai_teacher_progress']){
  assert.ok(sql.includes('alter table public.'+table+' enable row level security'));
  assert.ok(sql.includes(table+'_select_own'));
  assert.ok(sql.includes('auth.uid()'));
 }
 assert.match(sql,/mode in \('chatbot','teacher'\)/);
});
test('cloud AI history validates message roles, content and limits',()=>{
 assert.ok(api.includes('maximum 200 messages'));
 assert.ok(api.includes('12000'));
 assert.ok(api.includes("['user','assistant']"));
});
test('cloud AI responses are disabled unless explicitly enabled with a server-side key',()=>{
 assert.ok(api.includes("OPENAI_API_ENABLED!=='true'"));
 assert.ok(api.includes('process.env.OPENAI_API_KEY'));
 assert.ok(api.includes('createResponse({mode,messages,apiKey:process.env.OPENAI_API_KEY'));
 assert.ok(api.includes('requestTimes'));
});
