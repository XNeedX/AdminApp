import { Injectable, signal } from '@angular/core';

export interface Toast {
  id: string;
  kind: 'success' | 'error';
  message: string;
  timeoutMs: number;
}

const DEFAULT_TIMEOUT_MS = 4000;

let toastSequence = 0;

/** Signal-based transient notification queue. */
@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly state = signal<readonly Toast[]>([]);
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();

  readonly toasts = this.state.asReadonly();

  showSuccess(message: string, timeoutMs: number = DEFAULT_TIMEOUT_MS): void {
    this.show('success', message, timeoutMs);
  }

  showError(message: string, timeoutMs: number = DEFAULT_TIMEOUT_MS): void {
    this.show('error', message, timeoutMs);
  }

  dismiss(id: string): void {
    const timer = this.timers.get(id);
    if (timer !== undefined) {
      clearTimeout(timer);
      this.timers.delete(id);
    }

    this.state.update((toasts) => toasts.filter((toast) => toast.id !== id));
  }

  private show(kind: Toast['kind'], message: string, timeoutMs: number): void {
    toastSequence += 1;
    const toast: Toast = {
      id: `toast-${toastSequence}`,
      kind,
      message,
      timeoutMs,
    };

    this.state.update((toasts) => [...toasts, toast]);

    const timer = setTimeout(() => this.dismiss(toast.id), timeoutMs);
    this.timers.set(toast.id, timer);
  }
}
