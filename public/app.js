const ICONS = {
    logo: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 2L2 7l10 5 10-5-10-5z"/>
        <path d="M2 17l10 5 10-5"/>
        <path d="M2 12l10 5 10-5"/>
    </svg>`,
    eye: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
        <circle cx="12" cy="12" r="3"/>
    </svg>`,
    setup: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
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
    chevronRight: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="9 18 15 12 9 6"/>
    </svg>`,
    chevronDown: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="6 9 12 15 18 9"/>
    </svg>`,
};

const CURRENT_PAGE = window.location.pathname.split("/").pop() || "index.html";

const NAV_ITEMS = [
    { href: "/test-cases.html", label: "Test Cases", page: "test-cases.html" },
    { href: "/test-runs.html", label: "Test Runs", page: "test-runs.html" },
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

// Track which prompt groups are expanded (by promptGroupId)
const expandedGroups = new Set();
// Cache for prompt versions (keyed by promptGroupId)
const versionsCache = {};

// Model selection state
let availableModels = [];
let selectedModels = [];

async function loadAvailableModels() {
    try {
        const res = await fetch("/api/models");
        if (res.ok) {
            availableModels = await res.json();
        } else {
            availableModels = [];
        }
    } catch (error) {
        console.error("Error loading available models:", error);
        availableModels = [];
    }
    return availableModels;
}

async function loadSelectedModels() {
    try {
        const res = await fetch("/api/config");
        if (res.ok) {
            const config = await res.json();
            if (config.selected_models) {
                try {
                    selectedModels = JSON.parse(config.selected_models);
                    if (!Array.isArray(selectedModels)) {
                        selectedModels = [];
                    }
                } catch {
                    selectedModels = [];
                }
            } else {
                selectedModels = [];
            }
        }
    } catch (error) {
        console.error("Error loading selected models:", error);
        selectedModels = [];
    }
    return selectedModels;
}

async function saveSelectedModels(models) {
    selectedModels = models;
    try {
        const res = await fetch("/api/config", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ selected_models: models }),
        });
        return res.ok;
    } catch (error) {
        console.error("Error saving selected models:", error);
        return false;
    }
}

function isModelSelected(provider, modelId) {
    return selectedModels.some((m) => m.provider === provider && m.modelId === modelId);
}

function toggleModelSelection(provider, modelId) {
    const index = selectedModels.findIndex((m) => m.provider === provider && m.modelId === modelId);
    if (index >= 0) {
        selectedModels.splice(index, 1);
    } else {
        selectedModels.push({ provider, modelId });
    }
    saveSelectedModels(selectedModels);
    // Dispatch event so other pages can update
    window.dispatchEvent(new CustomEvent("modelsSelectionChanged", { detail: { selectedModels } }));
}

function renderModelCheckboxes(containerId, filterProvider = null) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const modelsToShow = filterProvider
        ? availableModels.filter((m) => m.provider === filterProvider)
        : availableModels;

    if (modelsToShow.length === 0) {
        container.innerHTML =
            '<div class="no-models">No models available. Configure API keys first.</div>';
        return;
    }

    // Group by provider
    const grouped = {};
    for (const model of modelsToShow) {
        if (!grouped[model.provider]) {
            grouped[model.provider] = [];
        }
        grouped[model.provider].push(model);
    }

    let html = "";
    for (const [provider, models] of Object.entries(grouped)) {
        if (!filterProvider) {
            html += `<div class="model-provider-group"><h4>${escapeHtml(provider)}</h4>`;
        }
        html += '<div class="model-list">';
        for (const model of models) {
            const isChecked = isModelSelected(model.provider, model.id);
            html += `
                <label class="model-checkbox">
                    <input type="checkbox" 
                           data-provider="${escapeHtml(model.provider)}" 
                           data-model-id="${escapeHtml(model.id)}"
                           ${isChecked ? "checked" : ""}>
                    <span class="model-name">${escapeHtml(model.name)}</span>
                </label>
            `;
        }
        html += "</div>";
        if (!filterProvider) {
            html += "</div>";
        }
    }

    container.innerHTML = html;

    // Add event listeners
    container.querySelectorAll('input[type="checkbox"]').forEach((checkbox) => {
        checkbox.addEventListener("change", () => {
            const provider = checkbox.dataset.provider;
            const modelId = checkbox.dataset.modelId;
            toggleModelSelection(provider, modelId);
        });
    });
}

function getSelectedModelsCount() {
    return selectedModels.length;
}

