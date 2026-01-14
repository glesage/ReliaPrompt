<script lang="ts">
    interface Props {
        score: number;
        tooltip?: string;
        variant?: "default" | "best";
    }

    let { score, tooltip, variant = "default" }: Props = $props();

    function scoreToPercent(score: number): number {
        if (score > 1) return score;
        return Math.round(score * 100);
    }

    const percent = $derived(scoreToPercent(score));
    const badgeClass = $derived(
        percent >= 90 ? "" : percent >= 80 ? "medium" : "low"
    );
</script>

<span
    class="score-badge {badgeClass}"
    class:best={variant === "best"}
    data-tooltip={tooltip}
>
    {percent}%
</span>
