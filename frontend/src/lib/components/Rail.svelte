<script lang="ts">
    import { page } from "$app/stores";
    import { openConfigModal } from "$lib/stores/config";

    const navItems = [
        { href: "/test-cases", label: "Test Cases" },
        { href: "/test-runs", label: "Test Runs" },
        { href: "/improve", label: "Auto-Improve" },
    ];

    function isActive(href: string): boolean {
        return $page.url.pathname === href || $page.url.pathname.startsWith(href + "/");
    }
</script>

<aside class="app-rail" aria-label="Primary">
    <a class="app-rail-brand" href="/test-cases" aria-label="Relia Prompt Home">
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
        >
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
        </svg>
    </a>
    <nav class="app-rail-nav" aria-label="Sections">
        {#each navItems as item}
            <a
                class="rail-link"
                class:active={isActive(item.href)}
                href={item.href}
                aria-current={isActive(item.href) ? "page" : undefined}
            >
                <span class="rail-link-label">{item.label}</span>
            </a>
        {/each}
    </nav>
    <div class="app-rail-footer">
        <button id="setup-btn" class="rail-btn" onclick={openConfigModal} title="LLMs">LLMs</button>
    </div>
</aside>
