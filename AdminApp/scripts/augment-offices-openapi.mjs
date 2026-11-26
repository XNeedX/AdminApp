#!/usr/bin/env node
/**
 * OpenAPI augmentation bridge for Offices API.
 *
 * The live Offices API Swagger documents actions as untyped `IActionResult`
 * (no response schema). This script downloads the definition from the running
 * OfficesApi container, adds response schemas matching the backend DTOs
 * (OfficeResponseDTO, PagedResultOfOfficeResponseDTO, ApiResponse),
 * names enum values, and rewrites `/api/*` paths to Gateway shape
 * (`/offices/{everything}` -> downstream `/api/{everything}`).
 *
 * Usage: node scripts/augment-offices-openapi.mjs [sourceUrlOrFile]
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const DEFAULT_SOURCE = 'http://localhost:5193/swagger/v1/swagger.json';
const OUTPUT_PATH = resolve('openapi/offices.openapi.json');

function envelopeSchema(dataSchema) {
  return {
    type: 'object',
    properties: {
      isSuccess: { type: 'boolean' },
      message: { type: 'string', nullable: true },
      errors: { type: 'array', items: { type: 'string' } },
      ...(dataSchema === null ? {} : { data: dataSchema }),
    },
    additionalProperties: false,
  };
}

function jsonBody(schemaRef) {
  return {
    description: 'Success',
    content: {
      'application/json': { schema: { $ref: schemaRef } },
    },
  };
}

function failureResponses() {
  return {
    400: jsonBody('#/components/schemas/ApiResponse'),
    401: jsonBody('#/components/schemas/ApiResponse'),
    403: jsonBody('#/components/schemas/ApiResponse'),
    404: jsonBody('#/components/schemas/ApiResponse'),
  };
}

async function loadDefinition(source) {
  if (/^https?:\/\//i.test(source)) {
    let response;
    try {
      response = await fetch(source);
    } catch (error) {
      throw new Error(
        `Cannot reach ${source}. Start the Offices API container (or pass a local swagger.json path).\n${error.message}`
      );
    }

    if (!response.ok) {
      throw new Error(`${source} responded with HTTP ${response.status}.`);
    }

    return response.json();
  }

  return JSON.parse(await readFile(resolve(source), 'utf8'));
}

function ensureSchemas(definition) {
  definition.components ??= {};
  definition.components.schemas ??= {};
  const schemas = definition.components.schemas;

  // Enum naming
  if (schemas.OfficeStatus && Array.isArray(schemas.OfficeStatus.enum)) {
    schemas.OfficeStatus['x-enumNames'] = ['Active', 'Inactive'];
  }

  schemas.OfficeResponseDTO ??= {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      photoPath: { type: 'string', nullable: true },
      fullAddress: { type: 'string' },
      city: { type: 'string' },
      street: { type: 'string' },
      houseNumber: { type: 'string' },
      officeNumber: { type: 'string', nullable: true },
      registryPhoneNumber: { type: 'string' },
      status: { type: 'string' },
    },
    additionalProperties: false,
  };

  schemas.PagedResultOfOfficeResponseDTO ??= {
    type: 'object',
    properties: {
      items: {
        type: 'array',
        items: { $ref: '#/components/schemas/OfficeResponseDTO' },
      },
      totalCount: { type: 'integer', format: 'int64' },
    },
    additionalProperties: false,
  };

  schemas.ApiResponse = envelopeSchema(null);
  schemas.ApiResponseOfOfficeResponseDTO = envelopeSchema({
    $ref: '#/components/schemas/OfficeResponseDTO',
  });
}

function rewriteResponses(definition) {
  const paths = definition.paths ?? {};

  const collectionPath = paths['/api/Offices'];
  if (collectionPath?.get !== undefined) {
    collectionPath.get.responses = {
      200: jsonBody('#/components/schemas/PagedResultOfOfficeResponseDTO'),
      ...failureResponses(),
    };
  }
  if (collectionPath?.post !== undefined) {
    collectionPath.post.responses = {
      200: jsonBody('#/components/schemas/OfficeResponseDTO'),
      ...failureResponses(),
    };
  }

  const byIdPath = paths['/api/Offices/{id}'];
  if (byIdPath?.get !== undefined) {
    delete byIdPath.get.operationId;
    byIdPath.get.responses = {
      200: jsonBody('#/components/schemas/OfficeResponseDTO'),
      ...failureResponses(),
    };
  }
  if (byIdPath?.put !== undefined) {
    delete byIdPath.put.operationId;
    byIdPath.put.responses = {
      200: jsonBody('#/components/schemas/OfficeResponseDTO'),
      ...failureResponses(),
    };
  }

  const statusPath = paths['/api/Offices/{id}/status'];
  if (statusPath?.patch !== undefined) {
    delete statusPath.patch.operationId;
    statusPath.patch.responses = {
      200: { description: 'Success' },
      ...failureResponses(),
    };
  }
}

function rewritePathsForGateway(definition) {
  const rewritten = {};

  for (const [path, item] of Object.entries(definition.paths ?? {})) {
    const gatewayPath = path.startsWith('/api/') ? path.slice('/api'.length) : path;
    rewritten[gatewayPath] = item;
  }

  definition.paths = rewritten;
}

async function main() {
  const source = process.argv[2] ?? DEFAULT_SOURCE;
  const definition = await loadDefinition(source);

  ensureSchemas(definition);
  rewriteResponses(definition);
  rewritePathsForGateway(definition);

  definition.info = {
    ...definition.info,
    description: `${definition.info?.description ?? ''}\n\nOffices API overlay generated by scripts/augment-offices-openapi.mjs.`.trim(),
  };

  await mkdir(dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, `${JSON.stringify(definition, null, 2)}\n`, 'utf8');

  console.log(`Augmented Offices API definition written to ${OUTPUT_PATH}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
