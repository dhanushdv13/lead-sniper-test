/**
 * Test Suite: Exact Qualification Gate Logic
 * Validates Requirement 4: followers > 100 OR public_repos > 50
 * Validates Requirement 5: Stop processing users who do not qualify
 */

const fs = require('fs');
const path = require('path');

/**
 * Qualification predicate matching n8n IF node condition
 * @param {Object} profile - User profile data
 * @returns {boolean} True if qualified, false if disqualified
 */
function evaluateQualification(profile) {
  const followers = Number(profile.followers) || 0;
  const repos = Number(profile.public_repos) || 0;

  // Strict rule: followers > 100 OR public_repos > 50
  return followers > 100 || repos > 50;
}

function runQualificationTests() {
  console.log('--- Running Qualification Filter & Boundary Tests ---');

  const mockProfilesPath = path.join(__dirname, '../tests/mock_profiles.json');
  const profiles = JSON.parse(fs.readFileSync(mockProfilesPath, 'utf8'));

  let passed = 0;
  let failed = 0;

  for (const profile of profiles) {
    const isQualified = evaluateQualification(profile);
    const expected = profile._expected.qualifies;
    const testLabel = `User: @${profile.login} (Followers: ${profile.followers}, Repos: ${profile.public_repos})`;

    if (isQualified === expected) {
      console.log(`  ✅ [PASS] ${testLabel} -> ${isQualified ? 'QUALIFIED' : 'DISQUALIFIED'} (${profile._expected.reason})`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${testLabel} -> Got ${isQualified}, Expected ${expected}`);
      failed++;
    }
  }

  console.log(`\nResults: ${passed} passed, ${failed} failed out of ${profiles.length} test cases.`);

  if (failed > 0) {
    throw new Error(`Qualification test suite failed with ${failed} failure(s).`);
  }

  console.log('✨ All Qualification Gate & Boundary Tests Passed Successfully!\n');
}

runQualificationTests();

