const test = require('node:test');
const assert = require('node:assert/strict');
const { analyzeIdea, mergeProductInsights } = require('./analysisService');

test('analyzeIdea returns a structured market report from conversation messages', async () => {
    const messages = [
        { sender: 'user', text: 'I want to build an AI-powered tool for local restaurants to automate bookings and reduce no-shows.' },
        { sender: 'bot', text: 'That sounds promising. The core users are restaurant owners who need better booking management.' }
    ];

    const report = await analyzeIdea(messages);

    assert.ok(report);
    assert.equal(typeof report.opportunityScore, 'number');
    assert.ok(report.verdict && report.verdict.length > 0);
    assert.ok(Array.isArray(report.competitors));
    assert.ok(Array.isArray(report.marketGaps));
    assert.ok(report.swot && typeof report.swot === 'object');
    assert.ok(Array.isArray(report.roadmap));
});

test('mergeProductInsights enriches the report with Product Hunt data', () => {
    const report = mergeProductInsights({
        competitors: [],
        marketGaps: []
    }, {
        data: {
            posts: {
                edges: [
                    { node: { name: 'ChefOps', tagline: 'AI bookings for restaurants' } }
                ]
            }
        }
    });

    assert.ok(report.competitors.includes('ChefOps'));
    assert.ok(report.marketGaps.includes('Opportunity to differentiate with deeper restaurant-specific workflows'));
});
