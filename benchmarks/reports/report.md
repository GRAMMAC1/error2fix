# MCP Benchmark Report

- Cases: 7
- Accuracy passing: 5/7
- Tool-call passing: 7/7
- Average reduction: 60.9%
- Average total MCP ratio: 39.1%

| Case | Raw KB | Brief KB | Evidence KB | Total MCP KB | Reduction | Tool Calls | Confidence | Must Hit | File Hit | Code Hit | Accuracy | Tool Calls OK | Notes |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|---|---|
| dipper-react-module-not-found | 2.1 | 1.3 | 0.0 | 1.3 | 37.8% | 1 | 0.80 | 2/3 | 1/1 | n/a | ❌fail | ✅pass | - |
| filament-tailwind-vite-build-failure | 4.5 | 1.8 | 0.0 | 1.8 | 60.8% | 1 | 0.80 | 3/3 | 1/1 | n/a | ✅pass | ✅pass | - |
| frappe-hrms-vite-pwa-build-failure | 5.1 | 2.0 | 0.0 | 2.0 | 60.7% | 1 | 0.90 | 4/4 | 1/1 | n/a | ✅pass | ✅pass | - |
| react-scan-next-build-failure | 5.0 | 1.3 | 0.0 | 1.3 | 74.9% | 1 | 0.90 | 0/4 | 2/2 | n/a | ❌fail | ✅pass | - |
| satellite-js-vite-build-failure | 13.1 | 3.4 | 0.0 | 3.4 | 73.7% | 1 | 0.90 | 4/4 | 1/1 | 1/1 | ✅pass | ✅pass | - |
| svelte-vite-bindable-build-failure | 1.1 | 0.6 | 0.0 | 0.6 | 47.7% | 1 | 0.80 | 4/4 | 1/1 | 1/1 | ✅pass | ✅pass | - |
| tanstack-vite-devtools-build-failure | 4.9 | 1.4 | 0.0 | 1.4 | 70.6% | 1 | 0.90 | 4/4 | 1/1 | n/a | ✅pass | ✅pass | - |
