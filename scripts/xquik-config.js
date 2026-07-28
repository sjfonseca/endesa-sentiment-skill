'use strict';

const ACTORS = Object.freeze({
  tweet: Object.freeze({
    apiId: 'xquik~x-tweet-scraper',
    storeId: 'xquik/x-tweet-scraper',
    stableId: 'wAusCMrm284Voaw86',
    listing: 'https://apify.com/xquik/x-tweet-scraper'
  }),
  follower: Object.freeze({
    apiId: 'xquik~x-follower-scraper',
    storeId: 'xquik/x-follower-scraper',
    stableId: 'AaT0BcKU5GQh97wdt',
    listing: 'https://apify.com/xquik/x-follower-scraper'
  })
});

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
const TWEET_OUTPUT_VARIANTS = new Set([
  'legacy',
  'rich',
  'raw',
  'compact',
  'full'
]);
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
  const parsed = Number(value ?? fallback);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return parsed;
}

function parseOptionalPositiveNumber(value, name) {
  if (value === undefined || value === '') return null;

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive number.`);
  }
  return parsed;
}

function requireChoice(value, allowed, name) {
  if (!allowed.has(value)) {
    throw new Error(`${name} must be one of: ${[...allowed].join(', ')}.`);
  }
  return value;
}

function createTweetConfig(env) {
  return {
    enabled: parseBoolean(env.X_TWEET_ENABLED, false),
    searchTerms: parseList(env.X_SEARCH_TERMS),
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
  };
}

function createFollowerConfig(env) {
  return {
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
  };
}

function createConfig(env = process.env) {
  return {
    apiKey: env.APIFY_API_KEY || '',
    approved: parseBoolean(env.X_ACTORS_APPROVED, false),
    dryRun: parseBoolean(env.X_ACTOR_DRY_RUN, true),
    maxTotalChargeUsd: parseOptionalPositiveNumber(
      env.X_MAX_TOTAL_CHARGE_USD,
      'X_MAX_TOTAL_CHARGE_USD'
    ),
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
    requestTimeoutMs: parsePositiveInteger(
      env.REQUEST_TIMEOUT,
      30000,
      'REQUEST_TIMEOUT'
    ),
    tweet: createTweetConfig(env),
    follower: createFollowerConfig(env)
  };
}

function validateFollowerConfig(config) {
  const targetCount = [
    config.urls,
    config.handles,
    config.listIds,
    config.communityIds
  ].reduce((total, values) => total + values.length, 0);

  if (targetCount === 0) {
    throw new Error(
      'X Follower Scraper needs a URL, handle, list ID, or community ID.'
    );
  }

  if (config.handles.length > 0 && !ACCOUNT_RELATIONS.has(config.relation)) {
    throw new Error('X_AUDIENCE_HANDLES requires an account relation.');
  }

  if (config.listIds.length > 0 && !LIST_RELATIONS.has(config.relation)) {
    throw new Error(
      'X_AUDIENCE_LIST_IDS requires list_members or list_followers.'
    );
  }

  if (
    config.communityIds.length > 0 &&
    config.relation !== 'community_members'
  ) {
    throw new Error(
      'X_AUDIENCE_COMMUNITY_IDS requires community_members.'
    );
  }
}

function validateExecutionConfig(config) {
  if (config.dryRun) return;

  if (!config.approved) {
    throw new Error(
      'Billable runs require X_ACTORS_APPROVED=true after a live pricing review.'
    );
  }
  if (!config.apiKey) {
    throw new Error(
      'APIFY_API_KEY is required for execution. Keep it in the environment.'
    );
  }
  if (config.maxTotalChargeUsd === null) {
    throw new Error(
      'Billable runs require a positive X_MAX_TOTAL_CHARGE_USD.'
    );
  }
}

function validateConfig(config) {
  if (!config.tweet.enabled && !config.follower.enabled) {
    throw new Error(
      'Enable X_TWEET_ENABLED, X_FOLLOWER_ENABLED, or both.'
    );
  }
  if (config.tweet.enabled && config.tweet.searchTerms.length === 0) {
    throw new Error('X Tweet Scraper needs at least 1 search term.');
  }
  if (config.follower.enabled) validateFollowerConfig(config.follower);
  validateExecutionConfig(config);
}

function buildTweetInput(config) {
  return {
    mode: 'search',
    searchTerms: config.searchTerms,
    maxItems: config.maxItems,
    maxItemsPerTarget: config.maxItemsPerTarget,
    outputVariant: config.outputVariant,
    fieldStyle: config.fieldStyle,
    outputPreset: config.outputPreset,
    includeSearchTerms: config.searchTerms.length > 0,
    includeUnavailableFields: true
  };
}

function buildFollowerInput(config) {
  return {
    startUrls: config.urls,
    twitterHandles: config.handles,
    listIds: config.listIds,
    communityIds: config.communityIds,
    relation: config.relation,
    maxItems: config.maxItems,
    maxItemsPerTarget: config.maxItemsPerTarget,
    outputMode: config.outputMode,
    includeTargetMetadata: true,
    includeUnavailableFields: true,
    includeUnavailableUsers: true,
    dedupeMode: config.dedupeMode,
    overlapMode: config.dedupeMode === 'merge'
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

module.exports = {
  ACTORS,
  buildFollowerInput,
  buildPlans,
  buildTweetInput,
  createConfig,
  parseBoolean,
  parseList,
  parseOptionalPositiveNumber,
  validateConfig
};
