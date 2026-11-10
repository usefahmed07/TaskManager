import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    fileParallelism: false,
    hookTimeout: 120000,
    env: {
      NODE_ENV: "test",
      SECRET_KEY: "test-secret-key",
      BASE_URL: "http://localhost:8000"
    }
  }
});
