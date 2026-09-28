import { create } from 'zustand'
import styles from './Notifications.module.css'

export type NotificationType = 'info' | 'success' | 'warning' | 'error'

export interface Notification {
  id: string
  type: NotificationType
  message: string
  details?: string
  dismissable: boolean
}

interface NotificationState {
  notifications: Notification[]
  notify: (type: NotificationType, message: string, options?: { details?: string; dismissable?: boolean; autoDismiss?: boolean; duration?: number }) => void
  dismiss: (id: string) => void
}

/** Toast notifications (from Serpentine's notificationStore) */
export const useNotificationStore = create<NotificationState>()((set, get) => ({
  notifications: [],

  notify: (type, message, options = {}) => {
    const { details, dismissable = true, autoDismiss = type !== 'error', duration = type === 'error' ? 8000 : 3500 } = options
    const id = Math.random().toString(36).slice(2)
    set((state) => ({ notifications: [...state.notifications, { id, type, message, details, dismissable }] }))
    if (autoDismiss) setTimeout(() => get().dismiss(id), duration)
  },

  dismiss: (id) => set((state) => ({ notifications: state.notifications.filter((n) => n.id !== id) })),
}))

export const notify = {
  info: (message: string, details?: string) => useNotificationStore.getState().notify('info', message, { details }),
  success: (message: string, details?: string) => useNotificationStore.getState().notify('success', message, { details }),
  warning: (message: string, details?: string) => useNotificationStore.getState().notify('warning', message, { details }),
  error: (message: string, details?: string) => useNotificationStore.getState().notify('error', message, { details, autoDismiss: false }),
}

const icons: Record<NotificationType, string> = { info: 'ℹ', success: '✓', warning: '⚠', error: '✕' }

export function Notifications() {
  const notifications = useNotificationStore((state) => state.notifications)
  const dismiss = useNotificationStore((state) => state.dismiss)
  if (notifications.length === 0) return null

  return (
    <div className={styles.container}>
      {notifications.map(({ id, type, message, details, dismissable }) => (
        <div key={id} className={`${styles.toast} ${styles[type]}`} role="status">
          <span className={styles.icon}>{icons[type]}</span>
          <div className={styles.content}>
            <p className={styles.message}>{message}</p>
            {details && (
              <details className={styles.details}>
                <summary>Details</summary>
                <pre>{details}</pre>
              </details>
            )}
          </div>
          {dismissable && (
            <button className={styles.dismissButton} onClick={() => dismiss(id)} aria-label="Dismiss">
              ✕
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
