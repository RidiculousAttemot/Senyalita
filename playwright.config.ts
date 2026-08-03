import { defineConfig, devices } from '@playwright/test';

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// import dotenv from 'dotenv';
// import path from 'path';
// dotenv.config({ path: path.resolve(__dirname, '.env') });

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './e2e',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('')`. */
    // baseURL: 'http://localhost:3000',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      /* The camera specs get their own project below — they need browser-level
       * launch flags that would apply to every other spec if set here. */
      testIgnore: /camera-recognition\.spec\.ts/,
    },
    {
      /**
       * Drives the real capture loop against a synthetic camera, so
       * getUserMedia -> detectForVideo -> handedness -> the 30fps throttle ->
       * the sequence buffer -> the model can be exercised without hardware.
       *
       * The video file is a launch flag, so it is fixed per browser instance:
       * one project per fixture rather than switching mid-run. Fixtures are
       * generated (npm run e2e:fixtures) and gitignored — Y4M is uncompressed
       * and each is ~40MB.
       */
      name: 'camera-letter',
      testMatch: /camera-recognition\.spec\.ts/,
      grep: /@letter/,
      use: {
        ...devices['Desktop Chrome'],
        permissions: ['camera'],
        launchOptions: {
          args: [
            '--use-fake-device-for-media-stream',
            '--use-fake-ui-for-media-stream',
            // Software WebGL. Without it this browser has no usable WebGL
            // context, and MediaPipe's GPU delegate *hangs* rather than
            // throwing — so createHandLandmarker's CPU fallback never fires and
            // the page sits at "initializing" forever. A missing GPU must fail
            // fast here, not deadlock.
            '--enable-unsafe-swiftshader',
            '--ignore-gpu-blocklist',
            '--use-file-for-fake-video-capture=tmp/camera-fixtures/letter-b.y4m',
          ],
        },
      },
    },
    {
      name: 'camera-gesture',
      testMatch: /camera-recognition\.spec\.ts/,
      grep: /@gesture/,
      use: {
        ...devices['Desktop Chrome'],
        permissions: ['camera'],
        launchOptions: {
          args: [
            '--use-fake-device-for-media-stream',
            '--use-fake-ui-for-media-stream',
            // Software WebGL. Without it this browser has no usable WebGL
            // context, and MediaPipe's GPU delegate *hangs* rather than
            // throwing — so createHandLandmarker's CPU fallback never fires and
            // the page sits at "initializing" forever. A missing GPU must fail
            // fast here, not deadlock.
            '--enable-unsafe-swiftshader',
            '--ignore-gpu-blocklist',
            '--use-file-for-fake-video-capture=tmp/camera-fixtures/thank-you.y4m',
          ],
        },
      },
    },

    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
      /* The fake-camera flags are Chromium-only. */
      testIgnore: /camera-recognition\.spec\.ts/,
    },

    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
      testIgnore: /camera-recognition\.spec\.ts/,
    },

    /* Test against mobile viewports. */
    // {
    //   name: 'Mobile Chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
    // {
    //   name: 'Mobile Safari',
    //   use: { ...devices['iPhone 12'] },
    // },

    /* Test against branded browsers. */
    // {
    //   name: 'Microsoft Edge',
    //   use: { ...devices['Desktop Edge'], channel: 'msedge' },
    // },
    // {
    //   name: 'Google Chrome',
    //   use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    // },
  ],

  /* Run your local dev server before starting the tests */
  // webServer: {
  //   command: 'npm run start',
  //   url: 'http://localhost:3000',
  //   reuseExistingServer: !process.env.CI,
  // },
});
