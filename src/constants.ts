// Default improvement prompt template with placeholders
export const DEFAULT_IMPROVEMENT_PROMPT_TEMPLATE = `You are an expert prompt engineer. Your task is to improve the following prompt by removing unnecessary fields/values and making it more concise and clear to make it return better results.

## Current Prompt:
{{CURRENT_PROMPT}}

## Test Results Summary:
{{TEST_SUMMARY}}

## Failure Analysis:
{{FAILURE_ANALYSIS}}

{{FAILED_TEST_CASES}}

## Your Task:
Analyze why the prompt is failing for these test cases and provide an improved version of the prompt.

{{ANALYSIS_HINTS}}

The improved prompt should:
1. Be clearer and more specific about the expected output format
2. Handle edge cases better
3. Produce valid JSON that exactly matches the expected structure
4. Not include extra fields or values beyond what is expected

IMPORTANT: Return ONLY the improved prompt text, nothing else. Do not include any explanations, markdown formatting, or code blocks. Just the raw prompt text.`;
