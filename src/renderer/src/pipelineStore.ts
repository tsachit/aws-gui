import type { PipelineSummary } from './types/electron-api'

let _pipelines: PipelineSummary[] = []
let _selectedName: string | null = null

export function getCachedPipelines(): PipelineSummary[] { return _pipelines }
export function setCachedPipelines(list: PipelineSummary[]): void { _pipelines = list }

export function getSelectedPipelineName(): string | null { return _selectedName }
export function setSelectedPipelineName(name: string | null): void { _selectedName = name }
