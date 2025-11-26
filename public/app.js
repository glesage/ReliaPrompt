const ICONS = {
    logo: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 2L2 7l10 5 10-5-10-5z"/>
        <path d="M2 17l10 5 10-5"/>
        <path d="M2 12l10 5 10-5"/>
    </svg>`,
    gear: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>`,
    plus: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="12" y1="5" x2="12" y2="19"/>
        <line x1="5" y1="12" x2="19" y2="12"/>
    </svg>`,
    close: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"/>
        <line x1="6" y1="6" x2="18" y2="18"/>
    </svg>`,
    prompt: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/>
        <line x1="16" y1="17" x2="8" y2="17"/>
        <polyline points="10 9 9 9 8 9"/>
    </svg>`,
};

const CURRENT_PAGE = window.location.pathname.split("/").pop() || "index.html";

const NAV_ITEMS = [
    { href: "/test-cases.html", label: "Test Cases", page: "test-cases.html" },
    { href: "/run-tests.html", label: "Run Tests", page: "run-tests.html" },
    { href: "/improve.html", label: "Auto-Improve", page: "improve.html" },
];

function getSelectedPromptId() {
    const urlParams = new URLSearchParams(window.location.search);
    const urlPromptId = urlParams.get("promptId");
    if (urlPromptId) {
        sessionStorage.setItem("selectedPromptId", urlPromptId);
        return parseInt(urlPromptId, 10);
    }
    const stored = sessionStorage.getItem("selectedPromptId");
    return stored ? parseInt(stored, 10) : null;
}

function setSelectedPromptId(id) {
    if (id) {
        sessionStorage.setItem("selectedPromptId", id.toString());
    } else {
        sessionStorage.removeItem("selectedPromptId");
    }
    const url = new URL(window.location);
    if (id) {
        url.searchParams.set("promptId", id);
    } else {
        url.searchParams.delete("promptId");
    }
    window.history.replaceState({}, "", url);
}

async function loadPromptSidebar() {
    const sidebarList = document.getElementById("sidebar-prompts");
    if (!sidebarList) return;

    try {
        const res = await fetch("/api/prompts");
        const prompts = await res.json();
        const selectedId = getSelectedPromptId();

        if (prompts.length === 0) {
            sidebarList.innerHTML = `
                <div class="sidebar-empty">
                    No prompts yet.<br>Create your first one!
                </div>
            `;
            return;
        }

        sidebarList.innerHTML = prompts
            .map(
                (p) => `
            <div class="sidebar-item ${p.id === selectedId ? "active" : ""}" data-id="${p.id}" data-name="${escapeHtml(p.name)}">
                <div class="sidebar-item-content">
                    <div class="sidebar-item-name">
                        ${escapeHtml(p.name)}
                        <span class="badge badge-version">v${p.version}</span>
                    </div>
                    <div class="sidebar-item-meta">${new Date(p.created_at).toLocaleDateString()}</div>
                </div>
                <div class="sidebar-item-actions">
                    <button class="sidebar-action-btn edit" data-id="${p.id}" data-name="${escapeHtml(p.name)}" title="Edit">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                    </button>
                    <button class="sidebar-action-btn delete" data-id="${p.id}" data-name="${escapeHtml(p.name)}" title="Delete">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                        </svg>
                    </button>
                </div>
            </div>
        `
            )
            .join("");

        // Add click handlers for selecting prompts
        sidebarList.querySelectorAll(".sidebar-item-content").forEach((content) => {
            content.addEventListener("click", () => {
                const item = content.closest(".sidebar-item");
                const id = parseInt(item.dataset.id, 10);
                selectPrompt(id, item.dataset.name);
            });
        });

        sidebarList.querySelectorAll(".sidebar-action-btn.edit").forEach((btn) => {
            btn.addEventListener("click", (e) => {
                e.stopPropagation();
                const id = parseInt(btn.dataset.id, 10);
                const name = btn.dataset.name;
                openEditPromptModal(id, name);
            });
        });

        sidebarList.querySelectorAll(".sidebar-action-btn.delete").forEach((btn) => {
            btn.addEventListener("click", (e) => {
                e.stopPropagation();
                const id = parseInt(btn.dataset.id, 10);
                const name = btn.dataset.name;
                deletePromptFromSidebar(id, name);
            });
        });

        window.dispatchEvent(new CustomEvent("promptsLoaded", { detail: { prompts, selectedId } }));
    } catch (error) {
        console.error("Error loading prompts:", error);
        sidebarList.innerHTML = '<div class="sidebar-empty">Error loading prompts</div>';
    }
}

function selectPrompt(id, name) {
    setSelectedPromptId(id);

    document.querySelectorAll(".sidebar-item").forEach((item) => {
        item.classList.toggle("active", parseInt(item.dataset.id, 10) === id);
    });

    window.dispatchEvent(new CustomEvent("promptSelected", { detail: { id, name } }));
}

function openNewPromptModal() {
    const overlay = document.getElementById("new-prompt-modal");
    if (overlay) {
        overlay.classList.add("active");
        document.getElementById("new-prompt-name")?.focus();
    }
}

function closeNewPromptModal() {
    const overlay = document.getElementById("new-prompt-modal");
    if (overlay) {
        overlay.classList.remove("active");
        document.getElementById("new-prompt-form")?.reset();
    }
}

async function createNewPrompt(e) {
    e.preventDefault();
    const name = document.getElementById("new-prompt-name").value.trim();
    const content = document.getElementById("new-prompt-content").value.trim();

    if (!name || !content) {
        showAppMessage("Please fill in all fields", "error");
        return;
    }

    try {
        const res = await fetch("/api/prompts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, content }),
        });

        if (res.ok) {
            const prompt = await res.json();
            closeNewPromptModal();
            await loadPromptSidebar();
            selectPrompt(prompt.id, prompt.name);
            showAppMessage("Prompt created successfully!", "success");
        } else {
            const error = await res.json();
            showAppMessage(error.error || "Failed to create prompt", "error");
        }
    } catch (error) {
        showAppMessage("Error creating prompt", "error");
    }
}

let editingPromptId = null;
let editingPromptName = null;

async function openEditPromptModal(id, name) {
    editingPromptId = id;
    editingPromptName = name;

    const overlay = document.getElementById("edit-prompt-modal");
    if (!overlay) return;

    try {
        const res = await fetch(`/api/prompts/${id}`);
        const prompt = await res.json();

        document.getElementById("edit-prompt-name-display").textContent = name;
        document.getElementById("edit-prompt-version").textContent = `v${prompt.version}`;
        document.getElementById("edit-prompt-content").value = prompt.content;

        overlay.classList.add("active");
        document.getElementById("edit-prompt-content")?.focus();
    } catch (error) {
        showAppMessage("Error loading prompt", "error");
    }
}

function closeEditPromptModal() {
    const overlay = document.getElementById("edit-prompt-modal");
    if (overlay) {
        overlay.classList.remove("active");
        editingPromptId = null;
        editingPromptName = null;
    }
}

async function saveEditedPrompt(e) {
    e.preventDefault();
    if (!editingPromptName) return;

    const content = document.getElementById("edit-prompt-content").value.trim();
    if (!content) {
        showAppMessage("Please enter prompt content", "error");
        return;
    }

    try {
        const res = await fetch("/api/prompts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: editingPromptName, content }),
        });

        if (res.ok) {
            const prompt = await res.json();
            closeEditPromptModal();
            await loadPromptSidebar();
            selectPrompt(prompt.id, prompt.name);
            showAppMessage("New version saved!", "success");
        } else {
            const error = await res.json();
            showAppMessage(error.error || "Failed to save prompt", "error");
        }
    } catch (error) {
        showAppMessage("Error saving prompt", "error");
    }
}

async function deletePromptFromSidebar(id, name) {
    if (
        !confirm(
            `Delete ALL versions of "${name}"? This will also delete all test cases. This cannot be undone.`
        )
    ) {
        return;
    }

    try {
        const res = await fetch(`/api/prompts/name/${encodeURIComponent(name)}`, {
            method: "DELETE",
        });

        if (res.ok) {
            showAppMessage("Prompt deleted", "success");

            const selectedId = getSelectedPromptId();
            if (selectedId === id) {
                setSelectedPromptId(null);
                window.dispatchEvent(
                    new CustomEvent("promptSelected", { detail: { id: null, name: null } })
                );
            }

            await loadPromptSidebar();
        } else {
            const error = await res.json();
            showAppMessage(error.error || "Failed to delete prompt", "error");
        }
    } catch (error) {
        showAppMessage("Error deleting prompt", "error");
    }
}

function openConfigModal() {
    const overlay = document.getElementById("config-modal");
    if (overlay) {
        overlay.classList.add("active");
        loadConfigStatus();
    }
}

function closeConfigModal() {
    const overlay = document.getElementById("config-modal");
    if (overlay) {
        overlay.classList.remove("active");
    }
}

async function loadConfigStatus() {
    try {
        const res = await fetch("/api/config");
        const config = await res.json();

        updateConfigBadge("openai-status", !!config.openai_api_key);
        updateConfigBadge(
            "bedrock-status",
            !!(config.bedrock_access_key_id && config.bedrock_secret_access_key)
        );
        updateConfigBadge("deepseek-status", !!config.deepseek_api_key);

        if (config.bedrock_region) {
            const regionInput = document.getElementById("bedrock_region");
            if (regionInput) regionInput.value = config.bedrock_region;
        }
    } catch (error) {
        console.error("Error loading config:", error);
    }
}

function updateConfigBadge(elementId, isConfigured) {
    const badge = document.getElementById(elementId);
    if (badge) {
        badge.className = `status-badge ${isConfigured ? "configured" : "not-configured"}`;
        badge.textContent = isConfigured ? "Configured" : "Not configured";
    }
}

async function saveConfig(e) {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);
    const data = {};

    for (const [key, value] of formData.entries()) {
        if (value.trim()) {
            data[key] = value.trim();
        }
    }

    try {
        const res = await fetch("/api/config", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
        });

        if (res.ok) {
            showAppMessage("Configuration saved successfully!", "success");
            loadConfigStatus();
            form.querySelectorAll('input[type="password"]').forEach((el) => (el.value = ""));
        } else {
            const error = await res.json();
            showAppMessage(error.error || "Failed to save configuration", "error");
        }
    } catch (error) {
        showAppMessage("Error saving configuration", "error");
    }
}

function showAppMessage(text, type) {
    const container = document.getElementById("app-message");
    if (!container) return;

    container.innerHTML = `<div class="message ${type}">${escapeHtml(text)}</div>`;

    if (type !== "info") {
        setTimeout(() => {
            container.innerHTML = "";
        }, 5000);
    }
}

function escapeHtml(text) {
    if (!text) return "";
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

function initAppLayout() {
    const gearBtn = document.getElementById("gear-btn");
    if (gearBtn) {
        gearBtn.addEventListener("click", openConfigModal);
    }

    const configModalOverlay = document.getElementById("config-modal");
    if (configModalOverlay) {
        configModalOverlay.addEventListener("click", (e) => {
            if (e.target === configModalOverlay) closeConfigModal();
        });
    }

    const configCloseBtn = document.getElementById("config-close-btn");
    if (configCloseBtn) {
        configCloseBtn.addEventListener("click", closeConfigModal);
    }

    const configForm = document.getElementById("config-form");
    if (configForm) {
        configForm.addEventListener("submit", saveConfig);
    }

    const newPromptBtn = document.getElementById("new-prompt-btn");
    if (newPromptBtn) {
        newPromptBtn.addEventListener("click", openNewPromptModal);
    }

    const newPromptModalOverlay = document.getElementById("new-prompt-modal");
    if (newPromptModalOverlay) {
        newPromptModalOverlay.addEventListener("click", (e) => {
            if (e.target === newPromptModalOverlay) closeNewPromptModal();
        });
    }

    const newPromptCloseBtn = document.getElementById("new-prompt-close-btn");
    if (newPromptCloseBtn) {
        newPromptCloseBtn.addEventListener("click", closeNewPromptModal);
    }

    const newPromptForm = document.getElementById("new-prompt-form");
    if (newPromptForm) {
        newPromptForm.addEventListener("submit", createNewPrompt);
    }

    const editPromptModalOverlay = document.getElementById("edit-prompt-modal");
    if (editPromptModalOverlay) {
        editPromptModalOverlay.addEventListener("click", (e) => {
            if (e.target === editPromptModalOverlay) closeEditPromptModal();
        });
    }

    const editPromptCloseBtn = document.getElementById("edit-prompt-close-btn");
    if (editPromptCloseBtn) {
        editPromptCloseBtn.addEventListener("click", closeEditPromptModal);
    }

    const editPromptForm = document.getElementById("edit-prompt-form");
    if (editPromptForm) {
        editPromptForm.addEventListener("submit", saveEditedPrompt);
    }

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            closeConfigModal();
            closeNewPromptModal();
            closeEditPromptModal();
        }
    });

    loadPromptSidebar();
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAppLayout);
} else {
    initAppLayout();
}

if (window.location.search.includes("openConfig=true")) {
    const url = new URL(window.location);
    url.searchParams.delete("openConfig");
    window.history.replaceState({}, "", url);
    setTimeout(() => {
        openConfigModal();
    }, 100);
}

function getNavbarHtml() {
    const navLinks = NAV_ITEMS.map((item) => {
        const isActive =
            CURRENT_PAGE === item.page || (CURRENT_PAGE === "" && item.page === "index.html");
        return `<a href="${item.href}" class="${isActive ? "active" : ""}">${item.label}</a>`;
    }).join("");

    return `
        <nav class="navbar">
            <a href="/" class="navbar-brand">
                ${ICONS.logo}
                <span>Relia Prompt</span>
            </a>
            <div class="navbar-nav">
                ${navLinks}
            </div>
            <div class="navbar-actions">
                <button class="btn-icon" id="gear-btn" title="Configuration">
                    ${ICONS.gear}
                </button>
            </div>
        </nav>
    `;
}

function getSidebarHtml() {
    return `
        <aside class="sidebar">
            <div class="sidebar-header">
                <h3>Prompts</h3>
                <button class="btn-new-prompt" id="new-prompt-btn">
                    ${ICONS.plus}
                    <span>New Prompt</span>
                </button>
            </div>
            <div class="sidebar-list" id="sidebar-prompts">
                <div class="sidebar-empty">Loading...</div>
            </div>
        </aside>
    `;
}

function getConfigModalHtml() {
    return `
        <div class="modal-overlay" id="config-modal">
            <div class="modal">
                <div class="modal-header">
                    <h2>LLM Configuration</h2>
                    <button class="modal-close" id="config-close-btn">
                        ${ICONS.close}
                    </button>
                </div>
                <form id="config-form">
                    <div class="modal-body">
                        <div class="provider-section">
                            <h3>
                                OpenAI
                                <span id="openai-status" class="status-badge not-configured">Not configured</span>
                            </h3>
                            <div class="form-group">
                                <label for="openai_api_key">API Key</label>
                                <input type="password" id="openai_api_key" name="openai_api_key" placeholder="sk-..." />
                                <small>Get your API key from <a href="https://platform.openai.com/api-keys" target="_blank">OpenAI Dashboard</a></small>
                            </div>
                        </div>

                        <div class="provider-section">
                            <h3>
                                AWS Bedrock
                                <span id="bedrock-status" class="status-badge not-configured">Not configured</span>
                            </h3>
                            <div class="form-group">
                                <label for="bedrock_access_key_id">Access Key ID</label>
                                <input type="password" id="bedrock_access_key_id" name="bedrock_access_key_id" placeholder="AKIA..." />
                            </div>
                            <div class="form-group">
                                <label for="bedrock_secret_access_key">Secret Access Key</label>
                                <input type="password" id="bedrock_secret_access_key" name="bedrock_secret_access_key" placeholder="..." />
                            </div>
                            <div class="form-group">
                                <label for="bedrock_region">Region</label>
                                <input type="text" id="bedrock_region" name="bedrock_region" placeholder="us-east-1" value="us-east-1" />
                                <small>AWS region where Bedrock is enabled</small>
                            </div>
                        </div>

                        <div class="provider-section">
                            <h3>
                                Deepseek
                                <span id="deepseek-status" class="status-badge not-configured">Not configured</span>
                            </h3>
                            <div class="form-group">
                                <label for="deepseek_api_key">API Key</label>
                                <input type="password" id="deepseek_api_key" name="deepseek_api_key" placeholder="sk-..." />
                                <small>Get your API key from <a href="https://platform.deepseek.com/api_keys" target="_blank">Deepseek Platform</a></small>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="secondary" onclick="closeConfigModal()">Cancel</button>
                        <button type="submit">Save Configuration</button>
                    </div>
                </form>
            </div>
        </div>
    `;
}

function getNewPromptModalHtml() {
    return `
        <div class="modal-overlay" id="new-prompt-modal">
            <div class="modal">
                <div class="modal-header">
                    <h2>Create New Prompt</h2>
                    <button class="modal-close" id="new-prompt-close-btn">
                        ${ICONS.close}
                    </button>
                </div>
                <form id="new-prompt-form">
                    <div class="modal-body">
                        <div class="form-group">
                            <label for="new-prompt-name">Prompt Name</label>
                            <input type="text" id="new-prompt-name" name="name" placeholder="e.g., extract-entities" required />
                        </div>
                        <div class="form-group">
                            <label for="new-prompt-content">Prompt Content</label>
                            <textarea id="new-prompt-content" name="content" class="tall" placeholder="Enter your system prompt here..." required></textarea>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="secondary" onclick="closeNewPromptModal()">Cancel</button>
                        <button type="submit">Create Prompt</button>
                    </div>
                </form>
            </div>
        </div>
    `;
}

window.AppUtils = {
    getSelectedPromptId,
    setSelectedPromptId,
    selectPrompt,
    loadPromptSidebar,
    showAppMessage,
    escapeHtml,
    openConfigModal,
    closeConfigModal,
    openNewPromptModal,
    closeNewPromptModal,
    openEditPromptModal,
    closeEditPromptModal,
    deletePromptFromSidebar,
    ICONS,
    getNavbarHtml,
    getSidebarHtml,
    getConfigModalHtml,
    getNewPromptModalHtml,
};
