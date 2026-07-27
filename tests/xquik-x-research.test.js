const assert = require('node:assert/strict');
const test = require('node:test');

const {
  ACTORS,
  buildFollowerInput,
  buildPlans,
  buildTweetInput,
  createConfig,
  isDiagnostic,
  validateConfig
} = require('../scripts/xquik-x-research');

test('builds a bounded tweet plan from every supported target type', () => {
  const config = createConfig({
    X_TWEET_ENABLED: 'true',
    X_SEARCH_TERMS: 'Endesa Portugal,EDP fatura',
    X_TWEET_URLS: 'https://x.com/example/status/123',
    X_TWEET_IDS: '123',
    X_POST_HANDLES: 'endesa',
    X_TWEET_LIST_IDS: '456',
    X_TWEET_MAX_ITEMS: '20',
    X_TWEET_MAX_ITEMS_PER_TARGET: '5'
  });

  validateConfig(config);
  const input = buildTweetInput(config.tweet);

  assert.deepEqual(input.searchTerms, ['Endesa Portugal', 'EDP fatura']);
  assert.deepEqual(input.startUrls, [
    'https://x.com/example/status/123'
  ]);
  assert.deepEqual(input.tweetIds, ['123']);
  assert.deepEqual(input.twitterHandles, ['endesa']);
  assert.deepEqual(input.listIds, ['456']);
  assert.equal(input.maxItems, 20);
  assert.equal(input.maxItemsPerTarget, 5);
  assert.equal(input.outputVariant, 'rich');
  assert.equal(input.fieldStyle, 'camelCase');
  assert.equal(input.outputPreset, 'flat');
  assert.equal(input.includeSearchTerms, true);
});

test('builds a follower overlap plan with source metadata', () => {
  const config = createConfig({
    X_FOLLOWER_ENABLED: 'true',
    X_AUDIENCE_HANDLES: 'competitor_a,competitor_b',
    X_AUDIENCE_RELATION: 'followers',
    X_FOLLOWER_MAX_ITEMS: '30',
    X_FOLLOWER_MAX_ITEMS_PER_TARGET: '15',
    X_FOLLOWER_DEDUPE_MODE: 'merge'
  });

  validateConfig(config);
  const input = buildFollowerInput(config.follower);

  assert.deepEqual(input.twitterHandles, [
    'competitor_a',
    'competitor_b'
  ]);
  assert.deepEqual(input.listIds, []);
  assert.deepEqual(input.communityIds, []);
  assert.equal(input.maxItems, 30);
  assert.equal(input.maxItemsPerTarget, 15);
  assert.equal(input.includeTargetMetadata, true);
  assert.equal(input.dedupeMode, 'merge');
  assert.equal(input.overlapMode, true);
});

test('validates list and community relations before execution', () => {
  const invalidList = createConfig({
    X_FOLLOWER_ENABLED: 'true',
    X_AUDIENCE_LIST_IDS: '123',
    X_AUDIENCE_RELATION: 'followers'
  });
  const validList = createConfig({
    X_FOLLOWER_ENABLED: 'true',
    X_AUDIENCE_LIST_IDS: '123',
    X_AUDIENCE_RELATION: 'list_members'
  });
  const validCommunity = createConfig({
    X_FOLLOWER_ENABLED: 'true',
    X_AUDIENCE_COMMUNITY_IDS: '456',
    X_AUDIENCE_RELATION: 'community_members'
  });

  assert.throws(
    () => validateConfig(invalidList),
    /requires list_members or list_followers/
  );
  assert.doesNotThrow(() => validateConfig(validList));
  assert.doesNotThrow(() => validateConfig(validCommunity));
});

test('requires approval and a token before a billable run', () => {
  const unapproved = createConfig({
    X_TWEET_ENABLED: 'true',
    X_SEARCH_TERMS: 'Endesa',
    X_ACTOR_DRY_RUN: 'false'
  });

  assert.throws(
    () => validateConfig(unapproved),
    /X_ACTORS_APPROVED=true/
  );

  const noToken = createConfig({
    X_TWEET_ENABLED: 'true',
    X_SEARCH_TERMS: 'Endesa',
    X_ACTOR_DRY_RUN: 'false',
    X_ACTORS_APPROVED: 'true'
  });

  assert.throws(
    () => validateConfig(noToken),
    /APIFY_API_KEY is required/
  );
});

test('uses only the 2 Xquik Apify Actor IDs', () => {
  const config = createConfig({
    X_TWEET_ENABLED: 'true',
    X_SEARCH_TERMS: 'Endesa',
    X_FOLLOWER_ENABLED: 'true',
    X_AUDIENCE_HANDLES: 'endesa'
  });

  validateConfig(config);
  const plans = buildPlans(config);

  assert.deepEqual(
    plans.map(plan => plan.actor.apiId),
    [
      ACTORS.tweet.apiId,
      ACTORS.follower.apiId
    ]
  );
  assert.equal(ACTORS.tweet.apiId, 'xquik~x-tweet-scraper');
  assert.equal(ACTORS.follower.apiId, 'xquik~x-follower-scraper');
});

test('identifies diagnostic rows without classifying normal items', () => {
  assert.equal(isDiagnostic({ recordType: 'diagnostic' }), true);
  assert.equal(isDiagnostic({ unavailableReason: 'not found' }), true);
  assert.equal(isDiagnostic({ text: 'Normal tweet result' }), false);
});
