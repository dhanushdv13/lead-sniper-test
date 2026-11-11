/**
 * Test Suite: GitHub Stargazer Delta Detection & Persistent State Logic
 * Validates Requirement 1, Requirement 2, and Requirement 9.
 */

const fs = require('fs');
const path = require('path');

// Simulated n8n $getWorkflowStaticData('global')
function createMockStaticStore(initialState = {}) {
  const store = {
    lastProcessedStarredAt: initialState.lastProcessedStarredAt || null,
    processedUserIds: initialState.processedUserIds ? [...initialState.processedUserIds] : []
  };
  return store;
}

/**
 * Core Delta Detection & Deduplication Function (mirrors n8n Code node)
 * @param {Array} stargazers - Array of stargazer objects from GitHub API
 * @param {Object} staticData - Persistent state object
 * @param {Object} options - Configuration options (bootstrapLimit, maxHistory)
 */
function processStargazers(stargazers, staticData, options = { bootstrapLimit: 5, maxHistory: 1000 }) {
  if (!Array.isArray(stargazers) || stargazers.length === 0) {
    return { newLeads: [], updatedState: staticData };
  }

  // Ensure stargazers are sorted chronologically ascending by starred_at
  const sortedStars = [...stargazers].sort((a, b) => new Date(a.starred_at) - new Date(b.starred_at));

  const newLeads = [];
  const processedSet = new Set(staticData.processedUserIds || []);
  let latestTimestamp = staticData.lastProcessedStarredAt;

  // Case 1: First Run (State is empty / null)
  if (!staticData.lastProcessedStarredAt) {
    // Bootstrap mode: pick up to the latest `bootstrapLimit` stargazers
    const batchToProcess = sortedStars.slice(-options.bootstrapLimit);
    for (const item of batchToProcess) {
      if (!processedSet.has(item.user.id)) {
        newLeads.push(item);
        processedSet.add(item.user.id);
        if (!latestTimestamp || new Date(item.starred_at) > new Date(latestTimestamp)) {
          latestTimestamp = item.starred_at;
        }
      }
    }
  } else {
    // Case 2: Subsequent Runs - Filter strictly for new stars
    const lastCutoff = new Date(staticData.lastProcessedStarredAt);
    for (const item of sortedStars) {
      const starTime = new Date(item.starred_at);
      const isNewTimestamp = starTime > lastCutoff;
      const isNotProcessed = !processedSet.has(item.user.id);

      if (isNewTimestamp && isNotProcessed) {
        newLeads.push(item);
        processedSet.add(item.user.id);
        if (!latestTimestamp || starTime > new Date(latestTimestamp)) {
          latestTimestamp = item.starred_at;
        }
      }
    }
  }

  // Maintain maxHistory to prevent infinite memory growth
  let updatedIds = Array.from(processedSet);
  if (updatedIds.length > options.maxHistory) {
    updatedIds = updatedIds.slice(-options.maxHistory);
  }

  const updatedState = {
    lastProcessedStarredAt: latestTimestamp,
    processedUserIds: updatedIds
  };

  return { newLeads, updatedState };
}

// ==================== TEST RUNNER ====================
function runTests() {
  console.log('--- Running Delta Detection & Deduplication Tests ---');

  const mockStarsPath = path.join(__dirname, '../tests/mock_stargazers.json');
  const mockStars = JSON.parse(fs.readFileSync(mockStarsPath, 'utf8'));

  // Test 1: Cold Start / Initial Run
  console.log('\n[Test 1] Cold Start (empty persistent state):');
  const state1 = createMockStaticStore();
  const res1 = processStargazers(mockStars, state1, { bootstrapLimit: 3, maxHistory: 1000 });
  console.log(`  Identified ${res1.newLeads.length} initial leads (expected 3).`);
  console.log(`  Updated lastProcessedStarredAt: ${res1.updatedState.lastProcessedStarredAt}`);
  console.log(`  Processed IDs in state: [${res1.updatedState.processedUserIds.join(', ')}]`);
  if (res1.newLeads.length !== 3) throw new Error('Test 1 failed: Expected 3 bootstrap leads');
  if (res1.updatedState.processedUserIds.length !== 3) throw new Error('Test 1 failed: Expected 3 recorded IDs');
  console.log('  ✅ Test 1 Passed');

  // Test 2: Repeat Run with identical data (Zero new leads expected)
  console.log('\n[Test 2] Repeat Run with unchanged repository data:');
  const res2 = processStargazers(mockStars, res1.updatedState);
  console.log(`  Identified ${res2.newLeads.length} new leads (expected 0).`);
  if (res2.newLeads.length !== 0) throw new Error('Test 2 failed: Duplicate leads detected!');
  console.log('  ✅ Test 2 Passed: Deduplication strictly prevented re-notification.');

  // Test 3: New Star arrives
  console.log('\n[Test 3] New Stargazer added:');
  const newStar = {
    starred_at: "2026-11-11T18:00:00Z",
    user: {
      login: "vp-engineering-mike",
      id: 1006,
      avatar_url: "https://avatars.githubusercontent.com/u/1006?v=4",
      html_url: "https://github.com/vp-engineering-mike"
    }
  };
  const updatedStars = [...mockStars, newStar];
  const res3 = processStargazers(updatedStars, res1.updatedState);
  console.log(`  Identified ${res3.newLeads.length} new lead(s) (expected 1).`);
  if (res3.newLeads.length !== 1 || res3.newLeads[0].user.login !== 'vp-engineering-mike') {
    throw new Error('Test 3 failed: New lead was not correctly identified');
  }
  if (res3.updatedState.lastProcessedStarredAt !== "2026-11-11T18:00:00Z") {
    throw new Error('Test 3 failed: Timestamp cursor not updated');
  }
  console.log('  ✅ Test 3 Passed: Newly added star detected and cursor advanced.');

  // Test 4: Duplicate ID with newer timestamp (e.g., unstar and restar edge case)
  console.log('\n[Test 4] User unstars and restars (ID already in processed set):');
  const restarredUser = {
    starred_at: "2026-11-11T19:00:00Z",
    user: {
      login: "vp-engineering-mike",
      id: 1006, // already processed in Test 3
      avatar_url: "https://avatars.githubusercontent.com/u/1006?v=4",
      html_url: "https://github.com/vp-engineering-mike"
    }
  };
  const res4 = processStargazers([...updatedStars, restarredUser], res3.updatedState);
  console.log(`  Identified ${res4.newLeads.length} leads (expected 0 due to ID deduplication).`);
  if (res4.newLeads.length !== 0) {
    throw new Error('Test 4 failed: Restarred user bypassed ID deduplication!');
  }
  console.log('  ✅ Test 4 Passed: Restarred user correctly deduplicated by persistent ID store.');

  console.log('\n✨ All Delta Detection & Persistent State tests passed successfully!\n');
}

runTests();

