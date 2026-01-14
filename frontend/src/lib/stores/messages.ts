import { writable } from "svelte/store";

export type MessageType = "success" | "error" | "info";

export interface Message {
    id: number;
    text: string;
    type: MessageType;
}

let messageId = 0;

function createMessagesStore() {
    const { subscribe, update } = writable<Message[]>([]);

    return {
        subscribe,
        show(text: string, type: MessageType = "info", duration: number = 5000) {
            const id = ++messageId;
            update((messages) => [...messages, { id, text, type }]);

            // Auto-dismiss all messages after duration
            setTimeout(() => {
                update((messages) => messages.filter((m) => m.id !== id));
            }, duration);

            return id;
        },
        dismiss(id: number) {
            update((messages) => messages.filter((m) => m.id !== id));
        },
        clear() {
            update(() => []);
        },
    };
}

export const messages = createMessagesStore();

// Convenience functions
export function showSuccess(text: string) {
    return messages.show(text, "success");
}

export function showError(text: string) {
    return messages.show(text, "error");
}

export function showInfo(text: string) {
    return messages.show(text, "info");
}
