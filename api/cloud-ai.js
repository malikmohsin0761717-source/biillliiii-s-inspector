'use strict';
const { assertSameOrigin, readBody, sendJson, supabaseRequest, getSession, requireSession } = require('./_lib/cloud-session');
const MODES = new Set(['chatbot','teacher','analyst']);
const { createResponse } = require('../ai-provider');
const requestTimes = new Map();
function clean(value,max,label){const s=String(value??'').trim();if(!s||s.length>max)throw Object.assign(new Error(label+' invalid hai.'),{status:400});return s;}
function getQuery(req,key){if(req.query&&typeof req.query[key]==='string')return req.query[key];return new URL(req.url,`https://${req.headers.host||'localhost'}`).searchParams.get(key)||'';}
function modeOf(req){const m=getQuery(req,'mode');if(!MODES.has(m))throw Object.assign(new Error('AI mode invalid hai.'),{status:400});return m;}
function validMessages(value){if(!Array.isArray(value)||value.length>200)throw Object.assign(new Error('Conversation mein maximum 200 messages ho sakte hain.'),{status:400});return value.map((m,i)=>{if(!m||!['user','assistant'].includes(m.role)||typeof m.content!=='string'||!m.content.trim()||m.content.length>12000)throw Object.assign(new Error(`Message ${i+1} invalid hai.`),{status:400});return {role:m.role,content:m.content.trim(),createdAt:typeof m.createdAt==='string'?m.createdAt.slice(0,40):new Date().toISOString()};});}
module.exports=async function(req,res){
 try{
  const method=String(req.method||'GET').toUpperCase();assertSameOrigin(req);const session=requireSession(await getSession(req,res));const mode=modeOf(req);
  if(getQuery(req,'resource')==='progress'){
   if(mode!=='teacher')return sendJson(res,404,{error:'Progress sirf AI Teacher ke liye hai.'});
   if(method==='GET'){const rows=await supabaseRequest('/rest/v1/ai_teacher_progress?select=goals,completed_lessons,notes,updated_at&limit=1',{headers:{Authorization:`Bearer ${session.accessToken}`}});const r=rows[0]||{};return sendJson(res,200,{progress:{goals:r.goals||[],completedLessons:r.completed_lessons||[],notes:r.notes||'',updatedAt:r.updated_at||null}});}
   if(method==='PUT'){const b=readBody(req);const goals=Array.isArray(b.goals)?b.goals.slice(0,30).map(x=>clean(x,300,'Goal')):[];const lessons=Array.isArray(b.completedLessons)?b.completedLessons.slice(0,100).map(x=>clean(x,300,'Lesson')):[];const notes=String(b.notes||'').slice(0,5000);const rows=await supabaseRequest('/rest/v1/ai_teacher_progress?on_conflict=owner_id&select=goals,completed_lessons,notes,updated_at',{method:'POST',headers:{Authorization:`Bearer ${session.accessToken}`,Prefer:'resolution=merge-duplicates,return=representation'},body:JSON.stringify({goals,completed_lessons:lessons,notes})});const r=rows[0]||{};return sendJson(res,200,{progress:{goals:r.goals||goals,completedLessons:r.completed_lessons||lessons,notes:r.notes??notes,updatedAt:r.updated_at||null}});}
  }
  if(getQuery(req,'resource')==='respond' && method==='POST'){
   if(process.env.OPENAI_API_ENABLED!=='true'||!process.env.OPENAI_API_KEY)return sendJson(res,503,{error:'OpenAI disabled or server key missing. Koi API request nahi bheji gayi.',code:'AI_DISABLED'});
   const now=Date.now();const recent=(requestTimes.get(session.user.id)||[]).filter(t=>now-t<60000);if(recent.length>=10)return sendJson(res,429,{error:'AI request limit reached. 1 minute baad try karein.'});recent.push(now);requestTimes.set(session.user.id,recent);
   const body=readBody(req);if(body.projectContext!==undefined&&(typeof body.projectContext!=='string'||body.projectContext.length>7000))return sendJson(res,400,{error:'Project context 7000 characters tak text hona chahiye.'});
   const messages=Array.isArray(body.messages)?body.messages:[];if(body.projectContext){const idx=messages.map(m=>m?.role).lastIndexOf('user');if(idx<0)return sendJson(res,400,{error:'Project context ke sath user message zaroori hai.'});messages.splice(idx,0,{role:'user',content:body.projectContext});}
   try{const result=await createResponse({mode,messages,apiKey:process.env.OPENAI_API_KEY,model:process.env.OPENAI_MODEL||'gpt-6-luna'});return sendJson(res,200,{ok:true,mode,message:result.message,model:result.model,requestId:result.requestId});}
   catch(error){return sendJson(res,error.status||502,{error:error.message||'AI response failed.',code:error.code||'AI_ERROR'});}
  }
  if(mode==='analyst')return sendJson(res,405,{error:'AI Inspector mode only supports read-only response requests.'});
  const base='/rest/v1/ai_conversations';
  if(method==='GET'){const rows=await supabaseRequest(`${base}?select=conversation_id,title,messages,updated_at&mode=eq.${mode}&order=updated_at.desc&limit=100`,{headers:{Authorization:`Bearer ${session.accessToken}`}});return sendJson(res,200,{conversations:(rows||[]).map(r=>({id:r.conversation_id,title:r.title,messages:r.messages,updatedAt:r.updated_at}))});}
  if(method==='POST'){const b=readBody(req);const id=clean(b.id,40,'Conversation ID');if(!/^[a-f0-9-]{20,40}$/i.test(id))return sendJson(res,400,{error:'Conversation ID format invalid hai.'});const title=clean(b.title||'New conversation',120,'Title');const messages=validMessages(b.messages);const rows=await supabaseRequest(`${base}?on_conflict=owner_id,mode,conversation_id&select=conversation_id,title,messages,updated_at`,{method:'POST',headers:{Authorization:`Bearer ${session.accessToken}`,Prefer:'resolution=merge-duplicates,return=representation'},body:JSON.stringify({mode,conversation_id:id,title,messages})});const r=rows[0];return sendJson(res,200,{conversation:r?{id:r.conversation_id,title:r.title,messages:r.messages,updatedAt:r.updated_at}:{id,title,messages}});}
  if(method==='DELETE'){const id=clean(getQuery(req,'id'),40,'Conversation ID');await supabaseRequest(`${base}?mode=eq.${mode}&conversation_id=eq.${encodeURIComponent(id)}`,{method:'DELETE',headers:{Authorization:`Bearer ${session.accessToken}`,Prefer:'return=minimal'}});return sendJson(res,200,{deleted:true,id});}
  res.setHeader('Allow','GET, POST, PUT, DELETE');return sendJson(res,405,{error:'Method not allowed.'});
 }catch(e){return sendJson(res,e.status||500,{error:e.message||'Cloud AI history request failed.'});}
};
