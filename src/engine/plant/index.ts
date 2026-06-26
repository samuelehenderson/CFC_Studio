import type { PlantModel } from './types';
import { ahuModel } from './ahu';

export const plantModels: PlantModel[] = [ahuModel];

export const plantRegistry: Record<string, PlantModel> = Object.fromEntries(
  plantModels.map((m) => [m.id, m]),
);

export function getPlantModel(id: string): PlantModel | undefined {
  return plantRegistry[id];
}
