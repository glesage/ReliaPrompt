<script lang="ts">
    import ScoreBadge from "./ScoreBadge.svelte";
    import type { DurationStats } from "$lib/types";

    interface Props {
        llmName: string;
        score: number;
        durationStats?: DurationStats;
        onViewDetails: () => void;
    }

    let { llmName, score, durationStats, onViewDetails }: Props = $props();

    function formatDuration(ms: number): string {
        if (ms < 1000) return `${ms}ms`;
        return `${(ms / 1000).toFixed(2)}s`;
    }
</script>

<div class="llm-result-row">
    <span class="llm-result-name">{llmName}</span>
    <ScoreBadge {score} />
    {#if durationStats}
        <span class="duration-badge" title="Average response time">
            ⏱ {formatDuration(durationStats.avgMs)}
        </span>
    {/if}
    <button
        class="btn-view-details"
        onclick={onViewDetails}
        title="View details"
    >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
        </svg>
    </button>
</div>
