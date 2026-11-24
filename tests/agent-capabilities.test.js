'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {parseDesktopEvidence}=require('../monitoring/desktop-inspector-core');
const root=path.resolve(__dirname,'..');

test('desktop UIA evidence parser accepts only explicit bounded status and text fields',()=>{
  const parsed=parseDesktopEvidence(JSON.stringify({status:'captured',app:'notepad',text:'Visible heading',capturedAt:'2026-11-18T12:00:00Z',windowTitle:'must-not-be-forwarded'}));
  assert.equal(parsed.status,'captured');assert.equal(parsed.app,'notepad');assert.equal(parsed.text,'Visible heading');
  assert.equal(Object.hasOwn(parsed,'windowTitle'),false);
  assert.throws(()=>parseDesktopEvidence('{bad json'),/valid JSON/);
  assert.throws(()=>parseDesktopEvidence({status:'running',app:'x'}),/status invalid/);
});

test('desktop UIA script requires approved app names and excludes sensitive controls without reading values',()=>{
  const script=fs.readFileSync(path.join(root,'monitoring','desktop-inspector.ps1'),'utf8');
  assert.match(script,/ApprovedApps/);assert.match(script,/not-approved/);assert.match(script,/\$current\.IsPassword/i);
  assert.match(script,/ControlType\.Text/);assert.doesNotMatch(script,/SendKeys|GetAsyncKeyState|Clipboard|Screenshot|WindowTitle/i);
});

test('Chrome extension is manual-only, requests per-origin permission and blocks forms/sensitive pages',()=>{
  const manifest=JSON.parse(fs.readFileSync(path.join(root,'browser-extension','manifest.json'),'utf8'));
  const popup=fs.readFileSync(path.join(root,'browser-extension','popup.js'),'utf8');
  assert.equal(manifest.manifest_version,3);assert.ok(manifest.permissions.includes('activeTab'));assert.ok(manifest.permissions.includes('scripting'));
  assert.ok(Array.isArray(manifest.optional_host_permissions));assert.equal(Object.hasOwn(manifest,'content_scripts'),false);assert.equal(Object.hasOwn(manifest,'background'),false);
  assert.match(popup,/chrome\.permissions\.request/);assert.match(popup,/chrome\.permissions\.remove/);assert.match(popup,/document\.querySelector\('form'\)/);
  assert.match(popup,/source: 'browser-extension'/);assert.doesNotMatch(popup,/setInterval|setTimeout|clipboardRead|navigator\.clipboard\.read/i);
});
