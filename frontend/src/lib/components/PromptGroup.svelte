<script lang="ts">
    import type { PromptGroup as PromptGroupType, Prompt } from "$lib/types";
    import {
        selectedPrompt,
        expandedGroups,
        versionsCache,
        toggleGroup,
        selectPrompt,
        deletePromptVersion,
        deleteAllVersions,
        formatVersionDate,
    } from "$lib/stores/prompts";

    interface Props {
        group: PromptGroupType;
        onViewPrompt: (id: number, name: string, version?: number) => void;
        onEditPrompt: (id: number, name: string) => void;
    }

    let { group, onViewPrompt, onEditPrompt }: Props = $props();

    const isExpanded = $derived($expandedGroups.has(group.promptGroupId));
    const versions = $derived($versionsCache[group.promptGroupId] || []);
    const latestVersion = $derived(versions.length > 0 ? versions[0] : null);

    async function handleHeaderClick(e: MouseEvent) {
        if ((e.target as HTMLElement).closest(".sidebar-action-btn")) return;
        await toggleGroup(group.promptGroupId, group.id);
    }

    async function handleVersionClick(version: Prompt, e: MouseEvent) {
        if ((e.target as HTMLElement).closest(".version-delete")) return;
        await selectPrompt(version.id);
    }

    async function handleDeleteAll() {
        if (
            confirm(
                `Delete ALL versions of "${group.name}"? This will also delete all test cases. This cannot be undone.`
            )
        ) {
            await deleteAllVersions(group.id, group.promptGroupId);
        }
    }

    async function handleDeleteVersion(version: Prompt) {
        if (
            confirm(
                `Delete version ${version.version} of "${version.name}"? Test cases will be preserved. This cannot be undone.`
            )
        ) {
            await deletePromptVersion(version.id, version.promptGroupId);
        }
    }

    function escapeHtml(text: string): string {
        const div = document.createElement("div");
        div.textContent = text;
        return div.innerHTML;
    }
</script>

<div class="sidebar-group" class:expanded={isExpanded} data-group-id={group.promptGroupId}>
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="sidebar-group-header" onclick={handleHeaderClick}>
        <span class="sidebar-expand-icon">
            {#if isExpanded}
                <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                >
                    <polyline points="6 9 12 15 18 9" />
                </svg>
            {:else}
                <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                >
                    <polyline points="9 18 15 12 9 6" />
                </svg>
            {/if}
        </span>
        <div class="sidebar-group-info">
            <div class="sidebar-group-name">{group.name}</div>
            <div class="sidebar-group-meta">{group.version} version{group.version > 1 ? "s" : ""}</div>
        </div>
        <div class="sidebar-group-actions">
            <button
                class="sidebar-action-btn view"
                onclick={() => onViewPrompt(group.id, group.name)}
                title="View prompt"
            >
                <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                >
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                </svg>
            </button>
            <button
                class="sidebar-action-btn delete"
                onclick={handleDeleteAll}
                title="Delete all versions"
            >
                <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                >
                    <polyline points="3 6 5 6 21 6" />
                    <path
                        d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
                    />
                </svg>
            </button>
        </div>
    </div>

    <div class="sidebar-versions">
        {#if isExpanded}
            {#if versions.length === 0}
                <div class="sidebar-versions-loading">Loading...</div>
            {:else}
                {#each versions as version (version.id)}
                    <!-- svelte-ignore a11y_click_events_have_key_events -->
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <div
                        class="sidebar-version-item"
                        class:active={$selectedPrompt?.id === version.id}
                        onclick={(e) => handleVersionClick(version, e)}
                    >
                        <div class="sidebar-version-info">
                            <span class="badge badge-version">v{version.version}</span>
                            <span class="sidebar-version-date"
                                >{formatVersionDate(version.createdAt)}</span
                            >
                        </div>
                        <div class="sidebar-version-actions">
                            <button
                                class="sidebar-action-btn view version-view"
                                onclick={() => onViewPrompt(version.id, version.name, version.version)}
                                title="View prompt"
                            >
                                <svg
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    stroke-width="2"
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                >
                                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                    <circle cx="12" cy="12" r="3" />
                                </svg>
                            </button>
                            <button
                                class="sidebar-action-btn delete version-delete"
                                onclick={() => handleDeleteVersion(version)}
                                title="Delete this version"
                            >
                                <svg
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    stroke-width="2"
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                >
                                    <polyline points="3 6 5 6 21 6" />
                                    <path
                                        d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
                                    />
                                </svg>
                            </button>
                        </div>
                    </div>
                {/each}

                {#if latestVersion}
                    <button
                        class="sidebar-new-version-btn"
                        onclick={() => onEditPrompt(latestVersion.id, latestVersion.name)}
                    >
                        <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                        >
                            <line x1="12" y1="5" x2="12" y2="19" />
                            <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                        <span>Create New Version</span>
                    </button>
                {/if}
            {/if}
        {/if}
    </div>
</div>
