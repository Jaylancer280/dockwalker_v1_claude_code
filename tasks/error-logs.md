20:09:08.665 Running build in Washington, D.C., USA (East) – iad1 (Turbo Build Machine)
20:09:08.665 Build machine configuration: 30 cores, 60 GB
20:09:08.761 Cloning github.com/NautalinkTechnologiesInc/dockwalker_v1_claude_code (Branch: main, Commit: b83622b)
20:09:11.582 Cloning completed: 2.821s
20:09:11.707 Restored build cache from previous deployment (pPj12RCVxCdq1vyvr9G9kdSHexi3)
20:09:11.956 Running "vercel build"
20:09:12.502 Vercel CLI 50.38.2
20:09:12.592 > Detected Turbo. Adjusting default settings...
20:09:12.803 Running "install" command: `npm install --prefix=../..`...
20:09:17.881
20:09:17.881 > prepare
20:09:17.881 > husky || true
20:09:17.881
20:09:17.933
20:09:17.933 changed 2 packages, and audited 1708 packages in 5s
20:09:17.933
20:09:17.933 323 packages are looking for funding
20:09:17.933 run `npm fund` for details
20:09:17.997
20:09:17.998 8 vulnerabilities (7 moderate, 1 high)
20:09:17.998
20:09:17.998 To address issues that do not require attention, run:
20:09:17.998 npm audit fix
20:09:17.998
20:09:17.998 To address all issues (including breaking changes), run:
20:09:17.998 npm audit fix --force
20:09:17.998
20:09:17.998 Run `npm audit` for details.
20:09:18.033 Detected Next.js version: 16.1.6
20:09:18.033 Running "turbo run build"
20:09:18.116
20:09:18.116 Attention:
20:09:18.116 Turborepo now collects completely anonymous telemetry regarding usage.
20:09:18.116 This information is used to shape the Turborepo roadmap and prioritize features.
20:09:18.116 You can learn more, including how to opt-out if you'd not like to participate in this anonymous program, by visiting the following URL:
20:09:18.116 https://turborepo.dev/docs/telemetry
20:09:18.116
20:09:18.275
20:09:18.276 • Packages in scope: web
20:09:18.276 • Running build in 1 packages
20:09:18.276 • Remote caching enabled
20:09:18.276
20:09:18.380 web:build: cache miss, executing e83f0bdfc5255fdd
20:09:18.489 web:build:
20:09:18.489 web:build: > web@0.1.0 build
20:09:18.489 web:build: > next build
20:09:18.489 web:build:
20:09:19.589 web:build: ▲ Next.js 16.1.6 (Turbopack)
20:09:19.589 web:build: - Experiments (use with caution):
20:09:19.589 web:build: · clientTraceMetadata
20:09:19.589 web:build: · serverActions
20:09:19.589 web:build:
20:09:20.101 web:build:
20:09:20.101 web:build: > Build error occurred
20:09:20.103 web:build: Error: Both middleware file "./src/src/middleware.ts" and proxy file "./src/src/proxy.ts" are detected. Please use "./src/src/proxy.ts" only. Learn more: https://nextjs.org/docs/messages/middleware-to-proxy
20:09:20.103 web:build: at ignore-listed frames
20:09:20.116 web:build: npm error Lifecycle script `build` failed with error:
20:09:20.116 web:build: npm error code 1
20:09:20.116 web:build: npm error path /vercel/path0/apps/web
20:09:20.116 web:build: npm error workspace web@0.1.0
20:09:20.116 web:build: npm error location /vercel/path0/apps/web
20:09:20.116 web:build: npm error command failed
20:09:20.116 web:build: npm error command sh -c next build
20:09:20.121 ERROR web#build: command (/vercel/path0/apps/web) /node24/bin/npm run build exited (1)
20:09:20.121 WARNING finished with warnings
20:09:20.121 Warning - the following environment variables are set on your Vercel project, but missing from "turbo.json". These variables WILL NOT be available to your application and may cause your build to fail. Learn more at https://turborepo.dev/docs/crafting-your-repository/using-environment-variables#platform-environment-variables
20:09:20.121
20:09:20.121 [warn] web#build
20:09:20.121 [warn] - SUPABASE_SERVICE_ROLE_KEY
20:09:20.121 [warn] - UPSTASH_REDIS_REST_URL
20:09:20.121 [warn] - UPSTASH_REDIS_REST_TOKEN
20:09:20.121 [warn] - CRON_SECRET
20:09:20.121 [warn] - ANTHROPIC_API_KEY
20:09:20.121 [warn] - OPENAI_API_KEY
20:09:20.121 [warn] - DOCKY_CORPUS_READY
20:09:20.123
20:09:20.123 Tasks: 0 successful, 1 total
20:09:20.123 Cached: 0 cached, 1 total
20:09:20.123 Time: 1.977s
20:09:20.123 Summary: /vercel/path0/.turbo/runs/3C5GkY5GUSHJFlagPMVLacLBzW8.json
20:09:20.123 Failed: web#build
20:09:20.123
20:09:20.129 ERROR run failed: command exited (1)
20:09:20.140 Error: Command "turbo run build" exited with 1
