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
const {
  ACTORS,
  buildFollowerInput,
  buildPlans,
  buildTweetInput,
  createConfig,
  parseBoolean,
  parseList,
  parseOptionalPositiveNumber,
  validateConfig
} = require('./xquik-config');

const TERMINAL_FAILURES = new Set([
  'ABORTED',
  'FAILED',
  'TIMED-OUT'
]);

function delay(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

function requireApifyId(value, name) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new Error(`${name} is missing or invalid.`);
  }
  return value;
}

async function runActor(client, plan, config) {
  const runResponse = await client.post(
    `/actors/${plan.actor.apiId}/runs`,
    plan.input,
    {
      params: {
        maxTotalChargeUsd: config.maxTotalChargeUsd
      }
    }
  );
  const initialRun = runResponse?.data?.data;
  const runId = requireApifyId(initialRun?.id, 'Actor run ID');
  const startedAt = Date.now();

  console.log(`Started ${plan.actor.storeId}. Run ID: ${runId}`);

  while (Date.now() - startedAt < config.maxWaitMs) {
    const statusResponse = await client.get(`/actor-runs/${runId}`);
    const run = statusResponse?.data?.data;
    if (typeof run?.status !== 'string') {
      throw new Error('Actor status response is missing a valid status.');
    }

    if (run.status === 'SUCCEEDED') {
      const datasetId = requireApifyId(
        run.defaultDatasetId,
        'Actor dataset ID'
      );
      const datasetResponse = await client.get(
        `/datasets/${datasetId}/items`,
        { params: { clean: true, format: 'json' } }
      );
      if (!Array.isArray(datasetResponse.data)) {
        throw new Error('Actor dataset response must be a JSON array.');
      }

      return {
        runId,
        datasetId,
        items: datasetResponse.data
      };
    }

    if (TERMINAL_FAILURES.has(run.status)) {
      throw new Error(
        `${plan.actor.storeId} ended with ${run.status}. Run ID: ${runId}`
      );
    }

    await delay(config.pollIntervalMs);
  }

  try {
    await client.post(`/actor-runs/${runId}/abort`);
  } catch {
    // Keep the original timeout error.
  }

  throw new Error(
    `${plan.actor.storeId} timed out. Run ID: ${runId}`
  );
}

function isDiagnostic(item) {
  if (!item || typeof item !== 'object') return false;
  if (item.error || item.errorMessage || item.unavailableReason) return true;

  return ['resultType', 'type', 'recordType', 'rowType', 'status'].some(key => {
    const value = item[key];
    if (typeof value !== 'string') return false;
    return /diagnostic|unavailable|error/i.test(value);
  });
}

function partitionItems(items) {
  if (!Array.isArray(items)) {
    throw new Error('Actor dataset response must be a JSON array.');
  }
  return items.reduce(
    (result, item) => {
      result[isDiagnostic(item) ? 'diagnostics' : 'items'].push(item);
      return result;
    },
    { items: [], diagnostics: [] }
  );
}

function writeResult(plan, result, outputDir) {
  const runId = requireApifyId(result.runId, 'Actor run ID');
  const datasetId = requireApifyId(result.datasetId, 'Actor dataset ID');
  fs.mkdirSync(outputDir, { recursive: true });

  const date = new Date().toISOString().split('T')[0];
  const filename = path.join(
    outputDir,
    `xquik-${plan.key}-${date}-${runId}.json`
  );
  const partitioned = partitionItems(result.items);
  const payload = {
    actor: plan.actor.storeId,
    actorId: plan.actor.stableId,
    listing: plan.actor.listing,
    runId,
    datasetId,
    collectedAt: new Date().toISOString(),
    input: plan.input,
    itemCount: partitioned.items.length,
    diagnosticCount: partitioned.diagnostics.length,
    items: partitioned.items,
    diagnostics: partitioned.diagnostics
  };

  fs.writeFileSync(filename, JSON.stringify(payload, null, 2));
  return filename;
}

function printPlans(config, plans) {
  console.log('\nXquik Apify Actor plan');
  console.log(`Mode: ${config.dryRun ? 'dry run' : 'approved execution'}`);

  for (const plan of plans) {
    console.log(`\nActor: ${plan.actor.storeId}`);
    console.log(`Actor ID: ${plan.actor.stableId}`);
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
    timeout: config.requestTimeoutMs,
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json'
    }
  });

  const outputs = [];
  for (const plan of plans) {
    const result = await runActor(client, plan, config);
    const filename = writeResult(plan, result, config.outputDir);
    const dataCount = partitionItems(result.items).items.length;
    outputs.push(filename);
    console.log(`Saved ${dataCount} data rows to ${filename}`);
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
  parseOptionalPositiveNumber,
  parseBoolean,
  parseList,
  partitionItems,
  runActor,
  validateConfig,
  writeResult
};
