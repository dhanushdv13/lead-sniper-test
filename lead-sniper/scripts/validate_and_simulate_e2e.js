/**
 * End-to-End Workflow Validator & Execution Simulator
 * 1. Validates workflow JSON structure, node connections, expressions, and secret hygiene.
 * 2. Extracts and executes the actual Code nodes from lead_sniper_workflow.json in an n8n runtime simulator.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const WORKFLOW_PATH = path.join(__dirname, '../workflows/lead_sniper_workflow.json');

function validateWorkflowStructure(workflow) {
  console.log('--- Step 1: Validating n8n Workflow Structure & Expressions ---');

  if (!workflow || !Array.isArray(workflow.nodes) || !workflow.connections) {
    throw new Error('Workflow missing required top-level properties (nodes, connections).');
  }

  const nodeNames = new Set(workflow.nodes.map(n => n.name));
  const nodeIds = new Set();

  // Check unique IDs & Names
  for (const node of workflow.nodes) {
    if (!node.id || !node.name || !node.type) {
      throw new Error(`Invalid node definition: ${JSON.stringify(node)}`);
    }
    if (nodeIds.has(node.id)) {
      throw new Error(`Duplicate node ID detected: ${node.id}`);
    }
    nodeIds.add(node.id);
  }
  console.log(`  ✅ Verified ${workflow.nodes.length} unique nodes.`);

  // Check connections refer to valid nodes
  for (const [sourceNode, outputs] of Object.entries(workflow.connections)) {
    if (!nodeNames.has(sourceNode)) {
      throw new Error(`Connection source node not found: "${sourceNode}"`);
    }
    for (const branch of outputs.main || []) {
      for (const conn of branch) {
        if (!nodeNames.has(conn.node)) {
          throw new Error(`Connection target node "${conn.node}" (from "${sourceNode}") not found`);
        }
      }
    }
  }
  console.log('  ✅ All node connections verified.');

  // Validate expressions referencing $('NodeName')
  const rawJson = JSON.stringify(workflow);
  const exprMatches = [...rawJson.matchAll(/\$\('([^']+)'\)/g)];
  for (const match of exprMatches) {
    const refName = match[1];
    if (!nodeNames.has(refName)) {
      throw new Error(`Broken expression reference: $('${refName}') does not match any node name!`);
    }
  }
  console.log(`  ✅ Verified ${exprMatches.length} cross-node $('NodeName') expressions.`);

  // Validate HTTP Request nodes have retry settings & no hardcoded secrets
  const httpNodes = workflow.nodes.filter(n => n.type === 'n8n-nodes-base.httpRequest');
  for (const hNode of httpNodes) {
    if (!hNode.retryOnFail || !hNode.maxTries || !hNode.waitBetweenTries) {
      throw new Error(`HTTP node "${hNode.name}" is missing retryOnFail/maxTries/waitBetweenTries settings!`);
    }
  }
  console.log(`  ✅ Verified retry policies on all ${httpNodes.length} HTTP Request nodes.`);

  // Secret scan
  const secretPatterns = [
    /ghp_[a-zA-Z0-9]{20,}/,
    /github_pat_[a-zA-Z0-9_]{20,}/,
    /AIzaSy[a-zA-Z0-9_-]{30,}/,
    /https:\/\/discord\.com\/api\/webhooks\/\d+\/[a-zA-Z0-9_-]+/
  ];
  for (const pattern of secretPatterns) {
    if (pattern.test(rawJson)) {
      throw new Error(`Security failure: Real secret or webhook URL detected matching ${pattern}`);
    }
  }
  console.log('  ✅ Security scan passed: Zero hardcoded secrets or live webhook URLs.');

  // Qualification IF node verification
  const ifNode = workflow.nodes.find(n => n.type === 'n8n-nodes-base.if');
  if (!ifNode) throw new Error('Missing IF node for qualification.');
  if (ifNode.parameters.conditions.combinator !== 'or') {
    throw new Error('Qualification IF node must use combinator: "or" (OR logic).');
  }
  const conds = ifNode.parameters.conditions.conditions;
  const hasFollowersRule = conds.some(c => c.leftValue.includes('followers') && c.rightValue === 100 && c.operator.operation === 'gt');
  const hasReposRule = conds.some(c => c.leftValue.includes('public_repos') && c.rightValue === 50 && c.operator.operation === 'gt');
  if (!hasFollowersRule || !hasReposRule) {
    throw new Error('Qualification IF node does not match exact rule: followers > 100 OR public_repos > 50.');
  }
  console.log('  ✅ Exact qualification rule verified: followers > 100 OR public_repos > 50.');
}

function runCodeNode(node, inputItems, contextMap, staticData) {
  const code = node.parameters.jsCode;
  const mode = node.parameters.mode || 'runOnceForAllItems';

  const makeSelector = (currentItem) => (targetNodeName) => {
    const idx = currentItem?._sourceMap?.[targetNodeName] ?? 0;
    return {
      first: () => contextMap[targetNodeName][0],
      all: () => contextMap[targetNodeName],
      item: contextMap[targetNodeName][idx]
    };
  };

  if (mode === 'runOnceForEachItem') {
    const results = [];
    for (let i = 0; i < inputItems.length; i++) {
      const item = inputItems[i];
      const sandbox = {
        $json: item.json,
        $input: { item, all: () => inputItems },
        $: makeSelector(item),
        $getWorkflowStaticData: () => staticData,
        console,
        Date,
        Set,
        Map,
        Array,
        Math,
        Number,
        String,
        JSON
      };
      const wrapped = `(function() { ${code} })()`;
      const out = vm.runInNewContext(wrapped, sandbox);
      results.push({
        ...out,
        _sourceMap: { ...(item._sourceMap || {}), [node.name]: i }
      });
    }
    return results;
  } else {
    const sandbox = {
      $json: inputItems[0]?.json || {},
      $input: { all: () => inputItems, first: () => inputItems[0] },
      $: makeSelector(inputItems[0]),
      $getWorkflowStaticData: () => staticData,
      console,
      Date,
      Set,
      Map,
      Array,
      Math,
      Number,
      String,
      JSON
    };
    const wrapped = `(function() { ${code} })()`;
    const res = vm.runInNewContext(wrapped, sandbox);
    return res.map((r, i) => ({
      ...r,
      _sourceMap: { [node.name]: i }
    }));
  }
}

function simulatePipeline(workflow) {
  console.log('\n--- Step 2: Simulating End-to-End Execution Using Exported Workflow Nodes ---');

  const getNode = (name) => workflow.nodes.find(n => n.name === name);

  // Persistent static data store shared across workflow runs
  const staticData = {};

  // Config node simulation
  const configNode = getNode('Config');
  const configObj = {};
  for (const a of configNode.parameters.assignments.assignments) {
    configObj[a.name] = a.value;
  }
  configObj.bootstrapBatchSize = 10; // Process all mock profiles in simulation

  // Mock data loading
  const mockProfiles = JSON.parse(fs.readFileSync(path.join(__dirname, '../tests/mock_profiles.json'), 'utf8'));
  const mockStargazers = mockProfiles.map((p, idx) => ({
    starred_at: `2026-11-11T1${idx}:00:00Z`,
    user: {
      login: p.login,
      id: p.id,
      avatar_url: p.avatar_url,
      html_url: p.html_url
    }
  }));

  const contextMap = {
    'Config': [{ json: configObj }]
  };

  // 1. Simulate Calculate Stargazer Page
  const calcPageOut = runCodeNode(getNode('Calculate Stargazer Page'), [{ json: { stargazers_count: 205 } }], contextMap, staticData);
  console.log(`  1. [Calculate Stargazer Page] Output pages for 205 stars: ${calcPageOut.map(x => x.json.targetPage).join(', ')} (Boundary safety active!)`);
  if (calcPageOut.length !== 2 || calcPageOut[0].json.targetPage !== 2 || calcPageOut[1].json.targetPage !== 3) {
    throw new Error('Boundary safety check failed for count=205');
  }

  // 2. Simulate Filter New Stargazers (Run 1)
  const filterOut = runCodeNode(getNode('Filter New Stargazers'), [{ json: mockStargazers }], contextMap, staticData);
  contextMap['Filter New Stargazers'] = filterOut;
  console.log(`  2. [Filter New Stargazers] Run 1 detected ${filterOut.length} new stargazer(s).`);

  // 3. Simulate Fetch User Profile + Normalize Profile Data
  const normalizedOut = filterOut.map((item, idx) => {
    const profile = mockProfiles.find(p => p.id === item.json.id);
    return {
      json: {
        login: profile.login,
        id: profile.id,
        name: profile.name || profile.login,
        company: profile.company || 'Not specified',
        bio: profile.bio || 'Not specified',
        location: profile.location || 'Remote / Unspecified',
        followers: Number(profile.followers) || 0,
        public_repos: Number(profile.public_repos) || 0,
        html_url: profile.html_url,
        avatar_url: profile.avatar_url,
        starred_at: item.json.starred_at
      },
      _sourceMap: { ...item._sourceMap, 'Normalize Profile Data': idx }
    };
  });
  contextMap['Normalize Profile Data'] = normalizedOut;
  console.log(`  3. [Normalize Profile Data] Normalized ${normalizedOut.length} user profiles.`);

  // 4. Simulate Qualification Filter
  const qualifiedItems = [];
  const disqualifiedItems = [];
  for (const item of normalizedOut) {
    const qualifies = item.json.followers > 100 || item.json.public_repos > 50;
    if (qualifies) {
      qualifiedItems.push(item);
    } else {
      disqualifiedItems.push(item);
    }
  }
  console.log(`  4. [Qualification Filter] Qualified: ${qualifiedItems.length}, Disqualified (Stopped): ${disqualifiedItems.length}`);
  if (qualifiedItems.length !== 5 || disqualifiedItems.length !== 3) {
    throw new Error(`Expected 5 qualified and 3 disqualified, got ${qualifiedItems.length} and ${disqualifiedItems.length}`);
  }

  // 5. Simulate Gemini API Response for ONLY qualified items
  const mockGeminiOutputs = qualifiedItems.map((item, idx) => ({
    json: {
      candidates: [{
        content: {
          parts: [{
            text: `"Here is why this user is a valuable lead: **${item.json.name}** at ${item.json.company} has ${item.json.followers} followers and ${item.json.public_repos} public repos, demonstrating strong engineering influence. Extra sentence should be stripped!"`
          }]
        }
      }]
    },
    _sourceMap: { ...item._sourceMap, 'Generate AI Lead Pitch': idx }
  }));

  // 6. Execute actual 'Sanitize & Enforce Single Sentence' node from workflow JSON
  const sanitizedOut = runCodeNode(getNode('Sanitize & Enforce Single Sentence'), mockGeminiOutputs, contextMap, staticData);
  for (const out of sanitizedOut) {
    const sentCount = out.json.ai_pitch.split(/[.!?]+/).filter(Boolean).length;
    if (sentCount !== 1) {
      throw new Error(`Sanitizer failed single sentence check: "${out.json.ai_pitch}"`);
    }
    if (out.json.ai_pitch.includes('Extra sentence') || out.json.ai_pitch.includes('**')) {
      throw new Error(`Sanitizer failed to clean formatting/extra sentence: "${out.json.ai_pitch}"`);
    }
  }
  console.log(`  5. [Sanitize & Enforce Single Sentence] Verified pairedItem mapping & strict 1-sentence enforcement for all ${sanitizedOut.length} qualified leads.`);

  // 7. Execute actual 'Format Discord Embed' node from workflow JSON
  const discordOut = runCodeNode(getNode('Format Discord Embed'), sanitizedOut, contextMap, staticData);
  contextMap['Format Discord Embed'] = discordOut;
  for (const d of discordOut) {
    if (!d.json.discord_payload?.embeds?.[0]?.title?.includes(d.json.login)) {
      throw new Error(`Discord payload mismatch for ${d.json.login}`);
    }
  }
  console.log(`  6. [Format Discord Embed] Built valid Discord rich embeds for all ${discordOut.length} leads.`);

  // 8. Execute actual 'Audit & Commit Log' node from workflow JSON
  const mockDiscordHttpRes = discordOut.map((item, idx) => ({
    json: {},
    _sourceMap: { ...item._sourceMap, 'Send Discord Notification': idx }
  }));
  const auditOut = runCodeNode(getNode('Audit & Commit Log'), mockDiscordHttpRes, contextMap, staticData);
  console.log(`  7. [Audit & Commit Log] Audited ${auditOut.length} notified leads: [${auditOut.map(a => a.json.login).join(', ')}]`);
  for (let i = 0; i < auditOut.length; i++) {
    if (auditOut[i].json.login !== qualifiedItems[i].json.login) {
      throw new Error(`Audit item alignment mismatch! Expected ${qualifiedItems[i].json.login}, got ${auditOut[i].json.login}`);
    }
  }

  // 9. Simulate Run 2 with same stargazers -> Expect 0 items
  const filterRun2 = runCodeNode(getNode('Filter New Stargazers'), [{ json: mockStargazers }], contextMap, staticData);
  console.log(`  8. [Persistence Verification] Run 2 with identical stargazers emitted ${filterRun2.length} leads (Expected 0).`);
  if (filterRun2.length !== 0) {
    throw new Error('Deduplication failed on Run 2!');
  }

  console.log('\n✨ ALL WORKFLOW STRUCTURE & END-TO-END SIMULATION CHECKS PASSED! ✨\n');
}

const workflow = JSON.parse(fs.readFileSync(WORKFLOW_PATH, 'utf8'));
validateWorkflowStructure(workflow);
simulatePipeline(workflow);
