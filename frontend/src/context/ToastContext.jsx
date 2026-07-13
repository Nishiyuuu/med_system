import React, { createContext, useContext, useState } from 'react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);
  return (
    <ToastContext.Provider value={{ toast, setToast }}>
      {children}
      {toast && (
        <div className="toast show position-fixed bottom-0 end-0 m-3" role="alert" aria-live="polite">
          <div className={`toast-header text-bg-${toast.variant || 'primary'}`}>
            <strong className="me-auto">{toast.title || 'Powiadomienie'}</strong>
            <button type="button" className="btn-close btn-close-white" aria-label="Zamknij" onClick={() => setToast(null)} />
          </div>
          <div className="toast-body">{toast.message}</div>
        </div>
      )}
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
