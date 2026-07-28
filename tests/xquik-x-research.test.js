const assert = require('node:assert/strict');
const test = require('node:test');

const {
  ACTORS,
  buildFollowerInput,
  buildPlans,
  buildTweetInput,
  createConfig,
  isDiagnostic,
  partitionItems,
  runActor,
  validateConfig,
  writeResult
} = require('../scripts/xquik-x-research');

test('builds an explicit bounded tweet search plan', () => {
  const config = createConfig({
    X_TWEET_ENABLED: 'true',
    X_SEARCH_TERMS: 'Endesa Portugal,EDP fatura',
    X_TWEET_MAX_ITEMS: '20',
    X_TWEET_MAX_ITEMS_PER_TARGET: '5'
  });

  validateConfig(config);
  const input = buildTweetInput(config.tweet);

  assert.equal(input.mode, 'search');
  assert.deepEqual(input.searchTerms, ['Endesa Portugal', 'EDP fatura']);
  assert.equal(input.maxItems, 20);
  assert.equal(input.maxItemsPerTarget, 5);
  assert.equal(input.outputVariant, 'rich');
  assert.equal(input.fieldStyle, 'camelCase');
  assert.equal(input.outputPreset, 'flat');
  assert.equal(input.includeSearchTerms, true);
});

test('accepts every current tweet output variant', () => {
  for (const outputVariant of ['legacy', 'rich', 'raw', 'compact', 'full']) {
    const config = createConfig({
      X_TWEET_ENABLED: 'true',
      X_SEARCH_TERMS: 'Endesa',
      X_TWEET_OUTPUT_VARIANT: outputVariant
    });

    validateConfig(config);
    assert.equal(buildTweetInput(config.tweet).outputVariant, outputVariant);
  }
});

test('rejects partial numeric values and configures request timeouts', () => {
  assert.throws(
    () => createConfig({
      X_TWEET_ENABLED: 'true',
      X_SEARCH_TERMS: 'Endesa',
      X_TWEET_MAX_ITEMS: '10 rows'
    }),
    /X_TWEET_MAX_ITEMS must be a positive integer/
  );
  assert.throws(
    () => createConfig({
      X_TWEET_ENABLED: 'true',
      X_SEARCH_TERMS: 'Endesa',
      REQUEST_TIMEOUT: '2.5'
    }),
    /REQUEST_TIMEOUT must be a positive integer/
  );

  const config = createConfig({
    X_TWEET_ENABLED: 'true',
    X_SEARCH_TERMS: 'Endesa',
    REQUEST_TIMEOUT: '1234'
  });
  assert.equal(config.requestTimeoutMs, 1234);
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
    X_ACTORS_APPROVED: 'true',
    X_MAX_TOTAL_CHARGE_USD: '1'
  });

  assert.throws(
    () => validateConfig(noToken),
    /APIFY_API_KEY is required/
  );

  const noChargeCap = createConfig({
    APIFY_API_KEY: 'test-token',
    X_TWEET_ENABLED: 'true',
    X_SEARCH_TERMS: 'Endesa',
    X_ACTOR_DRY_RUN: 'false',
    X_ACTORS_APPROVED: 'true'
  });

  assert.throws(
    () => validateConfig(noChargeCap),
    /X_MAX_TOTAL_CHARGE_USD/
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
  assert.equal(ACTORS.tweet.stableId, 'wAusCMrm284Voaw86');
  assert.equal(ACTORS.follower.stableId, 'AaT0BcKU5GQh97wdt');
});

test('identifies diagnostic rows without classifying normal items', () => {
  assert.equal(isDiagnostic({ resultType: 'diagnostic' }), true);
  assert.equal(isDiagnostic({ recordType: 'diagnostic' }), true);
  assert.equal(isDiagnostic({ unavailableReason: 'not found' }), true);
  assert.equal(isDiagnostic({ text: 'Normal tweet result' }), false);

  assert.deepEqual(
    partitionItems([
      { id: '1', text: 'Normal tweet result' },
      { resultType: 'diagnostic', message: 'Unavailable' }
    ]),
    {
      items: [{ id: '1', text: 'Normal tweet result' }],
      diagnostics: [
        { resultType: 'diagnostic', message: 'Unavailable' }
      ]
    }
  );
  assert.throws(
    () => partitionItems({ items: [] }),
    /must be a JSON array/
  );
});