// Helper to get the group ID from a prompt
function getPromptGroupId(prompt) {
    return prompt.prompt_group_id || prompt.promptGroupId || prompt.id;
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

        // Check if selected prompt's group should be auto-expanded
        if (selectedId) {
            const selectedPrompt = prompts.find((p) => p.id === selectedId);
            if (selectedPrompt) {
                expandedGroups.add(getPromptGroupId(selectedPrompt));
            }
        }

        sidebarList.innerHTML = prompts
            .map((p) => {
                const groupId = getPromptGroupId(p);
                const isExpanded = expandedGroups.has(groupId);
                return `
                    <div class="sidebar-group ${isExpanded ? "expanded" : ""}" data-group-id="${groupId}" data-name="${escapeHtml(p.name)}">
                        <div class="sidebar-group-header" data-group-id="${groupId}" data-id="${p.id}">
                            <span class="sidebar-expand-icon">${isExpanded ? ICONS.chevronDown : ICONS.chevronRight}</span>
                            <div class="sidebar-group-info">
                                <div class="sidebar-group-name">${escapeHtml(p.name)}</div>
                                <div class="sidebar-group-meta">${p.version} version${p.version > 1 ? "s" : ""}</div>
                            </div>
                            <div class="sidebar-group-actions">
                                <button class="sidebar-action-btn view" data-id="${p.id}" data-name="${escapeHtml(p.name)}" title="View prompt">
                                    ${ICONS.eye}
                                </button>
                                <button class="sidebar-action-btn delete" data-id="${p.id}" data-name="${escapeHtml(p.name)}" data-group-id="${groupId}" title="Delete all versions">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                        <polyline points="3 6 5 6 21 6"/>
                                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                                    </svg>
                                </button>
                            </div>
                        </div>
                        <div class="sidebar-versions" id="versions-${groupId}">
                            ${isExpanded && versionsCache[groupId] ? renderVersionsList(versionsCache[groupId], selectedId) : ""}
                        </div>
                    </div>
                `;
            })
            .join("");

        // Add click handlers for group headers (expand/collapse)
        sidebarList.querySelectorAll(".sidebar-group-header").forEach((header) => {
            header.addEventListener("click", async (e) => {
                // Don't toggle if clicking on action buttons
                if (e.target.closest(".sidebar-action-btn")) return;

                const groupId = parseInt(header.dataset.groupId, 10);
                const promptId = parseInt(header.dataset.id, 10);
                await toggleVersionsExpand(groupId, promptId);
            });
        });

        sidebarList
            .querySelectorAll(".sidebar-group-actions .sidebar-action-btn.view")
            .forEach((btn) => {
                btn.addEventListener("click", (e) => {
                    e.stopPropagation();
                    const id = parseInt(btn.dataset.id, 10);
                    const name = btn.dataset.name;
                    openViewPromptModal(id, name);
                });
            });

        sidebarList.querySelectorAll(".sidebar-action-btn.delete").forEach((btn) => {
            btn.addEventListener("click", (e) => {
                e.stopPropagation();
                const id = parseInt(btn.dataset.id, 10);
                const name = btn.dataset.name;
                const groupId = parseInt(btn.dataset.groupId, 10);
                deletePromptFromSidebar(id, name, groupId);
            });
        });

        // If expanded, load and render versions
        for (const groupId of expandedGroups) {
            if (!versionsCache[groupId]) {
                // Find a prompt in this group to get the ID for API call
                const prompt = prompts.find((p) => getPromptGroupId(p) === groupId);
                if (prompt) {
                    await loadVersionsForPrompt(groupId, prompt.id);
                }
            }
        }

        window.dispatchEvent(new CustomEvent("promptsLoaded", { detail: { prompts, selectedId } }));
    } catch (error) {
        sidebarList.innerHTML = '<div class="sidebar-empty">Error loading prompts</div>';
    }
}

function formatVersionDate(dateStr) {
    const d = new Date(dateStr);
    const yy = String(d.getFullYear()).slice(-2);
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const min = String(d.getMinutes()).padStart(2, "0");
    const ss = String(d.getSeconds()).padStart(2, "0");
    return `${yy}.${mm}.${dd} - ${hh}:${min}:${ss}`;
}

