#!/usr/bin/env node

/**
 * Endesa Sentiment Analysis Routine
 * Collects and analyzes negative sentiment about Endesa from Reddit via Apify
 *
 * Usage: node endesa-sentiment.js
 * Requirements: npm install axios dotenv sentiment csv-writer exceljs
 */

const axios = require('axios');
const Sentiment = require('sentiment');
const { createObjectCsvWriter } = require('csv-writer');
const ExcelJS = require('exceljs');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ quiet: true });

// ============================================================================
// CONFIGURATION
// ============================================================================

function isExplicitlyEnabled(value) {
  return value === 'true';
}

const CONFIG = {
  apiKey: process.env.APIFY_API_KEY || '',
  sentimentThreshold: parseFloat(process.env.SENTIMENT_THRESHOLD || '-0.3'),
  maxResults: parseInt(process.env.MAX_RESULTS || '500'),
  outputDir: process.env.OUTPUT_DIR || './results',
  pushResults: isExplicitlyEnabled(process.env.PUSH_RESULTS)
};

const APIFY_API_BASE = 'https://api.apify.com/v2';

const REDDIT_CONFIG = {
  searchTerms: [
    'Endesa Portugal problemas',
    'EDP eletricidade queixa',
    'Endesa fatura indevida',
    'Endesa mau serviço',
    'Endesa reclamação'
  ],
  searchPosts: true,
  searchComments: false,
  searchCommunities: false,
  withinCommunity: 'r/portugal',
  maxPostsCount: Math.min(CONFIG.maxResults, 900),
  searchTime: 'month',
  searchSort: 'new'
};

// ============================================================================
// SENTIMENT ANALYSIS
// ============================================================================

const sentiment = new Sentiment();

// Portuguese-specific complaint patterns for enhanced detection
const COMPLAINT_PATTERNS_PT = [
  /problema|erro|defeito|falha/i,
  /queixa|reclamação|reclamar|denúncia/i,
  /não funciona|inoperante/i,
  /fatura alta|cobrança indevida|erro na cobrança|fatura errada/i,
  /cobrou-me|cobrou.*indevid|fatura.*estimativa|estimativa.*fatura|acerto.*fatura|fatura.*acerto/i,
  /mau serviço|péssimo serviço|atendimento ruim|péssimo atendimento/i,
  /abusivo|predador|exploração/i,
  /fraude|enganado|trapaceiro/i,
  /ineficiente|ineficácia/i
];

function analyzeSentiment(text) {
  if (!text) return { score: 0, comparative: 0, isNegative: false, hasComplaint: false };

  const result = sentiment.analyze(text);
  const hasComplaint = COMPLAINT_PATTERNS_PT.some(pattern => pattern.test(text));

  return {
    score: result.score,
    comparative: result.comparative,
    isNegative: result.score < CONFIG.sentimentThreshold || hasComplaint,
    hasComplaint: hasComplaint,
    rawScore: result.score
  };
}

// ============================================================================
// APIFY INTEGRATION
// ============================================================================

const apifyClient = axios.create({
  baseURL: APIFY_API_BASE,
  headers: {
    'Authorization': `Bearer ${CONFIG.apiKey}`,
    'Content-Type': 'application/json'
  }
});

const arcticShiftClient = axios.create({
  baseURL: 'https://arctic-shift.photon-reddit.com/api',
  headers: {
    'User-Agent': 'EndeSentimentBot/1.0 (+https://github.com/sjfonseca/endesa-sentiment-skill)',
    'Accept': 'application/json'
  },
  timeout: 30000
});

const TIME_RANGE_SECONDS = {
  hour: 3600, day: 86400, week: 604800, month: 2592000, year: 31536000, all: null
};

async function validateApiKey() {
  if (!CONFIG.apiKey) {
    throw new Error(
      'APIFY_API_KEY not set. Please configure it in .env file or environment variables.'
    );
  }

  try {
    const response = await apifyClient.get('/users/me');
    console.log(`✅ Apify authentication successful. User: ${response.data.data.username}`);
    return true;
  } catch (error) {
    throw new Error(`❌ Apify authentication failed: ${error.message}`);
  }
}

