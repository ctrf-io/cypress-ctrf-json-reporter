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
		// tsup injects baseUrl; scope this option to the TypeScript 6 API build.
		compilerOptions: { ignoreDeprecations: "6.0" },
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
