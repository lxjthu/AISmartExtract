import esbuild from "esbuild";
import process from "process";

const prod = (process.argv[2] === "production");

const options = {
    entryPoints: ["src/main.ts"],
    bundle: true,
    external: ["obsidian"],
    format: "cjs",
    target: "es2016",
    logLevel: "info",
    sourcemap: prod ? false : "inline",
    treeShaking: true,
    outfile: "main.js",
};

if (prod) {
    esbuild.build(options).catch(() => process.exit(1));
} else {
    esbuild.context(options).then((ctx) => ctx.watch());
}