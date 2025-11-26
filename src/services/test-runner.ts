import { v4 as uuidv4 } from 'uuid';
import {
  createTestJob,
  updateTestJob,
  createTestResult,
  getTestCasesForPrompt,
  getPromptById,
  TestCase,
  Prompt,
  getTestJobById,
  getTestResultsForJob
} from '../database';
import { getConfiguredClients, LLMClient } from '../llm-clients';
import { compareJSON } from '../utils/json-comparison';

const RUNS_PER_TEST = 10;

export interface TestProgress {
  jobId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  totalTests: number;
  completedTests: number;
  progress: number; // 0-100
  results?: TestResults;
  error?: string;
}

export interface TestResults {
  promptId: number;
  promptContent: string;
  totalTestCases: number;
  llmResults: LLMTestResult[];
  overallScore: number;
}

export interface LLMTestResult {
  llmName: string;
  correctCount: number;
  totalRuns: number;
  score: number; // 0-100
  testCaseResults: TestCaseResult[];
}

export interface TestCaseResult {
  testCaseId: number;
  input: string;
  expectedOutput: string;
  runs: RunResult[];
  correctRuns: number;
}

export interface RunResult {
  runNumber: number;
  actualOutput: string | null;
  isCorrect: boolean;
  error?: string;
}

// Store for active test jobs (in-memory progress tracking)
const activeJobs = new Map<string, TestProgress>();

export function getTestProgress(jobId: string): TestProgress | null {
  return activeJobs.get(jobId) ?? null;
}

/**
 * Start a test run for a prompt
 * Returns jobId immediately, runs tests in background
 */
export async function startTestRun(promptId: number): Promise<string> {
  const prompt = getPromptById(promptId);
  if (!prompt) {
    throw new Error(`Prompt ${promptId} not found`);
  }

  const testCases = getTestCasesForPrompt(promptId);
  if (testCases.length === 0) {
    throw new Error(`No test cases found for prompt ${promptId}`);
  }

  const clients = getConfiguredClients();
  if (clients.length === 0) {
    throw new Error('No LLM providers configured. Please add API keys in the config.');
  }

  const jobId = uuidv4();
  const totalTests = testCases.length * clients.length * RUNS_PER_TEST;

  createTestJob(jobId, promptId, totalTests);

  const progress: TestProgress = {
    jobId,
    status: 'pending',
    totalTests,
    completedTests: 0,
    progress: 0
  };
  activeJobs.set(jobId, progress);

  // Run tests in background
  runTests(jobId, prompt, testCases, clients).catch(error => {
    console.error('Test run failed:', error);
    const progress = activeJobs.get(jobId);
    if (progress) {
      progress.status = 'failed';
      progress.error = error.message;
    }
    updateTestJob(jobId, { status: 'failed' });
  });

  return jobId;
}

/**
 * Run all tests - executes test cases in parallel across LLMs,
 * but runs each test case 10 times sequentially per LLM
 */
async function runTests(
  jobId: string,
  prompt: Prompt,
  testCases: TestCase[],
  clients: LLMClient[]
): Promise<void> {
  const progress = activeJobs.get(jobId)!;
  progress.status = 'running';
  updateTestJob(jobId, { status: 'running' });

  const llmResults: LLMTestResult[] = [];
  let completedTests = 0;

  // Run all LLMs in parallel, test cases in parallel, but runs sequentially
  const llmPromises = clients.map(async (client) => {
    const testCaseResults: TestCaseResult[] = [];
    let llmCorrectCount = 0;
    let llmTotalRuns = 0;

    // Run all test cases in parallel for this LLM
    const testCasePromises = testCases.map(async (testCase) => {
      const runs: RunResult[] = [];
      let correctRuns = 0;

      // Run 10 times sequentially
      for (let runNumber = 1; runNumber <= RUNS_PER_TEST; runNumber++) {
        try {
          const actualOutput = await client.complete(prompt.content, testCase.input);
          const comparison = compareJSON(testCase.expectedOutput, actualOutput);
          
          const isCorrect = comparison.isEqual;
          if (isCorrect) {
            correctRuns++;
            llmCorrectCount++;
          }
          llmTotalRuns++;

          runs.push({
            runNumber,
            actualOutput,
            isCorrect,
            error: comparison.error
          });

          createTestResult(
            jobId,
            testCase.id,
            client.name,
            runNumber,
            actualOutput,
            isCorrect,
            comparison.error
          );
        } catch (error) {
          llmTotalRuns++;
          const errorMessage = (error as Error).message;
          runs.push({
            runNumber,
            actualOutput: null,
            isCorrect: false,
            error: errorMessage
          });

          createTestResult(
            jobId,
            testCase.id,
            client.name,
            runNumber,
            null,
            false,
            errorMessage
          );
        }

        // Update progress
        completedTests++;
        progress.completedTests = completedTests;
        progress.progress = Math.round((completedTests / progress.totalTests) * 100);
        updateTestJob(jobId, { completedTests: completedTests });
      }

      return {
        testCaseId: testCase.id,
        input: testCase.input,
        expectedOutput: testCase.expectedOutput,
        runs,
        correctRuns
      } as TestCaseResult;
    });

    const results = await Promise.all(testCasePromises);
    testCaseResults.push(...results);

    return {
      llmName: client.name,
      correctCount: llmCorrectCount,
      totalRuns: llmTotalRuns,
      score: llmTotalRuns > 0 ? Math.round((llmCorrectCount / llmTotalRuns) * 100) : 0,
      testCaseResults
    } as LLMTestResult;
  });

  const results = await Promise.all(llmPromises);
  llmResults.push(...results);

  // Calculate overall score
  const totalCorrect = llmResults.reduce((sum, r) => sum + r.correctCount, 0);
  const totalRuns = llmResults.reduce((sum, r) => sum + r.totalRuns, 0);
  const overallScore = totalRuns > 0 ? Math.round((totalCorrect / totalRuns) * 100) : 0;

  const testResults: TestResults = {
    promptId: prompt.id,
    promptContent: prompt.content,
    totalTestCases: testCases.length,
    llmResults,
    overallScore
  };

  progress.status = 'completed';
  progress.results = testResults;
  updateTestJob(jobId, {
    status: 'completed',
    results: JSON.stringify(testResults)
  });
}

