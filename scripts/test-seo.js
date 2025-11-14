#!/usr/bin/env node

/**
 * SEO Testing Script
 * Tests various SEO aspects of the built site
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const distDir = join(__dirname, '../dist');

const issues = [];
const warnings = [];
let pagesChecked = 0;

function getAllHtmlFiles(dir, fileList = []) {
  const files = readdirSync(dir);
  
  files.forEach(file => {
    const filePath = join(dir, file);
    const stat = statSync(filePath);
    
    if (stat.isDirectory()) {
      getAllHtmlFiles(filePath, fileList);
    } else if (extname(file) === '.html' && !file.includes('email')) {
      fileList.push(filePath);
    }
  });
  
  return fileList;
}

function checkFile(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  const relPath = filePath.replace(distDir, '');
  pagesChecked++;
  
  // Check for title tag
  const titleMatch = content.match(/<title[^>]*>(.*?)<\/title>/s);
  if (!titleMatch) {
    issues.push(`❌ ${relPath}: Missing <title> tag`);
  } else if (titleMatch[1].trim().length < 10) {
    warnings.push(`⚠️  ${relPath}: Title too short: "${titleMatch[1].trim()}"`);
  }
  
  // Check for meta description
  const descMatch = content.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/);
  if (!descMatch) {
    issues.push(`❌ ${relPath}: Missing meta description`);
  } else if (descMatch[1].length < 50) {
    warnings.push(`⚠️  ${relPath}: Meta description too short (${descMatch[1].length} chars, recommend 120-160)`);
  } else if (descMatch[1].length > 160) {
    warnings.push(`⚠️  ${relPath}: Meta description too long (${descMatch[1].length} chars, recommend 120-160)`);
  }
  
  // Check for canonical URL
  if (!content.includes('rel="canonical"') && !content.includes("rel='canonical'")) {
    issues.push(`❌ ${relPath}: Missing canonical URL`);
  }
  
  // Check for h1 tag
  const h1Matches = content.match(/<h1[^>]*>/g);
  if (!h1Matches || h1Matches.length === 0) {
    issues.push(`❌ ${relPath}: Missing <h1> tag`);
  } else if (h1Matches.length > 1) {
    warnings.push(`⚠️  ${relPath}: Multiple <h1> tags (${h1Matches.length}), should be only one`);
  }
  
  // Check for structured data
  if (!content.includes('application/ld+json')) {
    warnings.push(`⚠️  ${relPath}: No structured data (JSON-LD) found`);
  }
  
  // Check for lang attribute
  if (!content.match(/<html[^>]*lang=/i)) {
    issues.push(`❌ ${relPath}: Missing lang attribute on <html>`);
  }
  
  // Check images for alt text
  const imgMatches = content.match(/<img[^>]*>/g);
  if (imgMatches) {
    imgMatches.forEach(img => {
      if (!img.includes('alt=')) {
        issues.push(`❌ ${relPath}: Image missing alt attribute: ${img.substring(0, 50)}...`);
      }
    });
  }
  
  // Check for main landmark
  if (!content.includes('<main')) {
    warnings.push(`⚠️  ${relPath}: Missing <main> landmark`);
  }
}

console.log('🔍 SEO Testing Script\n');
console.log('=' .repeat(60));

const htmlFiles = getAllHtmlFiles(distDir);

if (htmlFiles.length === 0) {
  console.log('❌ No HTML files found in dist directory');
  console.log('   Run "npm run build" first');
  process.exit(1);
}

htmlFiles.forEach(checkFile);

console.log(`\n📊 Results: ${pagesChecked} pages checked\n`);

if (issues.length > 0) {
  console.log('❌ CRITICAL ISSUES:');
  issues.forEach(issue => console.log(`   ${issue}`));
  console.log('');
}

if (warnings.length > 0) {
  console.log('⚠️  WARNINGS:');
  warnings.forEach(warning => console.log(`   ${warning}`));
  console.log('');
}

if (issues.length === 0 && warnings.length === 0) {
  console.log('✅ All SEO checks passed!');
  process.exit(0);
} else {
  console.log(`\n📈 Summary: ${issues.length} issues, ${warnings.length} warnings`);
  process.exit(issues.length > 0 ? 1 : 0);
}
