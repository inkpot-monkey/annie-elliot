
import puppeteer from 'puppeteer';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function testSeo() {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();

  // Point to the local file for testing
  const filePath = join(__dirname, '../dist/index.html');
  await page.goto(`file://${filePath}`);

  console.log('Testing SEO requirements...');
  let hasErrors = false;

  // 1. Test Title
  const title = await page.title();
  const expectedTitle = "Mr & Mrs Charles Dickens: Her Story | A Novel by Annie Elliot";
  if (title === expectedTitle) {
    console.log('✅ Title Correct:', title);
  } else {
    console.error('❌ Title Incorrect:', title);
    hasErrors = true;
  }

  // 2. Test Description
  const description = await page.$eval('meta[name="description"]', el => el.content);
  const expectedDescription = "Discover the untold story of Mrs Dickens. Annie Elliot's historical novel reveals the life of Catherine Dickens, the woman behind the famous author.";
  if (description === expectedDescription) {
    console.log('✅ Description Correct:', description);
  } else {
    console.error('❌ Description Incorrect:', description);
    hasErrors = true;
  }

  // 3. Test Viewport
  const viewport = await page.$('meta[name="viewport"]');
  if (viewport) {
    console.log('✅ Viewport tag exists');
  } else {
    console.error('❌ Viewport tag missing');
    hasErrors = true;
  }

  // 4. Test JSON-LD Schema
  const ldJsonScripts = await page.$$eval('script[type="application/ld+json"]', scripts =>
    scripts.map(s => {
      try {
        if (!s.innerText || s.innerText.trim() === '') return [];
        return JSON.parse(s.innerText);
      } catch (e) {
        return { error: e.message, text: s.innerText };
      }
    })
  );

  // Flatten the array if it's an array of arrays (some implementations)
  const schemaObjects = ldJsonScripts.flat();
  console.log("Found Schema Objects:", JSON.stringify(schemaObjects, null, 2));

  const bookSchema = schemaObjects.find(s => s['@type'] === 'Book');

  if (bookSchema) {
    console.log('✅ Book Schema found');

    // Check specific fields
    const checks = [
      { field: 'name', expected: "Mr & Mrs Charles Dickens: Her Story" },
      { field: 'author.name', expected: "Annie Elliot" },
      // Check for image URL ending - exact match might be tricky with file:// path vs https://
      { field: 'image', customCheck: (val) => val.includes('/images/book-cover.jpg') },
      { field: 'workExample.isbn', expected: "978-1784650961" }
    ];

    checks.forEach(check => {
      let val = bookSchema;
      const parts = check.field.split('.');
      for (const part of parts) {
        val = val ? val[part] : undefined;
      }

      if (check.customCheck) {
        if (check.customCheck(val)) {
          console.log(`✅ Schema field ${check.field} correct`);
        } else {
          console.error(`❌ Schema field ${check.field} incorrect. Got: ${val}`);
          hasErrors = true;
        }
      } else if (val === check.expected) {
        console.log(`✅ Schema field ${check.field} correct`);
      } else {
        console.error(`❌ Schema field ${check.field} incorrect. Expected "${check.expected}", got "${val}"`);
        hasErrors = true;
      }
    });

  } else {
    console.error('❌ Book Schema missing');
    hasErrors = true;
  }

  // 5. Check Image existence (logic check, puppeteer verified file exists by schema url check partially but let's be sure)
  // Since we are loading via file://, checking network request for image might be tricky if not rendered on page visibly or if lazy loaded.
  // But we can check if the file exists in dist using fs

  // 6. Test Open Graph Tags
  const ogTitle = await page.$eval('meta[property="og:title"]', el => el.content).catch(() => null);
  const ogDescription = await page.$eval('meta[property="og:description"]', el => el.content).catch(() => null);
  const ogImage = await page.$eval('meta[property="og:image"]', el => el.content).catch(() => null);

  if (ogTitle && ogDescription && ogImage) {
    console.log('✅ Open Graph Tags present');
  } else {
    console.error('❌ Open Graph Tags missing');
    hasErrors = true;
  }

  // 7. Test Semantic Reviews (Only if reviews section exists)
  const reviewsSection = await page.$('#reviews');
  if (reviewsSection) {
    const figures = await page.$$('section#reviews figure.review-card');
    const blockquotes = await page.$$('section#reviews blockquote.quote');
    const figcaptions = await page.$$('section#reviews figcaption.reviewer');
    const h3 = await page.$('section#reviews h3');

    if (figures.length > 0 && blockquotes.length > 0 && figcaptions.length > 0) {
      console.log('✅ Semantic Review Markup correct (figure, blockquote, figcaption)');
    } else {
      console.error('❌ Semantic Review Markup incorrect');
      hasErrors = true;
    }

    if (h3) {
      console.log('✅ Review Heading Hierarchy correct (h3)');
    } else {
      console.error('❌ Review Heading Hierarchy incorrect (expected h3)');
      hasErrors = true;
    }
  }

  await browser.close();

  if (hasErrors) {
    console.error('SEO Tests Failed');
    process.exit(1);
  } else {
    console.log('All SEO Tests Passed');
  }
}

testSeo();