/**
 * Run tests for a specific prompt content (used by improvement service)
 * Returns the overall score (0-100)
 */
export async function runTestsForPromptContent(
  promptContent: string,
  testCases: TestCase[],
  clients: LLMClient[]
): Promise<{ score: number; results: LLMTestResult[] }> {
  const llmResults: LLMTestResult[] = [];

  const llmPromises = clients.map(async (client) => {
    const testCaseResults: TestCaseResult[] = [];
    let llmCorrectCount = 0;
    let llmTotalRuns = 0;

    const testCasePromises = testCases.map(async (testCase) => {
      const runs: RunResult[] = [];
      let correctRuns = 0;

      // Run 10 times sequentially
      for (let runNumber = 1; runNumber <= RUNS_PER_TEST; runNumber++) {
        try {
          const actualOutput = await client.complete(promptContent, testCase.input);
          const comparison = compareJSON(testCase.expectedOutput, actualOutput);
          
          const isCorrect = comparison.isEqual;
          if (isCorrect) {
            correctRuns++;
            llmCorrectCount++;
          }
          llmTotalRuns++;

          runs.push({
            runNumber,
            actualOutput,
            isCorrect,
            error: comparison.error
          });
        } catch (error) {
          llmTotalRuns++;
          runs.push({
            runNumber,
            actualOutput: null,
            isCorrect: false,
            error: (error as Error).message
          });
        }
      }

      return {
        testCaseId: testCase.id,
        input: testCase.input,
        expectedOutput: testCase.expectedOutput,
        runs,
        correctRuns
      } as TestCaseResult;
    });

    const results = await Promise.all(testCasePromises);
    testCaseResults.push(...results);

    return {
      llmName: client.name,
      correctCount: llmCorrectCount,
      totalRuns: llmTotalRuns,
      score: llmTotalRuns > 0 ? Math.round((llmCorrectCount / llmTotalRuns) * 100) : 0,
      testCaseResults
    } as LLMTestResult;
  });

  const results = await Promise.all(llmPromises);
  llmResults.push(...results);

  const totalCorrect = llmResults.reduce((sum, r) => sum + r.correctCount, 0);
  const totalRuns = llmResults.reduce((sum, r) => sum + r.totalRuns, 0);
  const score = totalRuns > 0 ? Math.round((totalCorrect / totalRuns) * 100) : 0;

  return { score, results: llmResults };
}

/**
 * Get test results summary suitable for improvement prompts
 */
export function getTestResultSummary(results: LLMTestResult[]) {
  const summary: Array<{
    input: string;
    expectedOutput: string;
    actualOutput: string | null;
    isCorrect: boolean;
    error?: string;
  }> = [];

  // Aggregate results across all LLMs
  const testCaseMap = new Map<number, {
    input: string;
    expectedOutput: string;
    outputs: Array<{ output: string | null; isCorrect: boolean; error?: string }>;
  }>();

  for (const llmResult of results) {
    for (const tcResult of llmResult.testCaseResults) {
      if (!testCaseMap.has(tcResult.testCaseId)) {
        testCaseMap.set(tcResult.testCaseId, {
          input: tcResult.input,
          expectedOutput: tcResult.expectedOutput,
          outputs: []
        });
      }
      
      const tc = testCaseMap.get(tcResult.testCaseId)!;
      for (const run of tcResult.runs) {
        tc.outputs.push({
          output: run.actualOutput,
          isCorrect: run.isCorrect,
          error: run.error
        });
      }
    }
  }

  // Create summary - use most common wrong output for each test case
  for (const [, tc] of testCaseMap) {
    const wrongOutputs = tc.outputs.filter(o => !o.isCorrect);
    const anyCorrect = tc.outputs.some(o => o.isCorrect);
    
    if (wrongOutputs.length > 0) {
      // Use first wrong output as representative
      const representative = wrongOutputs[0];
      summary.push({
        input: tc.input,
        expectedOutput: tc.expectedOutput,
        actualOutput: representative.output,
        isCorrect: false,
        error: representative.error
      });
    } else if (anyCorrect) {
      const correct = tc.outputs.find(o => o.isCorrect)!;
      summary.push({
        input: tc.input,
        expectedOutput: tc.expectedOutput,
        actualOutput: correct.output,
        isCorrect: true
      });
    }
  }

  return summary;
}