async function collectRedditPosts() {
  console.log('\n📡 Collecting Reddit posts via Arctic Shift API...');

  const subreddit = REDDIT_CONFIG.withinCommunity.replace(/^r\//, '');
  const rangeSeconds = TIME_RANGE_SECONDS[REDDIT_CONFIG.searchTime] || TIME_RANGE_SECONDS.month;
  const afterTs = rangeSeconds ? Math.floor(Date.now() / 1000) - rangeSeconds : null;

  // Arctic Shift searches by title keyword; extract the meaningful keyword per term
  const titleKeywords = [...new Set(
    REDDIT_CONFIG.searchTerms.flatMap(t => t.split(/\s+/))
      .filter(w => w.length >= 4 && !/^(com|para|mau|sem|uma|que)$/i.test(w))
  )];

  const seenIds = new Set();
  const allPosts = [];

  for (const keyword of titleKeywords) {
    if (allPosts.length >= CONFIG.maxResults) break;

    const params = { title: keyword, subreddit, limit: 100 };
    if (afterTs) params.after = afterTs;

    try {
      const res = await arcticShiftClient.get('/posts/search', { params });
      const posts = res.data?.data || [];

      let newCount = 0;
      for (const p of posts) {
        if (!seenIds.has(p.id)) {
          seenIds.add(p.id);
          allPosts.push({
            authorName: p.author,
            title: p.title,
            body: p.selftext || '',
            postUrl: `https://reddit.com${p.permalink}`,
            createdAt: new Date(p.created_utc * 1000).toISOString(),
            upVotes: p.ups,
            commentsCount: p.num_comments,
            parsedCommunityName: p.subreddit
          });
          newCount++;
        }
      }
      console.log(`  🔍 "${keyword}": ${newCount} new posts (total: ${allPosts.length})`);
    } catch (err) {
      console.warn(`  ⚠️  Fetch error for "${keyword}": ${err.message}`);
    }

    await new Promise(r => setTimeout(r, 500));
  }

  console.log(`✅ Collected ${allPosts.length} unique posts`);
  return allPosts;
}

// ============================================================================
// DATA PROCESSING
// ============================================================================

const RELEVANCE_KEYWORDS = /endesa|edp|eletricidade|electricidade/i;

function isRelevantPost(post) {
  const fullText = `${post.title || ''} ${post.body || ''}`;
  return RELEVANCE_KEYWORDS.test(fullText);
}

async function filterAndAnalyzePosts(redditPosts) {
  console.log('\n🧠 Analyzing sentiment on all posts...');

  const relevantPosts = redditPosts.filter(isRelevantPost);
  console.log(`   Relevant posts: ${relevantPosts.length}/${redditPosts.length} (filtered out ${redditPosts.length - relevantPosts.length} irrelevant)`);

  const allPosts = [];
  const stats = {
    total: relevantPosts.length,
    totalScraped: redditPosts.length,
    negative: 0,
    positive: 0,
    neutral: 0,
    avgSentiment: 0
  };

  let totalScore = 0;

  for (const post of relevantPosts) {
    const fullText = `${post.title || ''} ${post.body || ''}`;
    const analysis = analyzeSentiment(fullText);

    totalScore += analysis.score;

    let sentimentLabel;
    if (analysis.isNegative) {
      stats.negative++;
      sentimentLabel = 'Negative';
    } else if (analysis.score > 0) {
      stats.positive++;
      sentimentLabel = 'Positive';
    } else {
      stats.neutral++;
      sentimentLabel = 'Neutral';
    }

    allPosts.push({
      source: 'reddit',
      author: post.authorName || '[deleted]',
      title: post.title || '',
      content: (post.body || '').substring(0, 500),
      url: post.postUrl || '',
      timestamp: post.createdAt || '',
      upvotes: post.upVotes || 0,
      comments: post.commentsCount || 0,
      subreddit: post.parsedCommunityName || '',
      sentimentLabel,
      sentimentScore: analysis.score.toFixed(3),
      hasComplaint: analysis.hasComplaint ? 'Yes' : 'No',
      collectedAt: new Date().toISOString()
    });
  }

  stats.avgSentiment = relevantPosts.length > 0
    ? (totalScore / relevantPosts.length).toFixed(3)
    : '0';

  console.log(`\n📈 Sentiment Analysis Results:`);
  console.log(`   Total posts: ${stats.total}`);
  console.log(`   Negative: ${stats.negative}`);
  console.log(`   Positive: ${stats.positive}`);
  console.log(`   Neutral: ${stats.neutral}`);
  console.log(`   Average score: ${stats.avgSentiment}`);

  const negativePosts = allPosts.filter(p => p.sentimentLabel === 'Negative');
  return { posts: allPosts, negativePosts, stats };
}

// ============================================================================
// DATA EXPORT
// ============================================================================

function ensureOutputDir() {
  if (!fs.existsSync(CONFIG.outputDir)) {
    fs.mkdirSync(CONFIG.outputDir, { recursive: true });
  }
}

async function exportToCsv(negativePosts) {
  ensureOutputDir();

  const timestamp = new Date().toISOString().split('T')[0];
  const filename = path.join(CONFIG.outputDir, `endesa-sentiment-${timestamp}.csv`);

  const csvWriter = createObjectCsvWriter({
    path: filename,
    header: [
      { id: 'author', title: 'Author' },
      { id: 'title', title: 'Title' },
      { id: 'content', title: 'Content' },
      { id: 'url', title: 'URL' },
      { id: 'subreddit', title: 'Subreddit' },
      { id: 'timestamp', title: 'Post Date' },
      { id: 'upvotes', title: 'Upvotes' },
      { id: 'comments', title: 'Comments Count' },
      { id: 'sentimentLabel', title: 'Sentiment' },
      { id: 'sentimentScore', title: 'Sentiment Score' },
      { id: 'hasComplaint', title: 'Has Complaint' },
      { id: 'collectedAt', title: 'Collected At' }
    ]
  });

  await csvWriter.writeRecords(negativePosts);
  console.log(`\n💾 Exported ${negativePosts.length} posts to ${filename}`);

  return filename;
}

async function exportToExcel(posts, stats) {
  const negativePosts = posts;
  ensureOutputDir();

  const timestamp = new Date().toISOString().split('T')[0];
  const filename = path.join(CONFIG.outputDir, `endesa-sentiment-${timestamp}.xlsx`);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Endesa Sentiment Routine';
  workbook.created = new Date();

  // ── Sheet 1: Summary ──────────────────────────────────────────────────────
  const summarySheet = workbook.addWorksheet('Summary');

  summarySheet.columns = [
    { header: 'Metric', key: 'metric', width: 30 },
    { header: 'Value', key: 'value', width: 20 }
  ];

  const headerRow = summarySheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2C3E50' } };
  headerRow.alignment = { horizontal: 'center' };

  summarySheet.addRows([
    { metric: 'Run Date', value: timestamp },
    { metric: 'Total Posts Analyzed', value: stats.total },
    { metric: 'Total Posts Scraped', value: stats.totalScraped },
    { metric: 'Negative Posts', value: stats.negative },
    { metric: 'Positive Posts', value: stats.positive },
    { metric: 'Neutral Posts', value: stats.neutral },
    {
      metric: 'Negative %',
      value: stats.total > 0 ? `${((stats.negative / stats.total) * 100).toFixed(1)}%` : '0%'
    },
    { metric: 'Average Sentiment Score', value: parseFloat(stats.avgSentiment) },
    { metric: 'Sentiment Threshold', value: CONFIG.sentimentThreshold },
    { metric: 'Search Community', value: REDDIT_CONFIG.withinCommunity },
    { metric: 'Time Range', value: REDDIT_CONFIG.searchTime }
  ]);

  // Zebra striping on summary rows
  summarySheet.eachRow((row, rowNumber) => {
    if (rowNumber > 1) {
      const fill = rowNumber % 2 === 0
        ? { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } }
        : { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
      row.eachCell(cell => { cell.fill = fill; });
    }
  });

  // ── Sheet 2: All Posts ────────────────────────────────────────────────────
  const postsSheet = workbook.addWorksheet('All Posts');

  postsSheet.columns = [
    { header: 'Author', key: 'author', width: 18 },
    { header: 'Title', key: 'title', width: 45 },
    { header: 'Content', key: 'content', width: 60 },
    { header: 'URL', key: 'url', width: 50 },
    { header: 'Subreddit', key: 'subreddit', width: 14 },
    { header: 'Post Date', key: 'timestamp', width: 20 },
    { header: 'Upvotes', key: 'upvotes', width: 10 },
    { header: 'Comments', key: 'comments', width: 10 },
    { header: 'Sentiment', key: 'sentimentLabel', width: 12 },
    { header: 'Sentiment Score', key: 'sentimentScore', width: 16 },
    { header: 'Has Complaint', key: 'hasComplaint', width: 14 },
    { header: 'Collected At', key: 'collectedAt', width: 22 }
  ];

  const postsHeader = postsSheet.getRow(1);
  postsHeader.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  postsHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2C3E50' } };
  postsHeader.alignment = { horizontal: 'center', wrapText: true };
  postsSheet.getRow(1).height = 30;

  // Colour palette per sentiment label
  const LABEL_FILL = {
    Negative: { argb: 'FFFFF5F5' },
    Positive: { argb: 'FFF0FFF0' },
    Neutral:  { argb: 'FFFFF8E1' }
  };
  const LABEL_COLOR = {
    Negative: { argb: 'FFCC0000' },
    Positive: { argb: 'FF27AE60' },
    Neutral:  { argb: 'FF7D6608' }
  };

  negativePosts.forEach((post) => {
    const row = postsSheet.addRow(post);
    const bgArgb = LABEL_FILL[post.sentimentLabel] || { argb: 'FFFFFFFF' };
    row.eachCell(cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: bgArgb };
      cell.alignment = { wrapText: true, vertical: 'top' };
    });

    // Colour-code the Sentiment cell
    const labelCell = row.getCell('sentimentLabel');
    labelCell.font = { color: LABEL_COLOR[post.sentimentLabel] || {}, bold: true };

    // Clickable URL
    const urlCell = row.getCell('url');
    if (post.url) {
      urlCell.value = { text: post.url, hyperlink: post.url };
      urlCell.font = { color: { argb: 'FF0563C1' }, underline: true };
    }
  });

  postsSheet.autoFilter = { from: 'A1', to: 'L1' };

  await workbook.xlsx.writeFile(filename);
  console.log(`\n📊 Exported ${negativePosts.length} posts to ${filename}`);

  return filename;
}

