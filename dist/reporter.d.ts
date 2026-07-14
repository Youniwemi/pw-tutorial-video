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
    private patchTutorialsDuration;
    private findTimelineByTitle;
}
export default TutorialMergeReporter;
//# sourceMappingURL=reporter.d.ts.map