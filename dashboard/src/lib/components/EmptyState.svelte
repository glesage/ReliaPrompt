<script lang="ts">
    interface Props {
        icon: string;
        title: string;
        description: string;
        compact?: boolean;
    }

    let { icon, title, description, compact = false }: Props = $props();
</script>

<div class="empty-state" class:empty-state-compact={compact}>
    <div class="empty-state-icon" aria-hidden="true">{icon}</div>
    <h3>{title}</h3>
    <p>{description}</p>
</div>
