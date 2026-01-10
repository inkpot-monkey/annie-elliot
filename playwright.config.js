import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: './tests',
    fullyParallel: true,
    retries: 1,
    reporter: 'html',
    use: {
        baseURL: 'http://localhost:8080',
        trace: 'on-first-retry',
    },
    webServer: {
        command: 'npm run dev',
        url: 'http://localhost:8080',
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