test('rejects API identifiers that could escape the output directory', () => {
  assert.throws(
    () => writeResult(
      { key: 'tweet', actor: ACTORS.tweet },
      {
        runId: '../outside',
        datasetId: 'dataset-1',
        items: []
      },
      '.'
    ),
    /Actor run ID is missing or invalid/
  );
});

test('forwards the approved hard charge cap to Apify', async () => {
  const calls = [];
  const client = {
    async post(url, body, options) {
      calls.push({ url, body, options });
      return {
        data: {
          data: {
            id: 'run-1',
            defaultDatasetId: 'dataset-1'
          }
        }
      };
    },
    async get(url) {
      if (url === '/actor-runs/run-1') {
        return {
          data: {
            data: {
              id: 'run-1',
              status: 'SUCCEEDED',
              defaultDatasetId: 'dataset-1'
            }
          }
        };
      }

      return { data: [{ id: 'tweet-1', text: 'Example' }] };
    }
  };

  const result = await runActor(
    client,
    {
      actor: ACTORS.tweet,
      input: { mode: 'search', searchTerms: ['Endesa'], maxItems: 5 }
    },
    {
      maxTotalChargeUsd: 1.25,
      maxWaitMs: 100,
      pollIntervalMs: 1
    }
  );

  assert.equal(result.runId, 'run-1');
  assert.deepEqual(calls[0], {
    url: '/actors/xquik~x-tweet-scraper/runs',
    body: { mode: 'search', searchTerms: ['Endesa'], maxItems: 5 },
    options: { params: { maxTotalChargeUsd: 1.25 } }
  });
});

test('rejects malformed Actor run and dataset responses', async () => {
  const plan = {
    actor: ACTORS.tweet,
    input: { mode: 'search', searchTerms: ['Endesa'], maxItems: 5 }
  };
  const config = {
    maxTotalChargeUsd: 1,
    maxWaitMs: 100,
    pollIntervalMs: 1
  };

  await assert.rejects(
    runActor(
      {
        async post() {
          return { data: { data: { id: '../outside' } } };
        }
      },
      plan,
      config
    ),
    /Actor run ID is missing or invalid/
  );

  await assert.rejects(
    runActor(
      {
        async post() {
          return { data: { data: { id: 'run-1' } } };
        },
        async get() {
          return { data: { data: {} } };
        }
      },
      plan,
      config
    ),
    /status response is missing a valid status/
  );

  await assert.rejects(
    runActor(
      {
        async post() {
          return { data: { data: { id: 'run-1' } } };
        },
        async get(url) {
          if (url === '/actor-runs/run-1') {
            return {
              data: {
                data: {
                  id: 'run-1',
                  status: 'SUCCEEDED',
                  defaultDatasetId: 'dataset-1'
                }
              }
            };
          }
          return { data: { items: [] } };
        }
      },
      plan,
      config
    ),
    /dataset response must be a JSON array/
  );
});

test('aborts a run after the local wait limit', async () => {
  const calls = [];
  const client = {
    async post(url) {
      calls.push(url);
      if (url.includes('/abort')) return { data: { data: {} } };

      return {
        data: {
          data: {
            id: 'run-timeout',
            defaultDatasetId: 'dataset-timeout'
          }
        }
      };
    }
  };

  await assert.rejects(
    runActor(
      client,
      {
        actor: ACTORS.tweet,
        input: { mode: 'search', searchTerms: ['Endesa'], maxItems: 5 }
      },
      {
        maxTotalChargeUsd: 1,
        maxWaitMs: 0,
        pollIntervalMs: 1
      }
    ),
    /timed out/
  );

  assert.deepEqual(calls, [
    '/actors/xquik~x-tweet-scraper/runs',
    '/actor-runs/run-timeout/abort'
  ]);
});
