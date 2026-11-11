/**
 * Test Suite: Gemini Output Sanitizer & Single Sentence Validator
 * Validates Requirement 6: Use Google Gemini to analyze bio and company
 * Validates Requirement 7: Generate exactly one sentence explaining why user is a valuable lead
 */

/**
 * Sanitizes and enforces single-sentence constraint on LLM output
 * @param {string} rawText - Raw text output from Gemini API
 * @returns {string} Exactly one clean sentence
 */
function sanitizeGeminiPitch(rawText, fallbackLeadInfo) {
  if (!rawText || typeof rawText !== 'string' || rawText.trim().length === 0) {
    return `${fallbackLeadInfo.name || fallbackLeadInfo.login} is a high-impact developer with strong community reach and active repository engagement.`;
  }

  // 1. Remove markdown formatting like bold, italics, code ticks, wrapping quotes
  let cleaned = rawText
    .replace(/^["'`\s]+|["'`\s]+$/g, '') // remove outer quotes
    .replace(/\*\*/g, '')               // remove bold
    .replace(/\n+/g, ' ')               // replace newlines with spaces
    .replace(/^(Here is (why|the|a).*?:|Why they are a lead:|Lead analysis:|Reason:)\s*/i, '') // remove common preambles
    .trim();

  // 2. Extract strictly the first complete sentence
  const sentenceMatch = cleaned.match(/^([^.!?]+[.!?])/);
  if (sentenceMatch && sentenceMatch[1]) {
    cleaned = sentenceMatch[1].trim();
  } else if (!/[.!?]$/.test(cleaned)) {
    cleaned += '.';
  }

  return cleaned;
}

function runSanitizerTests() {
  console.log('--- Running Gemini Output Sanitizer Tests ---');

  const testCases = [
    {
      name: 'Clean single sentence with quotes',
      input: '"As Staff Platform Architect at CyberdyneAI with 450 followers, Sarah possesses direct decision-making authority over enterprise infrastructure adoption."',
      expected: 'As Staff Platform Architect at CyberdyneAI with 450 followers, Sarah possesses direct decision-making authority over enterprise infrastructure adoption.'
    },
    {
      name: 'Multi-sentence output (strict single sentence extraction)',
      input: 'Alex maintains 82 public repositories in the developer tooling space. This indicates deep domain expertise and high organic reach among engineers. They would make an excellent design partner.',
      expected: 'Alex maintains 82 public repositories in the developer tooling space.'
    },
    {
      name: 'Output with conversational preamble and bolding',
      input: 'Here is why this user is a valuable lead: **Elena Rostova** leads technical infrastructure at DevFlowHQ and has built pipelines for over a million engineers, making her an ideal enterprise buyer.',
      expected: 'Elena Rostova leads technical infrastructure at DevFlowHQ and has built pipelines for over a million engineers, making her an ideal enterprise buyer.'
    },
    {
      name: 'Missing terminal punctuation',
      input: 'With 1,250 followers and executive leadership at DevFlowHQ, Elena is a prime prospect for enterprise developer acceleration tools',
      expected: 'With 1,250 followers and executive leadership at DevFlowHQ, Elena is a prime prospect for enterprise developer acceleration tools.'
    },
    {
      name: 'Empty / Null fallback handling',
      input: '',
      fallback: { name: 'Sarah Connor', login: 'sarah-lead' },
      expected: 'Sarah Connor is a high-impact developer with strong community reach and active repository engagement.'
    }
  ];

  let passed = 0;
  for (const tc of testCases) {
    const result = sanitizeGeminiPitch(tc.input, tc.fallback || {});
    if (result === tc.expected) {
      console.log(`  ✅ [PASS] ${tc.name}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${tc.name}\n     Got:      "${result}"\n     Expected: "${tc.expected}"`);
    }
  }

  console.log(`\nResults: ${passed} passed out of ${testCases.length} tests.`);
  if (passed !== testCases.length) {
    throw new Error('Gemini sanitizer test failed.');
  }

  console.log('✨ All Gemini Output Sanitizer Tests Passed Successfully!\n');
}

runSanitizerTests();
