#!/usr/bin/env node

/**
 * Xquik X research through Apify Actors.
 *
 * Dry-run is enabled by default. A billable run requires:
 * - X_ACTOR_DRY_RUN=false
 * - X_ACTORS_APPROVED=true
 * - APIFY_API_KEY set through the environment
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ quiet: true });

const APIFY_API_BASE = 'https://api.apify.com/v2';

const ACTORS = Object.freeze({
  tweet: Object.freeze({
    apiId: 'xquik~x-tweet-scraper',
    storeId: 'xquik/x-tweet-scraper',
    listing: 'https://apify.com/xquik/x-tweet-scraper'
  }),
  follower: Object.freeze({
    apiId: 'xquik~x-follower-scraper',
    storeId: 'xquik/x-follower-scraper',
    listing: 'https://apify.com/xquik/x-follower-scraper'
  })
});

const TERMINAL_FAILURES = new Set([
  'ABORTED',
  'FAILED',
  'TIMED-OUT'
]);

const FOLLOWER_RELATIONS = new Set([
  'followers',
  'following',
  'verified_followers',
  'list_members',
  'list_followers',
  'community_members'
]);

const ACCOUNT_RELATIONS = new Set([
  'followers',
  'following',
  'verified_followers'
]);
const LIST_RELATIONS = new Set(['list_members', 'list_followers']);
const DEDUPE_MODES = new Set(['none', 'first', 'merge']);
const TWEET_OUTPUT_VARIANTS = new Set(['legacy', 'rich', 'raw']);
const FIELD_STYLES = new Set(['legacy', 'camelCase', 'snake_case']);
const TWEET_OUTPUT_PRESETS = new Set(['nested', 'flat']);
const FOLLOWER_OUTPUT_MODES = new Set(['compact', 'full', 'raw']);

function parseBoolean(value, fallback = false) {
  if (value === undefined || value === '') return fallback;

  const normalized = String(value).trim().toLowerCase();
  if (normalized === 'true') return true;
  if (normalized === 'false') return false;

  throw new Error(`Expected true or false. Received: ${value}`);
}

function parseList(value) {
  if (!value) return [];

  return String(value)
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
}

function parsePositiveInteger(value, fallback, name) {
  const parsed = Number.parseInt(value ?? String(fallback), 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return parsed;
}

function requireChoice(value, allowed, name) {
  if (!allowed.has(value)) {
    throw new Error(`${name} must be one of: ${[...allowed].join(', ')}.`);
  }
  return value;
}

function createConfig(env = process.env) {
  return {
    apiKey: env.APIFY_API_KEY || '',
    approved: parseBoolean(env.X_ACTORS_APPROVED, false),
    dryRun: parseBoolean(env.X_ACTOR_DRY_RUN, true),
    outputDir: env.OUTPUT_DIR || './results',
    pollIntervalMs: parsePositiveInteger(
      env.POLL_INTERVAL,
      5000,
      'POLL_INTERVAL'
    ),
    maxWaitMs: parsePositiveInteger(
      env.MAX_WAIT_TIME,
      600000,
      'MAX_WAIT_TIME'
    ),
    tweet: {
      enabled: parseBoolean(env.X_TWEET_ENABLED, false),
      searchTerms: parseList(env.X_SEARCH_TERMS),
      urls: parseList(env.X_TWEET_URLS),
      tweetIds: parseList(env.X_TWEET_IDS),
      handles: parseList(env.X_POST_HANDLES),
      listIds: parseList(env.X_TWEET_LIST_IDS),
      maxItems: parsePositiveInteger(
        env.X_TWEET_MAX_ITEMS,
        100,
        'X_TWEET_MAX_ITEMS'
      ),
      maxItemsPerTarget: parsePositiveInteger(
        env.X_TWEET_MAX_ITEMS_PER_TARGET,
        100,
        'X_TWEET_MAX_ITEMS_PER_TARGET'
      ),
      outputVariant: requireChoice(
        env.X_TWEET_OUTPUT_VARIANT || 'rich',
        TWEET_OUTPUT_VARIANTS,
        'X_TWEET_OUTPUT_VARIANT'
      ),
      fieldStyle: requireChoice(
        env.X_TWEET_FIELD_STYLE || 'camelCase',
        FIELD_STYLES,
        'X_TWEET_FIELD_STYLE'
      ),
      outputPreset: requireChoice(
        env.X_TWEET_OUTPUT_PRESET || 'flat',
        TWEET_OUTPUT_PRESETS,
        'X_TWEET_OUTPUT_PRESET'
      )
    },
    follower: {
      enabled: parseBoolean(env.X_FOLLOWER_ENABLED, false),
      urls: parseList(env.X_AUDIENCE_URLS),
      handles: parseList(env.X_AUDIENCE_HANDLES),
      listIds: parseList(env.X_AUDIENCE_LIST_IDS),
      communityIds: parseList(env.X_AUDIENCE_COMMUNITY_IDS),
      relation: requireChoice(
        env.X_AUDIENCE_RELATION || 'followers',
        FOLLOWER_RELATIONS,
        'X_AUDIENCE_RELATION'
      ),
      maxItems: parsePositiveInteger(
        env.X_FOLLOWER_MAX_ITEMS,
        100,
        'X_FOLLOWER_MAX_ITEMS'
      ),
      maxItemsPerTarget: parsePositiveInteger(
        env.X_FOLLOWER_MAX_ITEMS_PER_TARGET,
        100,
        'X_FOLLOWER_MAX_ITEMS_PER_TARGET'
      ),
      outputMode: requireChoice(
        env.X_FOLLOWER_OUTPUT_MODE || 'full',
        FOLLOWER_OUTPUT_MODES,
        'X_FOLLOWER_OUTPUT_MODE'
      ),
      dedupeMode: requireChoice(
        env.X_FOLLOWER_DEDUPE_MODE || 'none',
        DEDUPE_MODES,
        'X_FOLLOWER_DEDUPE_MODE'
      )
    }
  };
}

function validateConfig(config) {
  if (!config.tweet.enabled && !config.follower.enabled) {
    throw new Error(
      'Enable X_TWEET_ENABLED, X_FOLLOWER_ENABLED, or both.'
    );
  }

  const tweetTargetCount = [
    config.tweet.searchTerms,
    config.tweet.urls,
    config.tweet.tweetIds,
    config.tweet.handles,
    config.tweet.listIds
  ].reduce((total, values) => total + values.length, 0);

  if (config.tweet.enabled && tweetTargetCount === 0) {
    throw new Error(
      'X Tweet Scraper needs a search term, URL, ID, handle, or list ID.'
    );
  }

  const followerTargetCount = [
    config.follower.urls,
    config.follower.handles,
    config.follower.listIds,
    config.follower.communityIds
  ].reduce((total, values) => total + values.length, 0);

  if (config.follower.enabled && followerTargetCount === 0) {
    throw new Error(
      'X Follower Scraper needs a URL, handle, list ID, or community ID.'
    );
  }

  if (
    config.follower.enabled &&
    config.follower.handles.length > 0 &&
    !ACCOUNT_RELATIONS.has(config.follower.relation)
  ) {
    throw new Error(
      'X_AUDIENCE_HANDLES requires an account relation.'
    );
  }

  if (
    config.follower.enabled &&
    config.follower.listIds.length > 0 &&
    !LIST_RELATIONS.has(config.follower.relation)
  ) {
    throw new Error(
      'X_AUDIENCE_LIST_IDS requires list_members or list_followers.'
    );
  }

  if (
    config.follower.enabled &&
    config.follower.communityIds.length > 0 &&
    config.follower.relation !== 'community_members'
  ) {
    throw new Error(
      'X_AUDIENCE_COMMUNITY_IDS requires community_members.'
    );
  }

  if (!config.dryRun && !config.approved) {
    throw new Error(
      'Billable runs require X_ACTORS_APPROVED=true after a live pricing review.'
    );
  }

  if (!config.dryRun && !config.apiKey) {
    throw new Error(
      'APIFY_API_KEY is required for execution. Keep it in the environment.'
    );
  }
}

function buildTweetInput(tweetConfig) {
  return {
    searchTerms: tweetConfig.searchTerms,
    startUrls: tweetConfig.urls,
    tweetIds: tweetConfig.tweetIds,
    twitterHandles: tweetConfig.handles,
    listIds: tweetConfig.listIds,
    maxItems: tweetConfig.maxItems,
    maxItemsPerTarget: tweetConfig.maxItemsPerTarget,
    outputVariant: tweetConfig.outputVariant,
    fieldStyle: tweetConfig.fieldStyle,
    outputPreset: tweetConfig.outputPreset,
    includeSearchTerms: tweetConfig.searchTerms.length > 0,
    includeUnavailableFields: true
  };
}

function buildFollowerInput(followerConfig) {
  return {
    startUrls: followerConfig.urls,
    twitterHandles: followerConfig.handles,
    listIds: followerConfig.listIds,
    communityIds: followerConfig.communityIds,
    relation: followerConfig.relation,
    maxItems: followerConfig.maxItems,
    maxItemsPerTarget: followerConfig.maxItemsPerTarget,
    outputMode: followerConfig.outputMode,
    includeTargetMetadata: true,
    includeUnavailableFields: true,
    includeUnavailableUsers: true,
    dedupeMode: followerConfig.dedupeMode,
    overlapMode: followerConfig.dedupeMode === 'merge'
  };
}

function buildPlans(config) {
  const plans = [];

  if (config.tweet.enabled) {
    plans.push({
      key: 'tweet',
      actor: ACTORS.tweet,
      input: buildTweetInput(config.tweet)
    });
  }

  if (config.follower.enabled) {
    plans.push({
      key: 'follower',
      actor: ACTORS.follower,
      input: buildFollowerInput(config.follower)
    });
  }

  return plans;
}

function delay(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

async function runActor(client, plan, config) {
  const runResponse = await client.post(
    `/actors/${plan.actor.apiId}/runs`,
    plan.input
  );
  const initialRun = runResponse.data.data;
  const startedAt = Date.now();

  console.log(`Started ${plan.actor.storeId}. Run ID: ${initialRun.id}`);

  while (Date.now() - startedAt < config.maxWaitMs) {
    const statusResponse = await client.get(`/actor-runs/${initialRun.id}`);
    const run = statusResponse.data.data;

    if (run.status === 'SUCCEEDED') {
      const datasetResponse = await client.get(
        `/datasets/${run.defaultDatasetId}/items`,
        { params: { clean: true, format: 'json' } }
      );

      return {
        runId: run.id,
        datasetId: run.defaultDatasetId,
        items: datasetResponse.data
      };
    }

    if (TERMINAL_FAILURES.has(run.status)) {
      throw new Error(
        `${plan.actor.storeId} ended with ${run.status}. Run ID: ${run.id}`
      );
    }

    await delay(config.pollIntervalMs);
  }

  throw new Error(
    `${plan.actor.storeId} timed out. Run ID: ${initialRun.id}`
  );
}

function isDiagnostic(item) {
  if (!item || typeof item !== 'object') return false;
  if (item.error || item.errorMessage || item.unavailableReason) return true;

  return ['type', 'recordType', 'rowType', 'status'].some(key => {
    const value = item[key];
    if (typeof value !== 'string') return false;
    return /diagnostic|unavailable|error/i.test(value);
  });
}

function writeResult(plan, result, outputDir) {
  fs.mkdirSync(outputDir, { recursive: true });

  const date = new Date().toISOString().split('T')[0];
  const filename = path.join(
    outputDir,
    `xquik-${plan.key}-${date}-${result.runId}.json`
  );
  const diagnostics = result.items.filter(isDiagnostic);
  const payload = {
    actor: plan.actor.storeId,
    listing: plan.actor.listing,
    runId: result.runId,
    datasetId: result.datasetId,
    collectedAt: new Date().toISOString(),
    input: plan.input,
    itemCount: result.items.length,
    diagnosticCount: diagnostics.length,
    items: result.items
  };

  fs.writeFileSync(filename, JSON.stringify(payload, null, 2));
  return filename;
}

function printPlans(config, plans) {
  console.log('\nXquik Apify Actor plan');
  console.log(`Mode: ${config.dryRun ? 'dry run' : 'approved execution'}`);

  for (const plan of plans) {
    console.log(`\nActor: ${plan.actor.storeId}`);
    console.log(`Listing: ${plan.actor.listing}`);
    console.log(JSON.stringify(plan.input, null, 2));
  }
}

async function main() {
  const config = createConfig();
  validateConfig(config);
  const plans = buildPlans(config);
  printPlans(config, plans);

  if (config.dryRun) {
    console.log('\nDry run complete. No Actor run started.');
    return [];
  }

  const client = axios.create({
    baseURL: APIFY_API_BASE,
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json'
    }
  });

  const outputs = [];
  for (const plan of plans) {
    const result = await runActor(client, plan, config);
    const filename = writeResult(plan, result, config.outputDir);
    outputs.push(filename);
    console.log(`Saved ${result.items.length} items to ${filename}`);
  }

  return outputs;
}

if (require.main === module) {
  main().catch(error => {
    console.error(`Xquik Actor workflow failed: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = {
  ACTORS,
  buildFollowerInput,
  buildPlans,
  buildTweetInput,
  createConfig,
  isDiagnostic,
  parseBoolean,
  parseList,
  validateConfig,
  writeResult
};
