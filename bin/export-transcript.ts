#!/usr/bin/env node
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, basename } from 'path';
import type { TimelineData } from '../src/timeline';

const OUTPUT_DIR = process.env.TUTORIAL_OUTPUT_DIR || join(process.cwd(), 'tutorials/output');
const TRANSCRIPT_DIR = process.env.TUTORIAL_TRANSCRIPT_DIR || join(process.cwd(), 'tutorials/transcripts');

function findTimelineFiles(): string[] {
	const envPath = process.env.TUTORIAL_TRANSCRIPT;
	if (envPath) return [envPath];

	if (!existsSync(OUTPUT_DIR)) {
		console.error(`Output directory not found: ${OUTPUT_DIR}`);
		process.exit(1);
	}

	return readdirSync(OUTPUT_DIR)
		.filter(f => f.endsWith('_timeline.json'))
		.map(f => join(OUTPUT_DIR, f));
}

function exportTranscript(timelinePath: string): string {
	const raw = readFileSync(timelinePath, 'utf-8');
	const data: TimelineData = JSON.parse(raw);

	const lines: string[] = [];
	lines.push(`# ${data.testName}`);
	lines.push('');
	lines.push(`- **Test:** \`${data.testTitle}\``);
	lines.push(`- **Language:** ${data.lang}`);
	lines.push(`- **Duration:** ${(data.totalDurationMs / 1000).toFixed(1)}s`);
	lines.push('');
	lines.push('---');
	lines.push('');

	let stepNum = 0;
	for (const step of data.steps) {
		if (!step.text) continue;

		if (step.step === 0 && step.title === 'Context') {
			lines.push(`**[Context]** ${step.text}`);
			lines.push('');
		} else if (step.title === 'Complete') {
			lines.push(`**[Complete]** ${step.text}`);
			lines.push('');
		} else {
			stepNum++;
			lines.push(`### Step ${stepNum}: ${step.title}`);
			lines.push('');
			lines.push(step.text);
			lines.push('');
		}
	}

	return lines.join('\n');
}

function run(): void {
	const files = findTimelineFiles();

	if (files.length === 0) {
		console.log('No timeline JSON files found.');
		process.exit(0);
	}

	mkdirSync(TRANSCRIPT_DIR, { recursive: true });

	const written: string[] = [];

	for (const filePath of files) {
		const fileName = basename(filePath, '_timeline.json');
		const outPath = join(TRANSCRIPT_DIR, `${fileName}.md`);

		try {
			const markdown = exportTranscript(filePath);
			writeFileSync(outPath, markdown, 'utf-8');
			written.push(outPath);
		} catch (err: any) {
			console.error(`Failed to process ${filePath}: ${err.message}`);
		}
	}

	console.log(`\nTranscripts written (${written.length}):`);
	for (const p of written) {
		console.log(`  ${p}`);
	}
}

run();
