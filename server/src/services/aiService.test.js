const test = require('node:test');
const assert = require('node:assert/strict');
const { buildSystemPrompt } = require('./aiService');

test('buildSystemPrompt allows the assistant to answer general questions while staying helpful', () => {
    const prompt = buildSystemPrompt();

    assert.ok(prompt.includes('helpful assistant'));
    assert.ok(prompt.includes('Answer the user\'s question directly'));
    assert.ok(prompt.includes('startup coach'));
});
