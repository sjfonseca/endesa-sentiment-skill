# Test Cases for Endesa Sentiment Analysis Skill

## Test 1: Basic Routine Setup

**Scenario:** User wants to set up the routine for the first time

**User Prompt:**
"I need to create a routine in Claude Code that collects negative sentiment about Endesa in Portugal from Reddit using Apify. What's the full setup?"

**Expected Output:**
- SKILL.md content covering all parts (prerequisites, architecture, code structure, Apify config, sentiment analysis, data storage, orchestration)
- Complete starter script with all functions
- Environment variable configuration
- Step-by-step instructions

**Success Criteria:**
- User can copy-paste script directly into Claude Code project
- Script runs without syntax errors
- References to Apify actors are correct
- Dependencies listed are complete

---

## Test 2: Apify Configuration

**Scenario:** User wants to understand how to configure Apify actors

**User Prompt:**
"How do I configure the Apify Reddit scraper to get posts specifically about billing complaints?"

**Expected Output:**
- Specific search query examples for billing complaints
- Recommended actor selection (reddit-post-scraper vs comments-scraper)
- Input configuration JSON with relevant parameters
- Live pricing review and bounded exposure
- Troubleshooting for no results

**Success Criteria:**
- Apify API configuration is accurate
- Query examples return relevant results
- Pricing comes from the current Actor listing
- Troubleshooting steps are practical

---

## Test 3: Sentiment Analysis Tuning

**Scenario:** User wants to adjust sensitivity of negative sentiment detection

**User Prompt:**
"Our current setup is catching too many neutral posts as negative. How do I make the sentiment filter stricter?"

**Expected Output:**
- Explanation of sentiment threshold parameter
- Concrete examples (score -0.3 vs -0.5)
- How to modify code for Portuguese-specific patterns
- Testing approach to verify changes

**Success Criteria:**
- Threshold explanation is clear with examples
- Code changes are minimal and safe
- Testing process is documented
- Results are measurable

---

## Test 4: Output Integration

**Scenario:** User wants to export results to Power BI

**User Prompt:**
"I need to set up automated daily reports that feed into Power BI. What should the CSV structure be?"

**Expected Output:**
- CSV column definitions
- Sample data with annotations
- Power BI connection steps
- Dashboard creation guidance
- Scheduling automation

**Success Criteria:**
- CSV format is Power BI compatible
- Sample data is realistic and diverse
- Dashboard examples are practical
- Automation is fully documented

---

## Test 5: Troubleshooting

**Scenario:** User encounters an error during execution

**User Prompt:**
"I'm getting 'Actor run failed' error when trying to scrape. The API key is correct. What could be wrong?"

**Expected Output:**
- Systematic troubleshooting steps
- Common causes for actor failures
- How to check actor logs via Apify
- Fallback strategies
- Debug output interpretation

**Success Criteria:**
- Troubleshooting steps are actionable
- Addresses multiple likely causes
- Includes ways to gather more info
- Points to Apify documentation when needed

---

## Test 6: Production Deployment

**Scenario:** User wants to run routine continuously in production

**User Prompt:**
"How do I deploy this to run 24/7 on a server? We need daily reports and Slack notifications."

**Expected Output:**
- Deployment architecture recommendation
- Docker configuration (optional)
- Environment setup on servers
- Slack/email notification integration
- Logging and monitoring setup
- Error handling and retries

**Success Criteria:**
- Deployment steps are production-ready
- Includes monitoring and alerting
- Error handling is comprehensive
- Logging enables debugging

---

## Test 7: Custom Search Terms

**Scenario:** User wants to analyze sentiment for competitor or different company

**User Prompt:**
"Can I use this for EDP instead of Endesa? What do I need to change?"

**Expected Output:**
- Minimal changes needed (just search queries)
- Appropriate subreddits for EDP
- Language/regional considerations
- Any company-specific patterns to watch for

**Success Criteria:**
- Setup is generalizable to other companies
- Search term quality matters more than brand name
- Regional subreddit selection is appropriate
- Skill is reusable for other use cases

---

## Integration Test Cases

### Test 7A: Xquik Tweet and Audience Plans

Verify dry-run inputs for both Xquik Actors. Confirm no Actor run starts.

### Test 7B: Xquik Approval Gate

Verify billable execution fails unless `X_ACTORS_APPROVED=true` and
`APIFY_API_KEY` is set.

### Test 7C: With Claude Code Environment
Verify scripts work when run via `claude-code run` command

### Test 7D: Error Recovery
Verify graceful handling of:
- API rate limits
- Network timeouts
- Invalid actor runs
- Malformed Reddit data

---

## Performance Metrics

After any routine runs:

✅ **Should observe:**
- Script completes in < 10 minutes for 500 posts
- CSV exports with all columns populated
- JSON report is valid JSON
- At least 10% of posts classified as negative
- Sentiment scores distribute across range (-1 to +1)

⚠️ **Watch for:**
- Duplicate posts across runs
- Missing author names (should say "[deleted]")
- Sentiment scores clustered at 0
- Timeout errors on large result sets

---

## Validation Checklist

For each test case execution:

- [ ] No syntax errors in output
- [ ] Code can be copy-pasted and run
- [ ] Dependencies are accurate and current
- [ ] Instructions are complete and sequential
- [ ] Examples are realistic and tested
- [ ] Error messages are actionable
- [ ] Troubleshooting addresses root causes
- [ ] Output files are well-formatted
- [ ] Security considerations mentioned (API keys, data privacy)
- [ ] Performance expectations set appropriately
- [ ] X Actor pricing is not hardcoded
- [ ] X Actor inputs have total and per-target caps
- [ ] Billable X Actor runs require a positive hard charge cap

---

## Edge Cases

1. **No posts found**
   - Verify search terms are valid
   - Check subreddit names
   - Extend time range

2. **All posts positive**
   - Lower sentiment threshold
   - Check for sarcasm detection issues
   - Verify complaint patterns are Portuguese-appropriate

3. **Rate limiting**
   - Implement backoff strategy
   - Split large requests
   - Cache results

4. **Deleted accounts**
   - Handle "[deleted]" author properly
   - Don't crash on missing content
   - Show warnings but continue processing

5. **Very long posts**
   - Truncate to manageable length
   - Preserve meaning in first 500 chars
   - Note full content available in URL

---

**Last Updated:** 2024-01-15

Xquik is an independent third-party service. Not affiliated with X Corp. "Twitter" and "X" are trademarks of X Corp.
