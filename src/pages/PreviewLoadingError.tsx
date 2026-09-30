import { t as translate } from '../accessibility/i18n';
import { ApiError } from '../api/client';
import { useApi } from '../api/useApi';
import { AsyncBoundary } from '../components/States';

export default function PreviewLoadingError() {
  const state = useApi<string>(() => new Promise((_, reject) => {
    setTimeout(() => reject(new ApiError('http', 'Error de prueba: no se recibió la información solicitada.')), 1800);
  }));
  return <><div className="page-head"><div><h1>{translate("Prueba de carga y error")}</h1><p>{translate("Demostración: el tren aparece brevemente y después se muestra el error. Reintentar repite la prueba.")}</p></div></div><AsyncBoundary state={state} empty={{title:'Sin datos'}}>{data => <p>{translate(data)}</p>}</AsyncBoundary></>;
}
