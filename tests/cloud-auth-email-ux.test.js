'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const route=fs.readFileSync(path.join(root,'api','cloud-auth','[action].js'),'utf8');
const local=fs.readFileSync(path.join(root,'cloud-auth.js'),'utf8');
const html=fs.readFileSync(path.join(root,'cloud','index.html'),'utf8');
const app=fs.readFileSync(path.join(root,'cloud','app.js'),'utf8');
test('hosted signup sends a same-site email confirmation redirect',()=>{
 assert.ok(route.includes('emailRedirectTo:'));
 assert.ok(route.includes('Secure HTTPS origin required for email confirmation'));
});
test('password recovery sends a same-site redirect and retains the recovery session flow',()=>{
 assert.ok(route.includes('/auth/v1/recover?redirect_to='));
 assert.ok(route.includes('recovery-session'));
 assert.ok(route.includes('update-password'));
 assert.ok(local.includes('/auth/v1/recover?redirect_to='));
});
test('cloud login and signup provide accessible password visibility controls',()=>{
 assert.ok(html.includes('data-password-toggle="password"'));
 assert.ok(html.includes('data-password-toggle="confirmPassword"'));
 assert.ok(app.includes("input.type=reveal?'text':'password'"));
 assert.ok(html.includes('minlength="1" maxlength="128" required'));
 assert.ok(app.includes("$('#password').minLength = signup ? 12 : 1"));
 assert.ok(html.includes('id="googleLogin" class="secondary google" type="button" disabled'));
 assert.ok(app.includes('dobara signup se nayi mail nahi aati'));
 assert.ok(app.includes("setAttribute('aria-label'"));
});