function commitAndPushResults() {
  try {
    execSync('git config user.email || git config user.email "routine@claude.ai"', { stdio: 'pipe' });
    execSync('git config user.name || git config user.name "Endesa Routine"', { stdio: 'pipe' });

    const status = execSync('git status --porcelain results/', { stdio: 'pipe' }).toString().trim();
    if (!status) {
      console.log('\nℹ️  No new result files to commit.');
      return false;
    }

    const timestamp = new Date().toISOString().split('T')[0];
    execSync('git add results/', { stdio: 'pipe' });
    execSync(`git commit -m "chore: sentiment results ${timestamp}"`, { stdio: 'pipe' });
    execSync('git push', { stdio: 'pipe' });
    console.log(`\n✅ Results committed and pushed to GitHub (results/ — ${timestamp})`);
    return true;
  } catch (err) {
    console.log(`\n⚠️  Git push skipped: ${err.message.split('\n')[0]}`);
    return false;
  }
}

function generateReport(negativePosts, stats) {
  ensureOutputDir();

  const timestamp = new Date().toISOString().split('T')[0];
  const filename = path.join(CONFIG.outputDir, `report-${timestamp}.json`);

  // Extract top topics
  const topicFreq = {};
  negativePosts.forEach(post => {
    const words = (post.title + ' ' + post.content).toLowerCase().split(/\s+/);
    words.forEach(word => {
      if (word.length > 4) {
        topicFreq[word] = (topicFreq[word] || 0) + 1;
      }
    });
  });

  const topTopics = Object.entries(topicFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([topic, count]) => ({ topic, mentions: count }));

  // Most engaged posts
  const mostEngaged = negativePosts
    .sort((a, b) => b.upvotes - a.upvotes)
    .slice(0, 5)
    .map(p => ({
      title: p.title,
      upvotes: p.upvotes,
      comments: p.comments,
      score: p.sentimentScore
    }));

  const report = {
    generatedAt: new Date().toISOString(),
    summary: {
      totalPostsAnalyzed: stats.total,
      negativePostsFound: stats.negative,
      positivePostsFound: stats.positive,
      neutralPostsFound: stats.neutral,
      negativePercentage: stats.total > 0 ? ((stats.negative / stats.total) * 100).toFixed(1) : '0',
      averageSentimentScore: stats.avgSentiment
    },
    topTopics: topTopics,
    mostEngagedNegativePosts: mostEngaged,
    configuration: {
      searchTerms: REDDIT_CONFIG.searchTerms,
      community: REDDIT_CONFIG.withinCommunity,
      timeRange: REDDIT_CONFIG.searchTime,
      sentimentThreshold: CONFIG.sentimentThreshold
    }
  };

  fs.writeFileSync(filename, JSON.stringify(report, null, 2));
  console.log(`\n📊 Report saved to ${filename}`);

  // Print summary
  console.log('\n╔════════════════════════════════════════╗');
  console.log('║     ENDESA SENTIMENT ANALYSIS REPORT    ║');
  console.log('╚════════════════════════════════════════╝\n');
  console.log(`Total Posts Analyzed:  ${stats.total}`);
  console.log(`Negative Posts Found:  ${stats.negative} (${report.summary.negativePercentage}%)`);
  console.log(`Average Sentiment:     ${stats.avgSentiment}`);
  console.log(`\nTop Topics:`);
  topTopics.forEach((topic, idx) => {
    console.log(`  ${idx + 1}. ${topic.topic} (${topic.mentions} mentions)`);
  });

  return report;
}

