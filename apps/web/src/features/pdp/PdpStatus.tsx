/** Estados de carga y error de la PDP. */
export function PdpLoading() {
  return (
    <div className="pdp" aria-busy="true">
      <p className="pdp-status" role="status">
        Cargando producto…
      </p>
      <div className="pdp-row">
        <div className="pdp-skeleton pdp-skeleton-image" />
        <div className="pdp-skeleton pdp-skeleton-info" />
      </div>
    </div>
  );
}

export function PdpError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="pdp">
      <div className="pdp-error-box" role="alert">
        <p>{message}</p>
        <button type="button" className="pdp-add" onClick={onRetry}>
          Reintentar
        </button>
      </div>
    </div>
  );
}
