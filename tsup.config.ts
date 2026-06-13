import { defineConfig } from "tsup";

export default defineConfig({
	entry: {
		index: "src/index.ts",
		runtime: "src/runtime.ts",
		plugin: "src/plugin.ts",
		support: "src/support.ts",
	},
	format: ["esm", "cjs"],
	dts: {
		entry: {
			index: "src/index.ts",
			runtime: "src/runtime.ts",
			plugin: "src/plugin.ts",
			support: "src/support.ts",
		},
	},
	clean: true,
	shims: true,
	splitting: false,
	outDir: "dist",
});
