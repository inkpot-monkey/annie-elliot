import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: './tests',
    fullyParallel: true,
    retries: 1,
    reporter: 'html',
    use: {
        // 8081, not the 8080 `npm run dev` uses. The test server builds with
        // FIXTURE_DATA set; a dev server does not. Sharing a port would let
        // `reuseExistingServer` silently hand the suite a live-data build, and the
        // first `--update-snapshots` after that would bake the drift into the
        // baselines — exactly what the fixtures exist to prevent.
        baseURL: 'http://localhost:8081',
        trace: 'on-first-retry',
    },
    webServer: {
        // The gallery (Google Drive) and events (Google Calendar) pages are built
        // from live remote data, so their screenshots drifted whenever Annie added
        // a photo or an event — and the events page drifted on its own anyway, as
        // events crossed `now` and moved to the past section. FIXTURE_DATA swaps
        // both feeds for checked-in fixtures under tests/fixtures/, leaving every
        // transform, the row packer and the date partition running for real.
        // Its own output dir too: a fixture build must never be left sitting in
        // dist/ where a deploy could pick it up.
        command: 'npx @11ty/eleventy --serve --port=8081 --output=dist-test',
        env: { FIXTURE_DATA: '1' },
        url: 'http://localhost:8081',
        reuseExistingServer: !process.env.CI,
        timeout: 120 * 1000,
    },
    projects: [
        {
            name: 'Desktop',
            use: {
                ...devices['Desktop Chrome'],
                viewport: { width: 1920, height: 1080 },
                launchOptions: {
                    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
                },
            },
        },
        {
            name: 'Mobile',
            use: {
                ...devices['Pixel 5'],
                launchOptions: {
                    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
                },
            },
        },
    ],
});