// ============================================================================
// MAIN ORCHESTRATION
// ============================================================================

async function runEndesaSentimentRoutine() {
  console.log('\n╔═══════════════════════════════════════════════════╗');
  console.log('║   🚀 ENDESA SENTIMENT ANALYSIS ROUTINE 🚀        ║');
  console.log('╚═══════════════════════════════════════════════════╝\n');

  const startTime = Date.now();

  try {
    // Step 1: Validate Apify configuration
    console.log('Step 1: Validating Apify configuration...');
    await validateApiKey();

    // Steps 2-4: Collect Reddit posts directly via Reddit JSON API
    console.log('\nStep 2: Starting Reddit data collection...');
    const redditPosts = await collectRedditPosts();

    if (redditPosts.length === 0) {
      console.warn('⚠️  No posts found. Exiting.');
      return;
    }

    // Step 5: Analyze sentiment
    console.log('\nStep 5: Analyzing sentiment...');
    const { posts: allPosts, negativePosts, stats } = await filterAndAnalyzePosts(redditPosts);

    if (negativePosts.length === 0) {
      console.log('ℹ️  No negative sentiment posts found.');
    }

    // Step 6: Export results (all relevant posts)
    console.log('\nStep 6: Exporting results...');
    const csvFile = await exportToCsv(allPosts);
    const excelFile = await exportToExcel(allPosts, stats);

    // Step 7: Generate report (negative posts drive topics/engagement)
    console.log('\nStep 7: Generating report...');
    const report = generateReport(negativePosts, stats);

    // Step 8: Push only after the operator explicitly opts in
    if (CONFIG.pushResults) {
      console.log('\nStep 8: Pushing results to GitHub...');
      commitAndPushResults();
    } else {
      console.log('\nStep 8: Result push disabled. Set PUSH_RESULTS=true to opt in.');
    }

    // Summary
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n✨ Routine completed in ${duration}s`);
    console.log(`   CSV:   ${csvFile}`);
    console.log(`   Excel: ${excelFile}\n`);

    return {
      status: 'success',
      postsCollected: redditPosts.length,
      negativePostsFound: negativePosts.length,
      stats: stats,
      report: report,
      files: { csv: csvFile, excel: excelFile }
    };
  } catch (error) {
    console.error(`\n❌ Error: ${error.message}\n`);
    process.exit(1);
  }
}

// ============================================================================
// EXECUTION
// ============================================================================

if (require.main === module) {
  runEndesaSentimentRoutine();
}

module.exports = {
  analyzeSentiment,
  isExplicitlyEnabled,
  runEndesaSentimentRoutine
};
