#!/usr/bin/env node
/*
 * AlgoLab dev quiz dumper. Not imported by the app.
 *
 *   node dev/dump_quizzes.mjs
 *
 * Prints one JSON document to stdout:
 *   { "<quizId>": { "questions": [ {id, topic?, prompt, options:[{id,text}], correctOptionId, ...} ] } }
 *
 * Uses the same ES-module loading technique as dev/validate_content.mjs.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const DEV_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(DEV_DIR, "..");
const FRONTEND = path.join(ROOT, "frontend");

function buildTempModules() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "algolab-dump-"));
    const absoluteDir = path.join(FRONTEND, "js/quizzes");
    const quizModules = fs.readdirSync(absoluteDir)
        .filter((name) => name.endsWith(".js"))
        .sort()
        .map((name) => `js/quizzes/${name}`);

    for (const relativePath of quizModules) {
        const source = fs.readFileSync(path.join(FRONTEND, relativePath), "utf8");
        const rewritten = source.replace(/(from\s+["'][^"']+)\.js(["'])/g, "$1.mjs$2");
        const outName = `${path.basename(relativePath, ".js")}.mjs`;
        fs.writeFileSync(path.join(dir, outName), rewritten);
    }
    return { dir, quizModules: quizModules.map((p) => `${path.basename(p, ".js")}.mjs`) };
}

const temp = buildTempModules();
try {
    const registry = await import(pathToFileURL(path.join(temp.dir, "index.mjs")).href);
    const quizzes = registry.listQuizzes();
    const out = {};
    for (const q of quizzes) {
        out[q.id] = { questions: q.questions };
    }
    process.stdout.write(JSON.stringify(out, null, 2));
    process.stdout.write("\n");
} finally {
    fs.rmSync(temp.dir, { recursive: true, force: true });
}
