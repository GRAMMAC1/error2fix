# MCP Benchmark Report

- Cases: 7
- Compression passing: 0/7
- Accuracy passing: 5/7
- Average reduction: 48.9%
- Average total MCP ratio: 51.1%

| Case | Raw KB | Brief KB | Evidence KB | Total MCP KB | Reduction | Tool Calls | Confidence | Must Hit | File Hit | Code Hit | Accuracy | Compression | Notes |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|---|---|
| dipper-react-module-not-found | 2.1 | 1.3 | 0.0 | 1.3 | 37.8% | 1 | 0.80 | 2/3 | 1/1 | n/a | fail | warn | brief ratio 62.2% > 25.0%; total MCP ratio 62.2% > 35.0% |
| filament-tailwind-vite-build-failure | 4.5 | 1.8 | 0.0 | 1.8 | 60.8% | 1 | 0.80 | 3/3 | 1/1 | n/a | pass | warn | brief ratio 39.2% > 25.0%; total MCP ratio 39.2% > 35.0% |
| frappe-hrms-vite-pwa-build-failure | 5.1 | 2.0 | 0.0 | 2.0 | 60.7% | 1 | 0.90 | 4/4 | 1/1 | n/a | pass | warn | brief ratio 39.3% > 25.0%; total MCP ratio 39.3% > 35.0% |
| react-scan-next-build-failure | 5.0 | 1.3 | 0.0 | 1.3 | 74.9% | 1 | 0.90 | 0/4 | 2/2 | n/a | fail | warn | brief ratio 25.1% > 25.0% |
| satellite-js-vite-build-failure | 13.1 | 3.4 | 0.0 | 3.4 | 73.7% | 1 | 0.90 | 4/4 | 1/1 | 1/1 | pass | warn | brief ratio 26.3% > 25.0% |
| svelte-vite-bindable-build-failure | 1.1 | 1.5 | 0.0 | 1.5 | -36.4% | 1 | 0.80 | 4/4 | 1/1 | 1/1 | pass | warn | brief ratio 136.4% > 25.0%; total MCP ratio 136.4% > 35.0% |
| tanstack-vite-devtools-build-failure | 4.9 | 1.4 | 0.0 | 1.4 | 70.6% | 1 | 0.90 | 4/4 | 1/1 | n/a | pass | warn | brief ratio 29.4% > 25.0% |
