import type { Reporter, TestCase, TestResult } from '@playwright/test/reporter';
export interface TutorialReporterOptions {
    mappingFile?: string;
    tutorialsJson?: string;
}
declare class TutorialMergeReporter implements Reporter {
    private mappingFile;
    private tutorialsJson;
    constructor(options?: TutorialReporterOptions);
    onBegin(): void;
    onTestEnd(test: TestCase, result: TestResult): void;
    /**
     * Find the full-screen black sync marker in the source video and return
     * the timestamp (seconds) of its END — the exact video time of timeline
     * zero. Returns null when no black interval is found.
     */
    private detectSyncMarker;
    private patchTutorialsDuration;
    private findTimelineByTitle;
}
export default TutorialMergeReporter;
//# sourceMappingURL=reporter.d.ts.map