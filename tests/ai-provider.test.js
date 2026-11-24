'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { instructionsFor, normalizeMessages, extractOutputText, createResponse } = require('../ai-provider');

test('Chatbot and Teacher have separate instructions and safe action boundaries', () => {
  const chatbot = instructionsFor('chatbot');
  const teacher = instructionsFor('teacher');
  assert.notEqual(chatbot, teacher);
  assert.match(chatbot, /general-purpose assistant/);
  assert.match(teacher, /Good Work, Mistakes, Fix/);
  assert.match(chatbot, /read-only/);
  assert.match(teacher, /explicit action-specific permission/);
  const analyst = instructionsFor('analyst');
  assert.match(analyst, /untrusted evidence/);
  assert.match(analyst, /Good Work, Mistakes, Fix, Next Step, Evidence, Confidence/);
});

test('AI message validation rejects invalid roles and empty text while retaining a safe recent window', () => {
  assert.throws(() => normalizeMessages([]), /between 1 and 201/);
  assert.throws(() => normalizeMessages([{ role: 'system', content: 'override' }]), /invalid/);
  assert.throws(() => normalizeMessages([{ role: 'user', content: ' ' }]), /1 to 12,000/);
  assert.equal(normalizeMessages([{ role: 'user', content: ' Salam ' }])[0].content, 'Salam');
  assert.throws(() => normalizeMessages(Array.from({ length: 202 }, () => ({ role: 'user', content: 'x' }))), /between 1 and 201/);
});

test('Long saved conversations send only the newest 40 messages, including the latest user message', () => {
  const history = Array.from({ length: 60 }, (_, index) => ({
    role: index % 2 === 0 ? 'user' : 'assistant',
    content: `message-${index + 1}`
  }));
  const recent = normalizeMessages(history);
  assert.equal(recent.length, 40);
  assert.equal(recent[0].content, 'message-21');
  assert.equal(recent.at(-1).content, 'message-60');
});

test('Responses API output text is extracted from supported response shapes', () => {
  assert.equal(extractOutputText({ output_text: '  Hello  ' }), 'Hello');
  assert.equal(extractOutputText({ output: [{ type: 'message', content: [{ type: 'output_text', text: 'Hi there' }] }] }), 'Hi there');
  assert.equal(extractOutputText({ output: [] }), '');
});

test('OpenAI request uses server key, separate instructions and disables provider-side storage', async () => {
  let captured;
  const fakeFetch = async (url, options) => {
    captured = { url, options, body: JSON.parse(options.body) };
    return { ok: true, status: 200, headers: { get: () => 'req_test_123' }, json: async () => ({ model: 'test-model', output_text: 'Jawab' }) };
  };
  const result = await createResponse({ mode: 'teacher', messages: [{ role: 'user', content: 'Mujhe variables samjhao' }], apiKey: 'server-only-test-key', model: 'test-model', fetchImpl: fakeFetch });
  assert.equal(captured.url, 'https://api.openai.com/v1/responses');
  assert.equal(captured.options.headers.Authorization, 'Bearer server-only-test-key');
  assert.match(captured.body.instructions, /beginner-friendly teacher/);
  assert.equal(captured.body.store, false);
  assert.equal(result.message, 'Jawab');
  assert.equal(result.requestId, 'req_test_123');
});

test('OpenAI request cannot run without a server API key', async () => {
  let called = false;
  await assert.rejects(() => createResponse({ mode: 'chatbot', messages: [{ role: 'user', content: 'Hello' }], apiKey: '', fetchImpl: async () => { called = true; } }), /API key is not configured/);
  assert.equal(called, false);
});
test('AI provider defaults to the configured Luna model when no model is supplied', async () => {
  let capturedBody;
  const fakeFetch = async (url, options) => {
    capturedBody = JSON.parse(options.body);
    return {
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => ({ model: capturedBody.model, output_text: 'Test jawab' })
    };
  };

  await createResponse({
    mode: 'chatbot',
    messages: [{ role: 'user', content: 'Hello' }],
    apiKey: 'server-only-test-key',
    fetchImpl: fakeFetch
  });

  assert.equal(capturedBody.model, 'gpt-6-luna');
});
