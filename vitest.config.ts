import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node"
  },
  resolve: {
    alias: {
      obsidian: "/Users/am700/Projects/obsidian-flashcards-plugin/src/test/obsidian.ts"
    }
  }
});
