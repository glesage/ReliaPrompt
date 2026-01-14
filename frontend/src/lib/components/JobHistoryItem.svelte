<script lang="ts">
    import ScoreBadge from "./ScoreBadge.svelte";

    interface Props {
        date: string;
        subtitle: string;
        status: "pending" | "running" | "completed" | "failed";
        score?: number;
        bestScore?: number;
        onclick: () => void;
    }

    let { date, subtitle, status, score, bestScore, onclick }: Props = $props();

    function formatDate(dateStr: string): string {
        const d = new Date(dateStr);
        return d.toLocaleDateString() + " " + d.toLocaleTimeString();
    }

    function formatStatus(s: string): string {
        return s.charAt(0).toUpperCase() + s.slice(1);
    }
</script>

<div
    class="previous-run-item"
    onclick={onclick}
    onkeydown={(e) => e.key === "Enter" && onclick()}
    role="button"
    tabindex="0"
>
    <div class="previous-run-info">
        <span class="previous-run-date">{formatDate(date)}</span>
        <span class="previous-run-tests">{subtitle}</span>
    </div>
    <div class="previous-run-status">
        {#if status === "completed" && score !== undefined}
            <ScoreBadge {score} tooltip="Overall" />
        {/if}
        {#if status === "completed" && bestScore !== undefined}
            <ScoreBadge score={bestScore} tooltip="Best LLM" variant="best" />
        {/if}
        <span
            class="status-indicator"
            class:success={status === "completed"}
            class:failure={status === "failed"}
            class:pending={status === "pending" || status === "running"}
        >
            {formatStatus(status)}
        </span>
    </div>
</div>
