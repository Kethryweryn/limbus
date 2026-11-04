// Web Worker de la prévision du questionnaire (US-143, ADR-0062) : 1 000 affectations ne bloquent pas la page
import { runForecast, type ForecastInput } from './questionnaireForecast'

self.onmessage = ({ data }: MessageEvent<ForecastInput>) => {
  self.postMessage(runForecast(data))
}
