// Amorphie Mapper - Core Package
// Export all mapper types and utilities

export * from './types';
export * from './adapter';
export * from './registry';
export * from './inference';
export * from './mapperAdapter';
export * from './ir';
export * from './lower';
export * from './jsonataGenerator';
export * from './csharpGenerator';
export * from './mapperLayout';
export * from './templateUtils';
export * from './automap';
export * from './fakeDataGenerator';
export * from './schemaHashUtils';
export * from './platformSchemas';
export * from './contractTypes';
export * from './contractTemplates';
export * from './workflowSchemaResolver';

// Note: MapperModel is NOT exported here because it uses Node.js EventEmitter
// and should only be used on the extension side (Node.js environment).
// Import it directly when needed: import { MapperModel } from '@amorphie-flow-studio/core/mapper/MapperModel';
