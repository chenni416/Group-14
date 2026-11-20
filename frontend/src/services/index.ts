import type { Services } from './contracts';
import { httpServices } from './http';
import { mockServices } from './mock';

export const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false';

export const api: Services = USE_MOCK ? mockServices : httpServices;

export type * from './contracts';
