<script lang="ts">
    import { messages } from "$lib/stores/messages";
</script>

{#if $messages.length > 0}
    <div class="toast-stack" role="status" aria-live="polite" aria-atomic="false">
        {#each $messages as msg (msg.id)}
            <div class="toast {msg.type}">
                <span>{msg.text}</span>
                <button
                    type="button"
                    class="toast-close"
                    aria-label="Dismiss notification"
                    onclick={() => messages.dismiss(msg.id)}
                >
                    x
                </button>
            </div>
        {/each}
    </div>
{/if}

<style>
    .toast-stack {
        position: fixed;
        top: 16px;
        right: 16px;
        z-index: 1200;
        display: flex;
        flex-direction: column;
        gap: 10px;
        width: min(420px, calc(100vw - 32px));
        pointer-events: none;
    }

    .toast {
        pointer-events: auto;
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 10px;
        padding: 12px 14px;
        border-radius: 12px;
        border: 1px solid;
        font-size: var(--text-md);
        font-weight: var(--font-medium);
        box-shadow: var(--shadow-md);
        animation: toast-in 0.2s ease-out;
    }

    .toast.success {
        background: #d1fae5;
        color: #065f46;
        border-color: #a7f3d0;
    }

    .toast.error {
        background: #fee2e2;
        color: #991b1b;
        border-color: #fecaca;
    }

    .toast.info {
        background: #dbeafe;
        color: #1e40af;
        border-color: #bfdbfe;
    }

    .toast-close {
        pointer-events: auto;
        flex-shrink: 0;
        border: none;
        background: transparent;
        color: inherit;
        font-size: var(--text-sm);
        font-weight: var(--font-bold);
        line-height: 1;
        cursor: pointer;
        padding: 2px 4px;
        opacity: 0.75;
    }

    .toast-close:hover {
        opacity: 1;
    }

    @keyframes toast-in {
        from {
            opacity: 0;
            transform: translateY(-6px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
</style>
