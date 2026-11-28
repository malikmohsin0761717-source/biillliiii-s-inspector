'use strict';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
let signupMode = false;
let recoveryMode = false;
let currentUser = null;
const chats = {
  chatbot: { id: '', title: 'New conversation', messages: [] },
  teacher: { id: '', title: 'New lesson', messages: [] }
};
const histories = { chatbot: [], teacher: [] };
let projects = [];

async function api(url, options = {}) {
  const method = String(options.method || 'GET').toUpperCase();
  const headers = { ...(options.headers || {}) };
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) headers['X-Requested-With'] = 'BiillliiiiInspector';
  if (options.body) headers['Content-Type'] = 'application/json';
  const response = await fetch(url, { ...options, headers, credentials: 'same-origin', cache: 'no-store' });
  const type = response.headers.get('content-type') || '';
  const payload = type.includes('application/json') ? await response.json() : {};
  if (!response.ok) throw Object.assign(new Error(payload.error || 'Request failed (' + response.status + ').'), { status: response.status, code: payload.code });
  return payload;
}
function message(target, text, isError = false) {
  target.textContent = text;
  target.classList.toggle('error', isError);
}
function showSignedIn(user) {
  currentUser = user;
  $('#authPanel').classList.add('hidden');
  $('#workspacePanel').classList.remove('hidden');
  $('#accountEmail').textContent = user?.email || 'Signed in';
  void initializeWorkspace();
}
function showSignedOut() {
  currentUser = null;
  $('#workspacePanel').classList.add('hidden');
  $('#authPanel').classList.remove('hidden');
}
function setAuthMode(signup) {
  signupMode = signup; recoveryMode = false;
  $('#authTitle').textContent = signup ? 'Create cloud account' : 'Cloud sign in';
  $('#authSubmit').textContent = signup ? 'Create account' : 'Log in';
  $('#emailField').classList.remove('hidden'); $('#email').required = true;
  $('#googleLogin').classList.remove('hidden'); $('#passwordField').classList.remove('hidden');
  $('#passwordField').firstChild.textContent = 'Password';
  $('#confirmField').classList.add('hidden');
  $('#password').autocomplete = signup ? 'new-password' : 'current-password';
  $('#password').minLength = signup ? 12 : 1;
  $('#confirmPassword').minLength = 12;
  $('#password').value = ''; $('#confirmPassword').value = '';
  $('#toggleAuth').classList.remove('hidden'); $('#forgotPassword').classList.toggle('hidden', signup);
  $('#authMessage').textContent = ''; $('#password').required = true; $('#confirmPassword').required = false;
}
function showRecoveryForm() {
  signupMode = false; recoveryMode = true; showSignedOut();
  $('#authTitle').textContent = 'Set a new cloud password';
  $('#emailField').classList.add('hidden'); $('#email').required = false;
  $('#googleLogin').classList.add('hidden'); $('#passwordField').classList.remove('hidden');
  $('#passwordField').firstChild.textContent = 'New password'; $('#confirmField').classList.remove('hidden');
  $('#authSubmit').textContent = 'Update password'; $('#toggleAuth').classList.add('hidden'); $('#forgotPassword').classList.add('hidden');
  $('#password').value = ''; $('#confirmPassword').value = ''; $('#password').minLength = 12; $('#confirmPassword').minLength = 12; $('#password').required = true; $('#confirmPassword').required = true;
  message($('#authMessage'), 'Naya password 12–128 characters ka hona chahiye.');
}
function showView(name) {
  $$('[data-panel]').forEach(panel => panel.classList.toggle('hidden', panel.dataset.panel !== name));
  $$('.nav-item').forEach(button => button.classList.toggle('active', button.dataset.view === name));
  if (name === 'projects') void loadProjects();
  if (name === 'chatbot' || name === 'teacher') void loadHistory(name);
  if (name === 'teacher') void loadProgress();
  if (name === 'inspector') void loadProjects();
  if (['records','chats','important','stopped','reminders','alerts','reports','settings'].includes(name)) void loadDocumentsForView(name);
}
function makeId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  const bytes = new Uint8Array(16); window.crypto.getRandomValues(bytes);
  return Array.from(bytes).map(x => x.toString(16).padStart(2,'0')).join('');
}
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function renderProjects() {
  const list = $('#projectsList'); list.replaceChildren();
  const select = $('#inspectorProject'); select.replaceChildren(new Option('Choose a project',''));
  projects.forEach(project => {
    select.add(new Option(project.id + ' · ' + project.name, project.id));
    const card = el('article','item');
    const top = el('div','item-top'); top.append(el('b','',project.id + ' · ' + project.name));
    const actions = el('div','item-actions');
    const edit = el('button','secondary','Edit'); edit.type='button';
    edit.addEventListener('click',()=>{ $('#projectId').value=project.id; $('#projectName').value=project.name; $('#projectStatus').value=project.status||'Planning'; $('#projectGoal').value=project.goal||''; window.scrollTo({top:0,behavior:'smooth'}); });
    const del = el('button','delete','Delete'); del.type='button';
    del.addEventListener('click',async()=>{ if(!window.confirm('Cloud project '+project.id+' delete karna hai? Local project is se delete nahi hoga.')) return; del.disabled=true; try{ await api('/api/cloud-projects?id='+encodeURIComponent(project.id),{method:'DELETE'}); await loadProjects(); message($('#projectMessage'),'Cloud project delete ho gaya.'); }catch(e){message($('#projectMessage'),e.message,true);del.disabled=false;} });
    actions.append(edit,del); top.append(actions);
    card.append(top,el('small','',String(project.status||'Planning')),el('p','muted',String(project.goal||'No goal added.')));
    list.append(card);
  });
  if(!projects.length) list.append(el('p','muted','Abhi koi cloud project save nahi.'));
  $('#statProjects').textContent=String(projects.length);
}
async function loadProjects() {
  try { const result=await api('/api/cloud-projects'); projects=Array.isArray(result.projects)?result.projects:[]; renderProjects(); }
  catch(e){ $('#projectsList').replaceChildren(el('p','muted',e.message)); if(e.status===401) showSignedOut(); }
}
async function saveProject(event) {
  event.preventDefault();
  const project={id:$('#projectId').value.trim(),name:$('#projectName').value.trim(),status:$('#projectStatus').value,goal:$('#projectGoal').value.trim()};
  const button=$('#projectForm button[type="submit"]'); button.disabled=true;
  try{ await api('/api/cloud-projects',{method:'POST',body:JSON.stringify({project})}); $('#projectForm').reset(); message($('#projectMessage'),'Project cloud workspace mein save ho gaya.'); await loadProjects(); }
  catch(e){message($('#projectMessage'),e.message,true);}
  finally{button.disabled=false;}
}
async function runInspection() {
  const project=projects.find(p=>p.id===$('#inspectorProject').value);
  if(!project){message($('#inspectionMessage'),'Pehle project select karein.',true);return;}
  const button=$('#runInspection');button.disabled=true;$('#inspectionResult').textContent='';
  message($('#inspectionMessage'),'Project evidence AI Inspector ko bheji ja rahi hai…');
  try{
    const context='Project data (owner-selected cloud record):\n'+JSON.stringify(project).slice(0,6500)+'\n\nInspection task: '+$('#inspectionPrompt').value.trim();
    const result=await api('/api/cloud-ai?mode=analyst&resource=respond',{method:'POST',body:JSON.stringify({messages:[{role:'user',content:context}]})});
    $('#inspectionResult').textContent=result.message;message($('#inspectionMessage'),'Read-only inspection complete. Evidence sirf selected project record se li gayi.');
  }catch(e){message($('#inspectionMessage'),e.code==='AI_DISABLED'?'Cloud AI abhi server par enabled nahi. API request nahi bheji gayi.':e.message,true);}
  finally{button.disabled=false;}
}
function renderChat(mode) {
  const list=$('#'+mode+'Messages');list.replaceChildren();
  const conversation=chats[mode];
  if(!conversation.messages.length){list.append(el('p','muted',mode==='teacher'?'Aik lesson ka sawal likhein. Teacher simple Roman Urdu mein guide karega.':'Sawal likhein; Chatbot general help aur project discussion mein madad karega.'));return;}
  conversation.messages.forEach(item=>{
    const bubble=el('article','chat-bubble '+item.role);
    bubble.append(el('small','',item.role==='user'?'You':mode==='teacher'?'AI Teacher':'AI Chatbot'),el('p','',item.content));
    list.append(bubble);
  });
  list.scrollTop=list.scrollHeight;
}
async function loadHistory(mode) {
  const select=$('#'+mode+'History');
  try{
    const result=await api('/api/cloud-ai?mode='+mode);
    histories[mode]=Array.isArray(result.conversations)?result.conversations:[];
    select.replaceChildren(new Option(mode==='teacher'?'New lesson':'New conversation',''));
    histories[mode].forEach(item=>select.add(new Option(item.title,item.id)));
    $('#statChats').textContent=String(histories.chatbot.length+histories.teacher.length);
  }catch(e){message($('#'+mode+'Message'),e.message,true);if(e.status===401)showSignedOut();}
}
function newConversation(mode) {
  chats[mode]={id:makeId(),title:mode==='teacher'?'New lesson':'New conversation',messages:[]};
  $('#'+mode+'History').value='';renderChat(mode);message($('#'+mode+'Message'),'Nayi conversation shuru ho gayi.');
}
async function deleteConversation(mode) {
  const id=$('#'+mode+'History').value;
  if(!id)return message($('#'+mode+'Message'),'Pehle history se conversation select karein.',true);
  if(!window.confirm('Ye cloud conversation aur iski messages delete karni hain?'))return;
  const button=$('#delete'+(mode==='chatbot'?'Chatbot':'Teacher'));button.disabled=true;
  try{
    await api('/api/cloud-ai?mode='+mode+'&id='+encodeURIComponent(id),{method:'DELETE'});
    newConversation(mode);
    await loadHistory(mode);
    $('#'+mode+'History').value='';
    message($('#'+mode+'Message'),'Conversation cloud history se delete ho gayi.');
  }catch(e){message($('#'+mode+'Message'),e.message,true);}
  finally{button.disabled=false;}
}
async function selectConversation(mode,id) {
  if(!id){newConversation(mode);return;}
  const item=histories[mode].find(c=>c.id===id);
  if(!item)return;
  chats[mode]={id:item.id,title:item.title,messages:Array.isArray(item.messages)?item.messages:[]};
  renderChat(mode);
}
async function persistConversation(mode) {
  const c=chats[mode];
  if(!c.id)c.id=makeId();
  if(c.title==='New conversation'||c.title==='New lesson'){
    const first=c.messages.find(m=>m.role==='user');
    if(first)c.title=first.content.slice(0,70);
  }
  await api('/api/cloud-ai?mode='+mode,{method:'POST',body:JSON.stringify({id:c.id,title:c.title,messages:c.messages.slice(-200)})});
  await loadHistory(mode);
  $('#'+mode+'History').value=c.id;
}
async function sendChat(mode,event) {
  event.preventDefault();
  const input=$('#'+mode+'Input');const prompt=input.value.trim();if(!prompt)return;
  const button=$('#'+mode+'Form button');button.disabled=true;input.disabled=true;
  const c=chats[mode];c.messages.push({role:'user',content:prompt,createdAt:new Date().toISOString()});input.value='';renderChat(mode);
  message($('#'+mode+'Message'),'AI response tayyar ho raha hai…');
  try{
    const result=await api('/api/cloud-ai?mode='+mode+'&resource=respond',{method:'POST',body:JSON.stringify({messages:c.messages.slice(-40)})});
    c.messages.push({role:'assistant',content:result.message,createdAt:new Date().toISOString()});
    await persistConversation(mode);renderChat(mode);message($('#'+mode+'Message'),'Response aur conversation history save ho gayi.');
  }catch(e){
    // Keep the user's own prompt in cloud history even when AI is unavailable.
    try { await persistConversation(mode); } catch (saveError) {
      message($('#'+mode+'Message'),e.message+' | User message save bhi nahi ho saka: '+saveError.message,true);
      renderChat(mode);
      return;
    }
    if(e.code==='AI_DISABLED') message($('#'+mode+'Message'),'Aapka sawal history mein save ho gaya. Cloud AI abhi server par enabled nahi; paid API request nahi bheji gayi.',true);
    else message($('#'+mode+'Message'),e.message+' | Aapka sawal history mein save ho gaya.',true);
    renderChat(mode);
  }finally{button.disabled=false;input.disabled=false;input.focus();}
}
async function loadProgress() {
  try{
    const result=await api('/api/cloud-ai?mode=teacher&resource=progress');
    const p=result.progress||{};
    $('#teacherGoals').value=(p.goals||[]).join('\n');
    $('#teacherLessons').value=(p.completedLessons||[]).join('\n');
    $('#teacherNotes').value=p.notes||'';
  }catch(e){message($('#progressMessage'),e.message,true);}
}
async function saveProgress() {
  const button=$('#saveProgress');button.disabled=true;
  try{
    const goals=$('#teacherGoals').value.split('\n').map(x=>x.trim()).filter(Boolean);
    const completedLessons=$('#teacherLessons').value.split('\n').map(x=>x.trim()).filter(Boolean);
    const result=await api('/api/cloud-ai?mode=teacher&resource=progress',{method:'PUT',body:JSON.stringify({goals,completedLessons,notes:$('#teacherNotes').value})});
    message($('#progressMessage'),'Learning progress owner-only cloud storage mein save ho gayi.');
  }catch(e){message($('#progressMessage'),e.message,true);}
  finally{button.disabled=false;}
}
const viewDocs = new Map();
function docPrefix(view){return view==='records'?'records':view==='chats'?'chats':view==='important'?'important':view==='stopped'?'stopped':view==='reminders'?'reminders':view==='alerts'?'alerts':view==='reports'?'reports':'settings';}
function docType(view){return view==='important'?'important':view==='reminders'?'reminders':view==='alerts'?'alerts':view==='settings'?'settings':'workspace';}
function ensureDocumentEditor(view) {
  const host=$('[data-panel="'+view+'"] .document-editor');if(!host||host.dataset.ready)return;
  host.dataset.ready='1';
  const form=el('form','document-form');
  const key=el('input');key.id=view+'DocKey';key.maxLength=120;key.required=true;key.placeholder='Title / unique key';
  const keyLabel=el('label','','Title / key');keyLabel.append(key);
  const payload=el('textarea');payload.id=view+'DocPayload';payload.rows=6;payload.value='{}';payload.required=true;
  const payloadLabel=el('label','','JSON data');payloadLabel.append(payload);
  const save=el('button','primary','Save item');save.type='submit';
  const status=el('p','message');status.id=view+'DocMessage';
  const list=el('div','items');list.id=view+'DocList';
  form.append(keyLabel,payloadLabel,save);form.addEventListener('submit',async event=>{
    event.preventDefault();save.disabled=true;
    try{
      const data=JSON.parse(payload.value||'{}');if(!data||typeof data!=='object'||Array.isArray(data))throw new Error('JSON data aik object hona chahiye.');
      const documentKey=docPrefix(view)+'-'+key.value.trim();
      await api('/api/cloud-documents',{method:'POST',body:JSON.stringify({documentType:docType(view),documentKey,payload:data})});
      message(status,'Item save ho gaya.');await loadDocumentsForView(view);form.reset();payload.value='{}';
    }catch(e){message(status,e.message,true);}finally{save.disabled=false;}
  });
  host.append(form,status,list);
}
async function loadDocumentsForView(view) {
  ensureDocumentEditor(view);
  const list=$('#'+view+'DocList');if(!list)return;
  try{
    const result=await api('/api/cloud-documents?type='+docType(view));
    const prefix=docPrefix(view)+'-';
    const docs=(result.documents||[]).filter(d=>String(d.document_key).startsWith(prefix));
    viewDocs.set(view,docs);list.replaceChildren();
    if(!docs.length)list.append(el('p','muted','Abhi koi saved item nahi.'));
    docs.forEach(doc=>{
      const card=el('article','item');const top=el('div','item-top');top.append(el('b','',doc.document_key.slice(prefix.length)));
      const actions=el('div','item-actions');
      const edit=el('button','secondary','Edit');edit.type='button';
      edit.addEventListener('click',()=>{const keyInput=$('#'+view+'DocKey');const payloadInput=$('#'+view+'DocPayload');if(keyInput)keyInput.value=doc.document_key.slice(prefix.length);if(payloadInput)payloadInput.value=JSON.stringify(doc.payload,null,2);const saveForm=$('[data-panel="'+view+'"] .document-form');saveForm?.scrollIntoView({behavior:'smooth',block:'center'});});
      const del=el('button','delete','Delete');del.type='button';
      del.addEventListener('click',async()=>{if(!window.confirm('Sirf is cloud item ko delete karna hai?'))return;del.disabled=true;try{await api('/api/cloud-documents?type='+docType(view)+'&key='+encodeURIComponent(doc.document_key),{method:'DELETE'});await loadDocumentsForView(view);}catch(e){message($('#'+view+'DocMessage'),e.message,true);del.disabled=false;}});
      actions.append(edit,del);top.append(actions);const pre=el('pre','',JSON.stringify(doc.payload,null,2));card.append(top,pre);list.append(card);
    });
    $('#statDocs').textContent=String(viewDocs.size);
  }catch(e){list.replaceChildren(el('p','muted',e.message));if(e.status===401)showSignedOut();}
}
async function generateReport() {
  const button=$('#generateReport');button.disabled=true;
  try{
    await loadProjects();
    const report={generatedAt:new Date().toISOString(),projectCount:projects.length,projects:projects.map(p=>({id:p.id,name:p.name,status:p.status,goal:p.goal||''})),note:'Generated from cloud project records only; local monitoring and local files are not included.'};
    const key='reports-'+new Date().toISOString().replace(/[:.]/g,'-');
    await api('/api/cloud-documents',{method:'POST',body:JSON.stringify({documentType:'workspace',documentKey:key,payload:report})});
    $('#reportResult').textContent=JSON.stringify(report,null,2);
    message($('#reportsDocMessage'),'Report cloud storage mein save ho gayi.');
    await loadDocumentsForView('reports');
  }catch(e){$('#reportResult').textContent='';message($('#reportsDocMessage')||$('#reportResult'),e.message,true);}
  finally{button.disabled=false;}
}
async function initializeWorkspace() {
  await loadProjects();
  await Promise.all(['records','chats','important','stopped','reminders','alerts','reports','settings'].map(loadDocumentsForView));
  $('#statChats').textContent=String(histories.chatbot.length+histories.teacher.length);
}
$('#authForm').addEventListener('submit',async event=>{
  event.preventDefault();const button=$('#authSubmit');button.disabled=true;
  message($('#authMessage'),recoveryMode?'Password update ho raha hai…':signupMode?'Account create ho raha hai…':'Login check ho raha hai…');
  try{
    if(recoveryMode){
      const password=$('#password').value;
      if(password.length<12||password.length>128||password!==$('#confirmPassword').value)throw new Error('Password 12–128 characters ka ho aur dono fields match karein.');
      await api('/api/cloud-auth/update-password',{method:'POST',body:JSON.stringify({password})});
      recoveryMode=false;setAuthMode(false);message($('#authMessage'),'Password update ho gaya. Ab naye password se login karein.');return;
    }
    const result=await api(signupMode?'/api/cloud-auth/signup':'/api/cloud-auth/login',{method:'POST',body:JSON.stringify({email:$('#email').value.trim(),password:$('#password').value})});
    if(signupMode&&result.confirmationRequired)message($('#authMessage'),'Signup request process hui. Agar is email par pehle se account hai to dobara signup se nayi mail nahi aati — Log in ya Forgot password use karein. Naye account ke liye inbox aur spam folder check karein.');
    else {const status=await api('/api/cloud-auth/status');if(status.authenticated)showSignedIn(status.user);}
  }catch(e){const friendly=/invalid login credentials/i.test(e.message)?'Email ya password match nahi hua. Password yaad nahi to Forgot password use karein.':e.message;message($('#authMessage'),friendly,true);}
  finally{button.disabled=false;}
});
document.addEventListener('click',event=>{
  const toggle=event.target.closest('[data-password-toggle]');if(!toggle)return;
  const input=document.getElementById(toggle.dataset.passwordToggle);if(!input)return;
  const reveal=input.type==='password';input.type=reveal?'text':'password';toggle.textContent=reveal?'Hide':'Show';
  toggle.setAttribute('aria-label',(reveal?'Hide ':'Show ')+(toggle.dataset.passwordToggle==='password'?'password':'confirmation password'));
});
$('#toggleAuth').addEventListener('click',()=>setAuthMode(!signupMode));
$('#forgotPassword').addEventListener('click',async()=>{
  const email=$('#email').value.trim();if(!email)return message($('#authMessage'),'Pehle email address likhein.',true);
  try{await api('/api/cloud-auth/recover',{method:'POST',body:JSON.stringify({email})});message($('#authMessage'),'Agar account mojood hai to password reset email request process hui.');}
  catch(e){message($('#authMessage'),e.message,true);}
});
$('#logoutButton').addEventListener('click',async()=>{try{await api('/api/cloud-auth/logout',{method:'POST',body:'{}'});}catch{}showSignedOut();setAuthMode(false);});
$$('.nav-item').forEach(button=>button.addEventListener('click',()=>showView(button.dataset.view)));
$('#projectForm').addEventListener('submit',saveProject);
$('#refreshProjects').addEventListener('click',()=>void loadProjects());
$('#runInspection').addEventListener('click',runInspection);
$('#chatbotForm').addEventListener('submit',event=>void sendChat('chatbot',event));
$('#teacherForm').addEventListener('submit',event=>void sendChat('teacher',event));
$('#newChatbot').addEventListener('click',()=>newConversation('chatbot'));
$('#deleteChatbot').addEventListener('click',()=>void deleteConversation('chatbot'));
$('#newTeacher').addEventListener('click',()=>newConversation('teacher'));
$('#deleteTeacher').addEventListener('click',()=>void deleteConversation('teacher'));
$('#chatbotHistory').addEventListener('change',event=>void selectConversation('chatbot',event.target.value));
$('#teacherHistory').addEventListener('change',event=>void selectConversation('teacher',event.target.value));
$('#saveProgress').addEventListener('click',saveProgress);
$('#generateReport').addEventListener('click',generateReport);
async function initialize() {
  try{
    const hash=new URLSearchParams(window.location.hash.slice(1));
    const query=new URLSearchParams(window.location.search);
    const authType=hash.get('type')||query.get('type');
    const tokenHash=query.get('token_hash');
    if(tokenHash&&authType){
      const exchanged=await api('/api/cloud-auth/session-exchange',{method:'POST',body:JSON.stringify({token_hash:tokenHash,type:authType})});
      window.history.replaceState({},'','/');
      if(authType==='recovery'){showRecoveryForm();return;}
      showSignedIn(exchanged.user);message($('#authMessage'),'Email verify ho gaya. Aapka cloud account active hai.');return;
    }
    if(['recovery','signup','invite','magiclink','email'].includes(authType)&&hash.get('access_token')&&hash.get('refresh_token')){
      const exchanged=await api('/api/cloud-auth/session-exchange',{method:'POST',body:JSON.stringify({access_token:hash.get('access_token'),refresh_token:hash.get('refresh_token'),expires_in:hash.get('expires_in')})});
      window.history.replaceState({},'','/');
      if(authType==='recovery'){showRecoveryForm();return;}
      showSignedIn(exchanged.user);message($('#authMessage'),'Email verify ho gaya. Aapka cloud account active hai.');return;
    }
    const status=await api('/api/cloud-auth/status');
    if(status.authenticated)showSignedIn(status.user);else showSignedOut();
  }catch(e){showSignedOut();message($('#authMessage'),e.message,true);}
}
void initialize();
