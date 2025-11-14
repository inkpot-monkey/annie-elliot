#!/usr/bin/env node

/**
 * Accessibility Testing Script using pa11y
 * Tests accessibility of the built site
 */

// Set environment variables BEFORE importing pa11y/Puppeteer
// This must happen before any Puppeteer initialization
import { execSync } from 'child_process';

// Try to find system Chromium/Chrome binary FIRST
function findBrowserExecutable() {
  // Check environment variable first
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }

  // Try common browser binary names
  const browserNames = ['chromium', 'chromium-browser', 'google-chrome', 'google-chrome-stable'];
  
  for (const browserName of browserNames) {
    try {
      const path = execSync(`which ${browserName}`, { encoding: 'utf8' }).trim();
      if (path) {
        return path;
      }
    } catch (e) {
      // Continue to next option
    }
  }

  return null;
}

const browserExecutable = findBrowserExecutable();

// Set environment variables for Puppeteer to use system browser
// MUST be set before importing pa11y
if (browserExecutable) {
  if (!process.env.PUPPETEER_EXECUTABLE_PATH) {
    process.env.PUPPETEER_EXECUTABLE_PATH = browserExecutable;
  }
  // Prevent Puppeteer from trying to download Chrome
  process.env.PUPPETEER_SKIP_CHROMIUM_DOWNLOAD = '1';
}

// Now import pa11y (Puppeteer will use the env vars we just set)
import pa11y from 'pa11y';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const pages = [
  { url: 'http://localhost:8080/', name: 'Home' },
  { url: 'http://localhost:8080/author/', name: 'Author' },
  { url: 'http://localhost:8080/events/', name: 'Events' },
  { url: 'http://localhost:8080/contact/', name: 'Contact' },
];

// browserExecutable was already found and env vars set above

const options = {
  standard: 'WCAG2AA',
  runners: ['axe', 'htmlcs'],
  log: {
    debug: console.log,
    error: console.error,
    info: console.log,
  },
  // Configure Puppeteer to use system browser if found
  ...(browserExecutable && {
    chromeLaunchOptions: {
      executablePath: browserExecutable,
      args: ['--no-sandbox', '--disable-setuid-sandbox'], // Required for NixOS
    },
  }),
};

if (browserExecutable) {
  console.log(`📦 Using system browser: ${browserExecutable}`);
};

async function testPage(page) {
  try {
    console.log(`\n🔍 Testing ${page.name} (${page.url})...`);
    const results = await pa11y(page.url, options);
    
    if (results.issues.length === 0) {
      console.log(`   ✅ No issues found`);
      return { page: page.name, issues: 0, warnings: 0, errors: 0 };
    }
    
    const errors = results.issues.filter(i => i.type === 'error');
    const warnings = results.issues.filter(i => i.type === 'warning');
    const notices = results.issues.filter(i => i.type === 'notice');
    
    console.log(`   ❌ ${errors.length} errors, ⚠️  ${warnings.length} warnings, ℹ️  ${notices.length} notices`);
    
    if (errors.length > 0) {
      console.log('\n   Errors:');
      errors.forEach(issue => {
        console.log(`     - ${issue.message}`);
        console.log(`       Code: ${issue.code}`);
        if (issue.selector) console.log(`       Selector: ${issue.selector}`);
      });
    }
    
    if (warnings.length > 0) {
      console.log('\n   Warnings:');
      warnings.slice(0, 5).forEach(issue => { // Show first 5 warnings
        console.log(`     - ${issue.message}`);
      });
      if (warnings.length > 5) {
        console.log(`     ... and ${warnings.length - 5} more warnings`);
      }
    }
    
    return {
      page: page.name,
      issues: results.issues.length,
      errors: errors.length,
      warnings: warnings.length,
      notices: notices.length,
      results: results,
    };
  } catch (error) {
    console.error(`   ❌ Error testing ${page.name}:`, error.message);
    return { page: page.name, error: error.message };
  }
}

async function runTests() {
  console.log('♿ Accessibility Testing (pa11y)\n');
  console.log('=' .repeat(60));
  
  if (browserExecutable) {
    console.log(`\n✅ Using system browser: ${browserExecutable}`);
  } else {
    console.log('\n⚠️  No system browser found, Puppeteer will try to use bundled Chrome');
    console.log('   For NixOS, set PUPPETEER_EXECUTABLE_PATH or add chromium to flake.nix');
  }
  
  console.log('\n⚠️  Make sure the site is running on http://localhost:8080');
  console.log('   Run: npx serve dist -p 8080\n');
  
  const results = [];
  
  for (const page of pages) {
    const result = await testPage(page);
    results.push(result);
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('\n📊 Summary:\n');
  
  let totalErrors = 0;
  let totalWarnings = 0;
  
  results.forEach(result => {
    if (result.error) {
      console.log(`❌ ${result.page}: ${result.error}`);
    } else {
      console.log(`${result.page}: ${result.errors} errors, ${result.warnings} warnings`);
      totalErrors += result.errors || 0;
      totalWarnings += result.warnings || 0;
    }
  });
  
  console.log(`\nTotal: ${totalErrors} errors, ${totalWarnings} warnings`);
  
  if (totalErrors === 0 && totalWarnings === 0) {
    console.log('\n✅ All accessibility checks passed!');
    process.exit(0);
  } else {
    process.exit(totalErrors > 0 ? 1 : 0);
  }
}

runTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
