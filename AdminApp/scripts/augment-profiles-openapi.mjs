#!/usr/bin/env node
/**
 * TEMPORARY OpenAPI augmentation bridge (specs/006-appointment-management, task T005).
 *
 * This overlay adds response schemas for untyped Profiles API actions and normalizes
 * query parameter names.
 *
 * The typed `GET /api/Patients` response comes directly from Swagger. The receptionist
 * form filters the list client-side.
 *
 * Usage: node scripts/augment-profiles-openapi.mjs [sourceUrlOrFile]
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const DEFAULT_SOURCE = 'http://localhost:5154/swagger/v1/swagger.json';
const OUTPUT_PATH = resolve('openapi/profiles.openapi.json');

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
    404: jsonBody('#/components/schemas/ApiResponse'),
    409: jsonBody('#/components/schemas/ApiResponse'),
  };
}

async function loadDefinition(source) {
  if (/^https?:\/\//i.test(source)) {
    let response;
    try {
      response = await fetch(source);
    } catch (error) {
      throw new Error(
        `Cannot reach ${source}. Start the Profiles API (or pass a local swagger.json path).\n${error.message}`
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
  const schemas = definition.components?.schemas;
  if (schemas === undefined) {
    throw new Error('The definition has no components.schemas section.');
  }

  schemas.ApiResponse = envelopeSchema(null);
  schemas.ApiResponseOfGuid = envelopeSchema({ type: 'string', format: 'uuid' });

  // The current Profiles API omits the id. Deployments that supply it support row actions.
  schemas.ReceptionistProfileDTO ??= {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      photoPath: { type: 'string', nullable: true },
      firstName: { type: 'string', nullable: true },
      lastName: { type: 'string', nullable: true },
      middleName: { type: 'string', nullable: true },
      officeAddress: { type: 'string', nullable: true },
      status: { type: 'string', enum: ['Active', 'Inactive'] },
    },
    additionalProperties: false,
  };

  schemas.PagedResultOfReceptionistProfileDTO ??= {
    type: 'object',
    properties: {
      data: {
        type: 'array',
        items: { $ref: '#/components/schemas/ReceptionistProfileDTO' },
      },
      totalCount: { type: 'integer', format: 'int32' },
    },
    additionalProperties: false,
  };

  schemas.ApiResponseOfReceptionistProfileDTO = envelopeSchema({
    $ref: '#/components/schemas/ReceptionistProfileDTO',
  });
  schemas.ApiResponseOfPagedResultOfReceptionistProfileDTO = envelopeSchema({
    $ref: '#/components/schemas/PagedResultOfReceptionistProfileDTO',
  });

  // Receptionist doctor table row: the only read model with status + office address.
  schemas.DoctorTableRowDTO ??= {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      fullName: { type: 'string' },
      specialization: { type: 'string' },
      status: { type: 'string' },
      dateOfBirth: { type: 'string', format: 'date-time' },
      officeAddress: { type: 'string' },
    },
    additionalProperties: false,
  };

  schemas.PagedResultOfDoctorTableRowDTO ??= {
    type: 'object',
    properties: {
      data: {
        type: 'array',
        items: { $ref: '#/components/schemas/DoctorTableRowDTO' },
      },
      totalCount: { type: 'integer', format: 'int32' },
    },
    additionalProperties: false,
  };

  // Patient detail model. Unlike the typed catalog, this DTO has no patient id.
  schemas.PatientProfileDTO ??= {
    type: 'object',
    properties: {
      photoPath: { type: 'string', nullable: true },
      firstName: { type: 'string' },
      lastName: { type: 'string' },
      middleName: { type: 'string', nullable: true },
      phoneNumber: { type: 'string' },
      dateOfBirth: { type: 'string', format: 'date-time' },
    },
    additionalProperties: false,
  };

  schemas.ApiResponseOfPagedResultOfDoctorTableRowDTO = envelopeSchema({
    $ref: '#/components/schemas/PagedResultOfDoctorTableRowDTO',
  });
  schemas.ApiResponseOfPatientProfileDTO = envelopeSchema({
    $ref: '#/components/schemas/PatientProfileDTO',
  });

  // Full doctor profile used by the edit form. The backend `DoctorDetailsDto`
  // intentionally carries no `status`; the Doctors table row remains the only
  // status source, so no `status` property is declared here.
  schemas.DoctorDetailsDTO ??= {
    type: 'object',
    properties: {
      photoPath: { type: 'string', nullable: true },
      firstName: { type: 'string' },
      lastName: { type: 'string' },
      middleName: { type: 'string', nullable: true },
      dateOfBirth: { type: 'string', format: 'date-time' },
      specialization: { type: 'string' },
      officeAddress: { type: 'string' },
      careerStartYear: { type: 'integer', format: 'int32' },
    },
    additionalProperties: false,
  };
  schemas.ApiResponseOfDoctorDetailsDTO = envelopeSchema({
    $ref: '#/components/schemas/DoctorDetailsDTO',
  });
}

function rewriteResponses(definition) {
  const paths = definition.paths ?? {};

  const doctorTablePath = paths['/api/Doctors/doctors'];
  if (doctorTablePath?.get !== undefined) {
    doctorTablePath.get.responses = {
      200: jsonBody('#/components/schemas/ApiResponseOfPagedResultOfDoctorTableRowDTO'),
      ...failureResponses(),
    };
  }

  const patientByIdPath = paths['/api/Patients/{id}'];
  if (patientByIdPath?.get !== undefined) {
    patientByIdPath.get.responses = {
      200: jsonBody('#/components/schemas/ApiResponseOfPatientProfileDTO'),
      ...failureResponses(),
    };
  }

  const patientByAccountPath = paths['/api/Patients/account/{accountId}'];
  if (patientByAccountPath?.get !== undefined) {
    patientByAccountPath.get.responses = {
      200: jsonBody('#/components/schemas/ApiResponseOfPatientProfileDTO'),
      ...failureResponses(),
    };
  }

  // Doctor create returns the new profile id, so a business failure inside a 200
  // (`isSuccess: false`) is detectable instead of being silently treated as success.
  const doctorCollectionPath = paths['/api/Doctors'];
  if (doctorCollectionPath?.post !== undefined) {
    doctorCollectionPath.post.responses = {
      200: jsonBody('#/components/schemas/ApiResponseOfGuid'),
      ...failureResponses(),
    };
  }

  const doctorByIdPath = paths['/api/Doctors/{id}'];
  if (doctorByIdPath?.get !== undefined) {
    doctorByIdPath.get.responses = {
      200: jsonBody('#/components/schemas/ApiResponseOfDoctorDetailsDTO'),
      ...failureResponses(),
    };
  }

  if (doctorByIdPath?.put !== undefined) {
    doctorByIdPath.put.responses = {
      200: jsonBody('#/components/schemas/ApiResponse'),
      ...failureResponses(),
    };
  }

  const receptionistCollectionPath = paths['/api/Receptionists'];
  if (receptionistCollectionPath?.get !== undefined) {
    receptionistCollectionPath.get.responses = {
      200: jsonBody('#/components/schemas/ApiResponseOfPagedResultOfReceptionistProfileDTO'),
      ...failureResponses(),
    };
  }

  if (receptionistCollectionPath?.post !== undefined) {
    receptionistCollectionPath.post.responses = {
      200: jsonBody('#/components/schemas/ApiResponseOfGuid'),
      ...failureResponses(),
    };
  }

  const receptionistByIdPath = paths['/api/Receptionists/{id}'];
  if (receptionistByIdPath?.get !== undefined) {
    receptionistByIdPath.get.responses = {
      200: jsonBody('#/components/schemas/ApiResponseOfReceptionistProfileDTO'),
      ...failureResponses(),
    };
  }

  if (receptionistByIdPath?.put !== undefined) {
    receptionistByIdPath.put.responses = {
      200: jsonBody('#/components/schemas/ApiResponse'),
      ...failureResponses(),
    };
  }

  if (receptionistByIdPath?.delete !== undefined) {
    receptionistByIdPath.delete.responses = {
      200: jsonBody('#/components/schemas/ApiResponse'),
      ...failureResponses(),
    };
  }
}

/**
 * Query parameter names are PascalCase in the backend DTOs; normalize them so the
 * generated params interface is idiomatic. ASP.NET Core model binding is
 * case-insensitive, so the wire contract is unchanged.
 */
function rewriteQueryParameterNames(definition) {
  const paramRenames = {
    SearchName: 'searchName',
    Specialization: 'specialization',
    OfficeAddress: 'officeAddress',
    Page: 'page',
    PageSize: 'pageSize',
  };

  for (const item of Object.values(definition.paths ?? {})) {
    for (const operation of Object.values(item)) {
      if (operation === null || typeof operation !== 'object' || !Array.isArray(operation.parameters)) {
        continue;
      }

      for (const parameter of operation.parameters) {
        const renamed = paramRenames[parameter.name];
        if (typeof renamed === 'string' && parameter.in === 'query') {
          parameter.name = renamed;
        }
      }
    }
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
  rewriteQueryParameterNames(definition);
  rewritePathsForGateway(definition);

  definition.info = {
    ...definition.info,
    description: `${definition.info?.description ?? ''}\n\nTEMPORARY AdminApp overlay generated by scripts/augment-profiles-openapi.mjs (task T005).`.trim(),
  };

  await mkdir(dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, `${JSON.stringify(definition, null, 2)}\n`, 'utf8');

  console.log(`Augmented Profiles API definition written to ${OUTPUT_PATH}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
