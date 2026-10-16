const TOAST_ID = 'dbclash-runtime-toast';

function getToast() {
  let toast = document.getElementById(TOAST_ID);
  if (toast) return toast;

  toast = document.createElement('div');
  toast.id = TOAST_ID;
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  toast.style.cssText = [
    'position:fixed',
    'left:50%',
    'bottom:18px',
    'transform:translateX(-50%) translateY(24px)',
    'z-index:99999',
    'max-width:min(92vw,560px)',
    'padding:10px 16px',
    'border-radius:999px',
    'background:rgba(8,12,22,.94)',
    'border:1px solid rgba(255,215,0,.45)',
    'color:#fff',
    'font:700 13px/1.3 Inter,Arial,sans-serif',
    'opacity:0',
    'pointer-events:none',
    'transition:.2s ease'
  ].join(';');
  document.body.appendChild(toast);
  return toast;
}

let toastTimer = null;
export function showRuntimeToast(message, duration = 3500) {
  if (typeof document === 'undefined') return;
  const toast = getToast();
  toast.textContent = String(message || '').slice(0, 240);
  toast.style.opacity = '1';
  toast.style.transform = 'translateX(-50%) translateY(0)';

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(-50%) translateY(24px)';
  }, duration);
}

if (typeof window !== 'undefined') {
  window.addEventListener('offline', () => {
    showRuntimeToast('Conexao perdida. Partidas online tentarao reconectar automaticamente.', 5000);
  });

  window.addEventListener('online', () => {
    showRuntimeToast('Conexao restaurada.', 2500);
  });

  window.addEventListener('unhandledrejection', event => {
    console.error('[Runtime] Unhandled promise rejection:', event.reason);
    showRuntimeToast('Uma operacao falhou. O jogo continua ativo; tente novamente.');
  });

  window.addEventListener('error', event => {
    console.error('[Runtime] Unhandled error:', event.error || event.message);
  });
}
