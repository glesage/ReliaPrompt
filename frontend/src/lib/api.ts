import type {
    Prompt,
    PromptGroup,
    Model,
    SelectedModel,
    LLMConfig,
    TestCase,
    TestJob,
    TestResults,
    ImprovementJob,
    ImprovementTemplate,
} from "./types";

const BASE_URL = "";

async function fetchJSON<T>(url: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${BASE_URL}${url}`, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            ...options?.headers,
        },
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || `Request failed: ${response.status}`);
    }

    return response.json();
}

// Prompts API
export async function getPrompts(): Promise<PromptGroup[]> {
    return fetchJSON<PromptGroup[]>("/api/prompts");
}

export async function getPrompt(id: number): Promise<Prompt> {
    return fetchJSON<Prompt>(`/api/prompts/${id}`);
}

export async function getPromptVersions(id: number): Promise<Prompt[]> {
    return fetchJSON<Prompt[]>(`/api/prompts/${id}/versions`);
}

export async function createPrompt(data: {
    name: string;
    content: string;
    expectedSchema?: string;
    parentVersionId?: number;
}): Promise<Prompt> {
    return fetchJSON<Prompt>("/api/prompts", {
        method: "POST",
        body: JSON.stringify(data),
    });
}

export async function deletePrompt(id: number): Promise<void> {
    await fetchJSON<void>(`/api/prompts/${id}`, { method: "DELETE" });
}

export async function deleteAllPromptVersions(id: number): Promise<void> {
    await fetchJSON<void>(`/api/prompts/${id}/all-versions`, { method: "DELETE" });
}

export async function exportPrompts(): Promise<Prompt[]> {
    return fetchJSON<Prompt[]>("/api/prompts/export");
}

export async function importPrompts(
    prompts: Array<{ name: string; content: string; expected_schema?: string }>
): Promise<{ created: number; skipped: number }> {
    return fetchJSON<{ created: number; skipped: number }>("/api/prompts/import", {
        method: "POST",
        body: JSON.stringify(prompts),
    });
}

// Models API
export async function getModels(): Promise<Model[]> {
    return fetchJSON<Model[]>("/api/models");
}

// Config API
export async function getConfig(): Promise<LLMConfig> {
    return fetchJSON<LLMConfig>("/api/config");
}

export async function saveConfig(config: Partial<LLMConfig>): Promise<void> {
    await fetchJSON<void>("/api/config", {
        method: "POST",
        body: JSON.stringify(config),
    });
}

export async function saveSelectedModels(models: SelectedModel[]): Promise<void> {
    await saveConfig({ selected_models: JSON.stringify(models) });
}

export async function getImprovementTemplate(): Promise<ImprovementTemplate> {
    return fetchJSON<ImprovementTemplate>("/api/config/improvement-prompt");
}

export async function saveImprovementTemplate(template: string): Promise<void> {
    await fetchJSON<void>("/api/config/improvement-prompt", {
        method: "PUT",
        body: JSON.stringify({ template }),
    });
}

// Test Cases API
export async function getTestCases(promptId: number): Promise<TestCase[]> {
    return fetchJSON<TestCase[]>(`/api/prompts/${promptId}/test-cases`);
}

export async function createTestCase(
    promptId: number,
    data: {
        input: string;
        expected_output: string;
        expected_output_type: string;
    }
): Promise<TestCase> {
    return fetchJSON<TestCase>(`/api/prompts/${promptId}/test-cases`, {
        method: "POST",
        body: JSON.stringify(data),
    });
}

export async function updateTestCase(
    id: number,
    data: {
        input: string;
        expected_output: string;
        expected_output_type: string;
    }
): Promise<TestCase> {
    return fetchJSON<TestCase>(`/api/test-cases/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
    });
}

export async function deleteTestCase(id: number): Promise<void> {
    await fetchJSON<void>(`/api/test-cases/${id}`, { method: "DELETE" });
}

export async function exportTestCases(promptId: number): Promise<TestCase[]> {
    return fetchJSON<TestCase[]>(`/api/prompts/${promptId}/test-cases/export`);
}

export async function importTestCases(
    promptId: number,
    testCases: Array<{
        input: string;
        expected_output: string;
        expected_output_type: string;
    }>
): Promise<{ count: number }> {
    return fetchJSON<{ count: number }>(`/api/prompts/${promptId}/test-cases/import`, {
        method: "POST",
        body: JSON.stringify(testCases),
    });
}

// Test Runs API
export async function getTestJobs(promptId: number): Promise<TestJob[]> {
    return fetchJSON<TestJob[]>(`/api/prompts/${promptId}/test-jobs`);
}

export async function startTestRun(data: {
    promptId: number;
    runsPerTest: number;
    selectedModels: SelectedModel[];
}): Promise<{ jobId: string }> {
    return fetchJSON<{ jobId: string }>("/api/test/run", {
        method: "POST",
        body: JSON.stringify(data),
    });
}

export async function getTestStatus(jobId: string): Promise<TestJob & { results?: TestResults }> {
    return fetchJSON<TestJob & { results?: TestResults }>(`/api/test/status/${jobId}`);
}

// Improvement API
export async function getImprovementJobs(promptId: number): Promise<ImprovementJob[]> {
    return fetchJSON<ImprovementJob[]>(`/api/prompts/${promptId}/improvement-jobs`);
}

export async function startImprovement(data: {
    promptId: number;
    maxIterations: number;
    runsPerLlm: number;
    improvementModel: SelectedModel;
    benchmarkModels: SelectedModel[];
}): Promise<{ jobId: string }> {
    return fetchJSON<{ jobId: string }>("/api/improve/start", {
        method: "POST",
        body: JSON.stringify(data),
    });
}

export async function getImprovementStatus(jobId: string): Promise<ImprovementJob> {
    return fetchJSON<ImprovementJob>(`/api/improve/status/${jobId}`);
}
