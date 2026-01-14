<script lang="ts">
    interface Props {
        originalScore: number | null;
        bestScore: number | null;
        showDelta?: boolean;
    }

    let { originalScore, bestScore, showDelta = true }: Props = $props();

    function scoreToPercent(score: number): number {
        if (score > 1) return score;
        return Math.round(score * 100);
    }

    const delta = $derived(() => {
        if (originalScore === null || bestScore === null) return null;
        return scoreToPercent(bestScore) - scoreToPercent(originalScore);
    });
</script>

{#if originalScore !== null || bestScore !== null}
    <div class="score-display">
        {#if originalScore !== null}
            <div class="score-item">
                <div class="label">Original</div>
                <div id="original-score" class="value">{scoreToPercent(originalScore)}%</div>
            </div>
        {/if}
        {#if bestScore !== null}
            <div class="score-item">
                <div class="label">Best</div>
                <div id="best-score" class="value improved">{scoreToPercent(bestScore)}%</div>
            </div>
        {/if}
        {#if showDelta && delta() !== null && delta()! > 0}
            <div class="score-item">
                <div class="label">Improvement</div>
                <div class="value improved">+{delta()}%</div>
            </div>
        {/if}
    </div>
{/if}