function renderVersionsList(versions, selectedId) {
    const latestVersion = versions.length > 0 ? versions[0] : null;
    const versionItems = versions
        .map(
            (v) => `
            <div class="sidebar-version-item ${v.id === selectedId ? "active" : ""}" data-id="${v.id}" data-name="${escapeHtml(v.name)}" data-version="${v.version}" data-group-id="${getPromptGroupId(v)}">
                <div class="sidebar-version-info">
                    <span class="badge badge-version">v${v.version}</span>
                    <span class="sidebar-version-date">${formatVersionDate(v.createdAt || v.created_at)}</span>
                </div>
                <div class="sidebar-version-actions">
                    <button class="sidebar-action-btn view version-view" data-id="${v.id}" data-name="${escapeHtml(v.name)}" data-version="${v.version}" title="View prompt">
                        ${ICONS.eye}
                    </button>
                    <button class="sidebar-action-btn delete version-delete" data-id="${v.id}" data-name="${escapeHtml(v.name)}" data-version="${v.version}" data-group-id="${getPromptGroupId(v)}" title="Delete this version">
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

    // Add "Create New Version" button at the bottom
    const newVersionBtn = latestVersion
        ? `<button class="sidebar-new-version-btn" data-id="${latestVersion.id}" data-name="${escapeHtml(latestVersion.name)}" data-group-id="${getPromptGroupId(latestVersion)}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"/>
                <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            <span>Create New Version</span>
        </button>`
        : "";

    return versionItems + newVersionBtn;
}

async function loadVersionsForPrompt(groupId, promptId) {
    try {
        // Use the ID-based endpoint to get versions
        const res = await fetch(`/api/prompts/${promptId}/versions`);
        const versions = await res.json();
        versionsCache[groupId] = versions;
        return versions;
    } catch (error) {
        showAppMessage("Error loading prompt versions", "error");
        return [];
    }
}

async function toggleVersionsExpand(groupId, promptId) {
    const group = document.querySelector(`.sidebar-group[data-group-id="${groupId}"]`);
    if (!group) return;

    const isExpanded = expandedGroups.has(groupId);
    const versionsContainer = group.querySelector(".sidebar-versions");
    const expandIcon = group.querySelector(".sidebar-expand-icon");

    if (isExpanded) {
        // Collapse
        expandedGroups.delete(groupId);
        group.classList.remove("expanded");
        if (expandIcon) expandIcon.innerHTML = ICONS.chevronRight;
        versionsContainer.innerHTML = "";
    } else {
        // Collapse all other groups first (accordion behavior)
        document.querySelectorAll(".sidebar-group.expanded").forEach((otherGroup) => {
            const otherGroupId = parseInt(otherGroup.dataset.groupId, 10);
            if (otherGroupId !== groupId) {
                expandedGroups.delete(otherGroupId);
                otherGroup.classList.remove("expanded");
                const otherExpandIcon = otherGroup.querySelector(".sidebar-expand-icon");
                if (otherExpandIcon) otherExpandIcon.innerHTML = ICONS.chevronRight;
                const otherVersionsContainer = otherGroup.querySelector(".sidebar-versions");
                if (otherVersionsContainer) otherVersionsContainer.innerHTML = "";
            }
        });

        // Expand
        expandedGroups.add(groupId);
        group.classList.add("expanded");
        if (expandIcon) expandIcon.innerHTML = ICONS.chevronDown;

        // Load versions if not cached
        if (!versionsCache[groupId]) {
            versionsContainer.innerHTML = '<div class="sidebar-versions-loading">Loading...</div>';
            await loadVersionsForPrompt(groupId, promptId);
        }

        // Auto-select the latest version (first in the list, sorted by version desc)
        const versions = versionsCache[groupId];
        if (versions && versions.length > 0) {
            const latestVersion = versions[0];
            selectPrompt(latestVersion.id, latestVersion.name, groupId);
        }

        const selectedId = getSelectedPromptId();
        versionsContainer.innerHTML = renderVersionsList(versionsCache[groupId], selectedId);

        // Add click handlers for version items
        versionsContainer.querySelectorAll(".sidebar-version-item").forEach((item) => {
            item.addEventListener("click", (e) => {
                // Don't select if clicking delete button
                if (e.target.closest(".version-delete")) return;
                const id = parseInt(item.dataset.id, 10);
                const itemName = item.dataset.name;
                const itemGroupId = parseInt(item.dataset.groupId, 10);
                selectPrompt(id, itemName, itemGroupId);
            });
        });

        // Add click handlers for version view buttons
        versionsContainer.querySelectorAll(".version-view").forEach((btn) => {
            btn.addEventListener("click", (e) => {
                e.stopPropagation();
                const id = parseInt(btn.dataset.id, 10);
                const name = btn.dataset.name;
                const version = parseInt(btn.dataset.version, 10);
                openViewPromptModal(id, name, version);
            });
        });

        // Add click handlers for version delete buttons
        versionsContainer.querySelectorAll(".version-delete").forEach((btn) => {
            btn.addEventListener("click", (e) => {
                e.stopPropagation();
                const id = parseInt(btn.dataset.id, 10);
                const name = btn.dataset.name;
                const version = parseInt(btn.dataset.version, 10);
                const versionGroupId = parseInt(btn.dataset.groupId, 10);
                deleteVersionFromSidebar(id, name, version, versionGroupId);
            });
        });

        // Add click handler for "Create New Version" button
        const newVersionBtn = versionsContainer.querySelector(".sidebar-new-version-btn");
        if (newVersionBtn) {
            newVersionBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                const id = parseInt(newVersionBtn.dataset.id, 10);
                const name = newVersionBtn.dataset.name;
                openEditPromptModal(id, name);
            });
        }
    }
}

function selectPrompt(id, name, groupId) {
    setSelectedPromptId(id);

    // Update active state for version items
    document.querySelectorAll(".sidebar-version-item").forEach((item) => {
        item.classList.toggle("active", parseInt(item.dataset.id, 10) === id);
    });

    // Expand the group for the selected prompt if not already
    if (groupId && !expandedGroups.has(groupId)) {
        toggleVersionsExpand(groupId, id);
    }

    window.dispatchEvent(new CustomEvent("promptSelected", { detail: { id, name, groupId } }));
}

function deselectPrompt() {
    setSelectedPromptId(null);

    // Remove active state from all version items
    document.querySelectorAll(".sidebar-version-item").forEach((item) => {
        item.classList.remove("active");
    });

    window.dispatchEvent(
        new CustomEvent("promptSelected", { detail: { id: null, name: null, groupId: null } })
    );
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
            selectPrompt(prompt.id, prompt.name, getPromptGroupId(prompt));
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
let editingPromptGroupId = null;

async function openEditPromptModal(id, name) {
    editingPromptId = id;
    editingPromptName = name;

    const overlay = document.getElementById("edit-prompt-modal");
    if (!overlay) return;

    try {
        const res = await fetch(`/api/prompts/${id}`);
        const prompt = await res.json();

        editingPromptGroupId = getPromptGroupId(prompt);

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
        editingPromptGroupId = null;
    }
}

async function openViewPromptModal(id, name, version) {
    const overlay = document.getElementById("view-prompt-modal");
    if (!overlay) return;

    try {
        const res = await fetch(`/api/prompts/${id}`);
        const prompt = await res.json();

        const versionLabel = version ? `v${version}` : `v${prompt.version}`;
        document.getElementById("view-prompt-name-display").textContent = name;
        document.getElementById("view-prompt-version").textContent = versionLabel;
        document.getElementById("view-prompt-content").textContent = prompt.content;

        overlay.classList.add("active");
    } catch (error) {
        showAppMessage("Error loading prompt", "error");
    }
}

function closeViewPromptModal() {
    const overlay = document.getElementById("view-prompt-modal");
    if (overlay) {
        overlay.classList.remove("active");
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
            body: JSON.stringify({
                name: editingPromptName,
                content,
                parentVersionId: editingPromptId,
            }),
        });

        if (res.ok) {
            const prompt = await res.json();
            const groupId = getPromptGroupId(prompt);
            closeEditPromptModal();
            // Clear versions cache for this prompt group so it reloads
            delete versionsCache[groupId];
            await loadPromptSidebar();
            selectPrompt(prompt.id, prompt.name, groupId);
            showAppMessage("New version saved!", "success");
        } else {
            const error = await res.json();
            showAppMessage(error.error || "Failed to save prompt", "error");
        }
    } catch (error) {
        showAppMessage("Error saving prompt", "error");
    }
}

async function deletePromptFromSidebar(id, name, groupId) {
    if (
        !confirm(
            `Delete ALL versions of "${name}"? This will also delete all test cases (which are shared across all versions). This cannot be undone.`
        )
    ) {
        return;
    }

    try {
        const res = await fetch(`/api/prompts/${id}/all-versions`, {
            method: "DELETE",
        });

        if (res.ok) {
            showAppMessage("Prompt deleted", "success");

            const selectedId = getSelectedPromptId();
            if (selectedId === id) {
                setSelectedPromptId(null);
                window.dispatchEvent(
                    new CustomEvent("promptSelected", {
                        detail: { id: null, name: null, groupId: null },
                    })
                );
            }

            // Clear cache for this prompt group
            delete versionsCache[groupId];
            expandedGroups.delete(groupId);

            await loadPromptSidebar();
        } else {
            const error = await res.json();
            showAppMessage(error.error || "Failed to delete prompt", "error");
        }
    } catch (error) {
        showAppMessage("Error deleting prompt", "error");
    }
}

async function deleteVersionFromSidebar(id, name, version, groupId) {
    if (
        !confirm(
            `Delete version ${version} of "${name}"? Test cases are shared across all versions and will be preserved. This cannot be undone.`
        )
    ) {
        return;
    }

    try {
        const res = await fetch(`/api/prompts/${id}`, {
            method: "DELETE",
        });

        if (res.ok) {
            showAppMessage(`Version ${version} deleted`, "success");

            const selectedId = getSelectedPromptId();
            if (selectedId === id) {
                setSelectedPromptId(null);
                window.dispatchEvent(
                    new CustomEvent("promptSelected", {
                        detail: { id: null, name: null, groupId: null },
                    })
                );
            }

            // Clear cache for this prompt group so it reloads
            delete versionsCache[groupId];

            await loadPromptSidebar();
        } else {
            const error = await res.json();
            showAppMessage(error.error || "Failed to delete version", "error");
        }
    } catch (error) {
        showAppMessage("Error deleting version", "error");
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
        // Clear any message when closing
        const messageContainer = document.getElementById("config-message");
        if (messageContainer) {
            messageContainer.innerHTML = "";
        }
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
        updateConfigBadge("gemini-status", !!config.gemini_api_key);

        // Populate input fields with values from the database
        const fields = [
            "openai_api_key",
            "bedrock_access_key_id",
            "bedrock_secret_access_key",
            "bedrock_session_token",
            "deepseek_api_key",
            "bedrock_region",
            "gemini_api_key",
        ];

        for (const field of fields) {
            const input = document.getElementById(field);
            if (input) {
                input.value = config[field] || "";
            }
        }

        // Load selected models from config
        if (config.selected_models) {
            try {
                selectedModels = JSON.parse(config.selected_models);
                if (!Array.isArray(selectedModels)) {
                    selectedModels = [];
                }
            } catch {
                selectedModels = [];
            }
        }

        // Load available models and render checkboxes for each configured provider
        await loadAvailableModels();

        // Render model checkboxes for each provider
        renderModelCheckboxes("openai-models", "OpenAI");
        renderModelCheckboxes("bedrock-models", "Bedrock");
        renderModelCheckboxes("deepseek-models", "Deepseek");
        renderModelCheckboxes("gemini-models", "Gemini");
    } catch (error) {
        showAppMessage("Error loading configuration", "error");
    }
}

function updateConfigBadge(elementId, isConfigured) {
    const badge = document.getElementById(elementId);
    if (badge) {
        badge.className = `status-badge ${isConfigured ? "configured" : "not-configured"}`;
        badge.textContent = isConfigured ? "Configured" : "Not configured";
    }
}

function showConfigMessage(text, type) {
    const container = document.getElementById("config-message");
    if (!container) return;

    container.innerHTML = `<div class="message ${type}">${escapeHtml(text)}</div>`;

    if (type !== "info") {
        setTimeout(() => {
            container.innerHTML = "";
        }, 5000);
    }
}

async function saveConfig(e) {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);
    const data = {};

    for (const [key, value] of formData.entries()) {
        data[key] = value.trim();
    }

    try {
        const res = await fetch("/api/config", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
        });

        if (res.ok) {
            showConfigMessage("Configuration saved successfully!", "success");
            loadConfigStatus();
        } else {
            const error = await res.json();
            showConfigMessage(error.error || "Failed to save configuration", "error");
        }
    } catch (error) {
        showConfigMessage("Error saving configuration", "error");
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
    const setupBtn = document.getElementById("setup-btn");
    if (setupBtn) {
        setupBtn.addEventListener("click", openConfigModal);
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

    const viewPromptModalOverlay = document.getElementById("view-prompt-modal");
    if (viewPromptModalOverlay) {
        viewPromptModalOverlay.addEventListener("click", (e) => {
            if (e.target === viewPromptModalOverlay) closeViewPromptModal();
        });
    }

    const viewPromptCloseBtn = document.getElementById("view-prompt-close-btn");
    if (viewPromptCloseBtn) {
        viewPromptCloseBtn.addEventListener("click", closeViewPromptModal);
    }

    // Deselect prompt when clicking on empty space in sidebar
    const sidebarList = document.getElementById("sidebar-prompts");
    if (sidebarList) {
        sidebarList.addEventListener("click", (e) => {
            // Only deselect if clicking directly on the sidebar-list container (empty space)
            if (e.target === sidebarList || e.target.classList.contains("sidebar-empty")) {
                deselectPrompt();
            }
        });
    }

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            closeConfigModal();
            closeNewPromptModal();
            closeEditPromptModal();
            closeViewPromptModal();
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
                <button class="btn-text" id="setup-btn" title="LLMs">
                    LLMs
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
                    <div id="config-message"></div>
                    <div class="modal-body">
                        <div class="provider-section">
                            <h3>
                                OpenAI
                                <span id="openai-status" class="status-badge not-configured">Not configured</span>
                            </h3>
                            <div class="form-group">
                                <input type="text" id="openai_api_key" name="openai_api_key" placeholder="API Key (sk-...)" />
                            </div>
                        </div>

                        <div class="provider-section">
                            <h3>
                                AWS Bedrock
                                <span id="bedrock-status" class="status-badge not-configured">Not configured</span>
                            </h3>
                            <div class="form-group">
                                <input type="text" id="bedrock_access_key_id" name="bedrock_access_key_id" placeholder="Access Key ID (AKIA...)" />
                            </div>
                            <div class="form-group">
                                <input type="text" id="bedrock_secret_access_key" name="bedrock_secret_access_key" placeholder="Secret Access Key" />
                            </div>
                            <div class="form-group">
                                <input type="text" id="bedrock_session_token" name="bedrock_session_token" placeholder="Session Token (optional)" />
                            </div>
                            <div class="form-group">
                                <input type="text" id="bedrock_region" name="bedrock_region" placeholder="Region (e.g., ap-southeast-2)" value="ap-southeast-2" />
                            </div>
                        </div>

                        <div class="provider-section">
                            <h3>
                                Deepseek
                                <span id="deepseek-status" class="status-badge not-configured">Not configured</span>
                            </h3>
                            <div class="form-group">
                                <input type="text" id="deepseek_api_key" name="deepseek_api_key" placeholder="API Key (sk-...)" />
                            </div>
                        </div>

                        <div class="provider-section">
                            <h3>
                                Gemini
                                <span id="gemini-status" class="status-badge not-configured">Not configured</span>
                            </h3>
                            <div class="form-group">
                                <input type="text" id="gemini_api_key" name="gemini_api_key" placeholder="API Key" />
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

function getViewPromptModalHtml() {
    return `
        <div class="modal-overlay" id="view-prompt-modal">
            <div class="modal modal-wide">
                <div class="modal-header">
                    <div class="modal-title-group">
                        <h2 id="view-prompt-name-display">Prompt</h2>
                        <span class="badge badge-version" id="view-prompt-version">v1</span>
                    </div>
                    <button class="modal-close" id="view-prompt-close-btn">
                        ${ICONS.close}
                    </button>
                </div>
                <div class="modal-body">
                    <pre class="view-prompt-content" id="view-prompt-content"></pre>
                </div>
                <div class="modal-footer">
                    <button type="button" class="secondary" onclick="closeViewPromptModal()">Close</button>
                </div>
            </div>
        </div>
    `;
}

window.AppUtils = {
    getSelectedPromptId,
    setSelectedPromptId,
    selectPrompt,
    deselectPrompt,
    loadPromptSidebar,
    showAppMessage,
    escapeHtml,
    openConfigModal,
    closeConfigModal,
    openNewPromptModal,
    closeNewPromptModal,
    openEditPromptModal,
    closeEditPromptModal,
    openViewPromptModal,
    closeViewPromptModal,
    deletePromptFromSidebar,
    deleteVersionFromSidebar,
    getPromptGroupId,
    ICONS,
    getNavbarHtml,
    getSidebarHtml,
    getConfigModalHtml,
    getNewPromptModalHtml,
    getViewPromptModalHtml,
    // Model selection functions
    loadAvailableModels,
    loadSelectedModels,
    saveSelectedModels,
    isModelSelected,
    toggleModelSelection,
    renderModelCheckboxes,
    getSelectedModelsCount,
    getSelectedModels: () => selectedModels,
    getAvailableModels: () => availableModels,
};
