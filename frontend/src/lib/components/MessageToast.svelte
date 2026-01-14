<script lang="ts">
    import { messages } from "$lib/stores/messages";
</script>

{#if $messages.length > 0}
    <div id="app-message">
        {#each $messages as msg (msg.id)}
            <div class="message {msg.type}">
                {msg.text}
            </div>
        {/each}
    </div>
{/if}
