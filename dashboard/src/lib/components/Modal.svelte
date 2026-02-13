<script lang="ts">
    import { onMount } from "svelte";

    interface Props {
        open: boolean;
        title: string;
        wide?: boolean;
        id?: string;
        onclose: () => void;
        children: import("svelte").Snippet;
        footer?: import("svelte").Snippet;
        titleBadge?: import("svelte").Snippet;
    }

    let { open, title, wide = false, id, onclose, children, footer, titleBadge }: Props = $props();

    function handleKeydown(e: KeyboardEvent) {
        if (e.key === "Escape" && open) {
            onclose();
        }
    }

    let mouseDownTarget: EventTarget | null = null;

    function handleOverlayMouseDown(e: MouseEvent) {
        mouseDownTarget = e.target;
    }

    function handleOverlayMouseUp(e: MouseEvent) {
        // Only close if both mousedown and mouseup happened directly on the overlay
        if (e.target === e.currentTarget && mouseDownTarget === e.currentTarget) {
            onclose();
        }
        mouseDownTarget = null;
    }

    onMount(() => {
        document.addEventListener("keydown", handleKeydown);
        return () => document.removeEventListener("keydown", handleKeydown);
    });
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
    {id}
    class="modal-overlay"
    class:active={open}
    onmousedown={handleOverlayMouseDown}
    onmouseup={handleOverlayMouseUp}
>
    <div class="modal" class:modal-wide={wide}>
        <div class="modal-header">
            <div class="modal-title-group">
                <h2>{title}</h2>
                {#if titleBadge}
                    {@render titleBadge()}
                {/if}
            </div>
            <button
                class="modal-close"
                onclick={onclose}
                aria-label="Close"
                data-testid="modal-close"
            >
                <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                >
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
            </button>
        </div>
        <div class="modal-body">
            {@render children()}
        </div>
        {#if footer}
            <div class="modal-footer">
                {@render footer()}
            </div>
        {/if}
    </div>
</div>
