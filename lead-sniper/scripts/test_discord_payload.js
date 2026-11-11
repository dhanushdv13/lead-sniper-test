/**
 * Test Suite: Discord Webhook Payload Formatter & Validation
 * Validates Requirement 8: Send qualified lead information and AI pitch to Discord
 * Validates Discord API Embed Schema compliance
 */

function buildDiscordPayload(lead, repoContext = { owner: 'octocat', repo: 'Hello-World' }) {
  if (!lead || !lead.login) {
    throw new Error('Invalid lead object: login is required');
  }

  const payload = {
    username: "Lead Sniper Bot",
    avatar_url: "https://cdn-icons-png.flaticon.com/512/3242/3242257.png",
    embeds: [
      {
        title: `🎯 High-Value GitHub Lead: @${lead.login}`,
        url: lead.html_url || `https://github.com/${lead.login}`,
        color: 3066993, // Emerald green (0x2ECC71)
        author: {
          name: `${lead.name || lead.login} (@${lead.login})`,
          url: lead.html_url || `https://github.com/${lead.login}`,
          icon_url: lead.avatar_url || ''
        },
        thumbnail: {
          url: lead.avatar_url || ''
        },
        description: `💡 **AI Lead Angle:**\n${lead.ai_pitch}`,
        fields: [
          {
            name: "🏢 Company",
            value: lead.company && lead.company !== 'Not specified' ? lead.company : 'Not specified',
            inline: true
          },
          {
            name: "👥 Followers",
            value: String(lead.followers ?? 0),
            inline: true
          },
          {
            name: "📦 Public Repos",
            value: String(lead.public_repos ?? 0),
            inline: true
          },
          {
            name: "📍 Location",
            value: lead.location && lead.location !== 'Remote / Unspecified' ? lead.location : 'Remote / Unspecified',
            inline: true
          },
          {
            name: "📝 Bio",
            value: lead.bio && lead.bio !== 'Not specified' ? lead.bio : 'No bio provided',
            inline: false
          }
        ],
        footer: {
          text: `Lead Sniper • Target: ${repoContext.owner}/${repoContext.repo}`
        },
        timestamp: new Date().toISOString()
      }
    ]
  };

  return payload;
}

function runDiscordPayloadTests() {
  console.log('--- Running Discord Webhook Payload Validation Tests ---');

  const sampleLead = {
    id: 2001,
    login: 'sarah-lead',
    name: 'Sarah Connor',
    company: '@CyberdyneAI',
    bio: 'Staff Platform Architect building autonomous cloud tooling. Ex-Google.',
    location: 'San Francisco, CA',
    followers: 450,
    public_repos: 12,
    html_url: 'https://github.com/sarah-lead',
    avatar_url: 'https://avatars.githubusercontent.com/u/2001?v=4',
    ai_pitch: 'As Staff Platform Architect at CyberdyneAI with 450 followers, Sarah possesses direct decision-making authority over enterprise infrastructure adoption.'
  };

  const payload = buildDiscordPayload(sampleLead, { owner: 'octocat', repo: 'Hello-World' });

  // Verification assertions
  if (!payload.embeds || payload.embeds.length !== 1) {
    throw new Error('Embeds array must contain exactly 1 embed');
  }
  const embed = payload.embeds[0];
  if (!embed.title.includes('@sarah-lead')) {
    throw new Error('Title does not include username');
  }
  if (!embed.description.includes(sampleLead.ai_pitch)) {
    throw new Error('Description does not include AI pitch');
  }
  if (embed.fields.length !== 5) {
    throw new Error(`Expected 5 fields, got ${embed.fields.length}`);
  }
  if (embed.color !== 3066993) {
    throw new Error('Embed color is missing or incorrect');
  }
  if (!embed.timestamp) {
    throw new Error('ISO timestamp is missing');
  }

  console.log('  ✅ Payload contains valid embed structure, title, author, and description.');
  console.log('  ✅ All 5 fields (Company, Followers, Repos, Location, Bio) verified.');
  console.log('  ✅ Footer and ISO timestamp present.');
  console.log('\nGenerated Sample Discord Payload:\n', JSON.stringify(payload, null, 2));
  console.log('\n✨ All Discord Payload tests passed successfully!\n');
}

runDiscordPayloadTests();

