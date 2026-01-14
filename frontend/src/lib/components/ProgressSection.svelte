<script lang="ts">
    interface Props {
        progress: number;
        label?: string;
        details?: string;
        id?: string;
    }

    let { progress, label = "Overall Progress", details = "", id }: Props = $props();
</script>

<div {id} class="progress-section">
    <div class="progress-label">{label}</div>
    <div class="progress-bar-container">
        <div class="progress-bar" style="width: {Math.round(progress)}%">
            {Math.round(progress)}%
        </div>
    </div>
    {#if details}
        <div class="muted" style="font-size: 14px">{details}</div>
    {/if}
</div>
