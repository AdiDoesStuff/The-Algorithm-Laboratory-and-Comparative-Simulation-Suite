#!/usr/bin/env node
/*
 * AlgoLab dev lesson dumper. Not imported by the app.
 *
 *   node dev/dump_lessons.mjs
 *
 * Prints one JSON document to stdout:
 *   { "<lessonId>": { "checkpoints": [ {id?, prompt, choices:[{id,text}], correctChoiceId?, reveal, ...} ] } }
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
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "algolab-dump-lessons-"));
    const absoluteDir = path.join(FRONTEND, "js/lessons");
    const lessonModules = fs.readdirSync(absoluteDir)
        .filter((name) => name.endsWith(".js"))
        .sort()
        .map((name) => `js/lessons/${name}`);

    for (const relativePath of lessonModules) {
        const source = fs.readFileSync(path.join(FRONTEND, relativePath), "utf8");
        const rewritten = source.replace(/(from\s+["'][^"']+)\.js(["'])/g, "$1.mjs$2");
        const outName = `${path.basename(relativePath, ".js")}.mjs`;
        fs.writeFileSync(path.join(dir, outName), rewritten);
    }
    return { dir, lessonModules: lessonModules.map((p) => `${path.basename(p, ".js")}.mjs`) };
}

const temp = buildTempModules();
try {
    const out = {};
    for (const moduleName of temp.lessonModules) {
        const module = await import(pathToFileURL(path.join(temp.dir, moduleName)).href);
        for (const [exportName, value] of Object.entries(module)) {
            if (!exportName.endsWith("_LESSONS")) continue;
            if (!Array.isArray(value)) continue;
            for (const lesson of value) {
                const cps = Array.isArray(lesson.checkpoints) ? lesson.checkpoints : [];
                out[lesson.id] = {
                    checkpoints: cps.map((cp, idx) => ({
                        id: cp.id || `${lesson.id}-cp${idx + 1}`,
                        prompt: cp.prompt,
                        choices: (Array.isArray(cp.choices) ? cp.choices : []).map((c, i) => ({
                            id: (typeof c === "string") ? `opt${i}` : (c.id || `opt${i}`),
                            text: (typeof c === "string") ? c : (c.text || c.label || String(c))
                        })),
                        correctChoiceId: (typeof cp.answer === "number")
                            ? `opt${cp.answer}`
                            : cp.correctChoiceId,
                        reveal: cp.reveal
                    }))
                };
            }
        }
    }
    process.stdout.write(JSON.stringify(out, null, 2));
    process.stdout.write("\n");
} finally {
    fs.rmSync(temp.dir, { recursive: true, force: true });
}
