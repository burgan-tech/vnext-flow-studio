import React, { useEffect } from 'react';
import Form from '@rjsf/core';
import validator from '@rjsf/validator-ajv8';
import type { RJSFSchema, UiSchema } from '@rjsf/utils';
import { faker } from '@faker-js/faker';

interface SchemaFormGeneratorProps {
  schema: any;
  onDataChange: (data: any) => void;
  initialData?: any;
}

/**
 * Generate form fields from JSON Schema using React JSON Schema Form
 */
export function SchemaFormGenerator({ schema, onDataChange, initialData }: SchemaFormGeneratorProps) {
  const [formData, setFormData] = React.useState<any>(initialData || {});
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const [jsonError, setJsonError] = React.useState<string>('');

  // Generate initial test data if not provided
  useEffect(() => {
    if (!schema || initialData) {
      return;
    }

    // Generate test data from schema
    const testData = generateTestData(schema);
    setFormData(testData);
    onDataChange(testData);
  }, [schema, initialData, onDataChange]);

  const handleChange = ({ formData }: any) => {
    setFormData(formData);
    onDataChange(formData);
  };

  if (!schema) {
    return <div>No schema available</div>;
  }

  // Build dynamic UI schema
  const uiSchema: UiSchema = {
    'ui:submitButtonOptions': {
      norender: true // Hide the submit button since we have our own
    }
  };

  // Mark fields with 'const' as readonly
  if (schema.properties) {
    for (const [fieldName, fieldSchema] of Object.entries<any>(schema.properties)) {
      if (fieldSchema.const !== undefined) {
        uiSchema[fieldName] = {
          'ui:readonly': true,
          'ui:help': 'This field has a required value and cannot be changed'
        };
      }
    }
  }

  const handleApplyJson = () => {
    if (!textareaRef.current) return;

    try {
      const parsed = JSON.parse(textareaRef.current.value);
      setFormData(parsed);
      onDataChange(parsed);
      setJsonError('');
    } catch (err: any) {
      setJsonError(err.message);
    }
  };

  return (
    <div className="schema-form">
      <Form
        schema={schema as RJSFSchema}
        uiSchema={uiSchema}
        formData={formData}
        validator={validator}
        onChange={handleChange}
        onSubmit={() => {}} // No-op, we handle submission externally
      />
      <details style={{ marginTop: '12px' }} open>
        <summary>Edit JSON Directly</summary>
        <textarea
          ref={textareaRef}
          className="json-viewer"
          defaultValue={JSON.stringify(formData, null, 2)}
          key={JSON.stringify(formData)} // Force re-render when formData changes
          rows={12}
          style={{
            width: '100%',
            fontFamily: 'monospace',
            fontSize: '12px',
            padding: '8px',
            border: jsonError ? '1px solid #ef4444' : '1px solid #cbd5e1',
            borderRadius: '4px',
            backgroundColor: '#f8fafc',
            marginBottom: '8px'
          }}
        />
        <button
          onClick={handleApplyJson}
          style={{
            padding: '6px 12px',
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px'
          }}
        >
          Apply JSON Changes
        </button>
        {jsonError && (
          <div style={{
            marginTop: '8px',
            fontSize: '11px',
            color: '#ef4444',
            fontFamily: 'monospace'
          }}>
            ⚠️ {jsonError}
          </div>
        )}
      </details>
    </div>
  );
}

/**
 * Generate test data from schema
 */
function generateTestData(schema: any): any {
  console.log('[generateTestData] Called with schema:', schema);
  if (schema.type !== 'object' || !schema.properties) {
    return {};
  }

  const testData: any = {};

  for (const [fieldName, fieldSchema] of Object.entries<any>(schema.properties)) {
    console.log('[generateTestData] Processing field:', fieldName, fieldSchema);

    // Use const value if available (highest priority - field must be this exact value)
    if (fieldSchema.const !== undefined) {
      testData[fieldName] = fieldSchema.const;
      continue;
    }

    // Use default value if available
    if (fieldSchema.default !== undefined) {
      testData[fieldName] = fieldSchema.default;
      continue;
    }

    // Use example if available
    if (fieldSchema.examples && fieldSchema.examples.length > 0) {
      testData[fieldName] = fieldSchema.examples[0];
      continue;
    }

    // Use first enum value if available
    if (fieldSchema.enum && fieldSchema.enum.length > 0) {
      testData[fieldName] = fieldSchema.enum[0];
      continue;
    }

    // Use first oneOf value if available
    if (fieldSchema.oneOf && Array.isArray(fieldSchema.oneOf) && fieldSchema.oneOf.length > 0) {
      const firstOption = fieldSchema.oneOf[0];
      testData[fieldName] = firstOption.const ?? firstOption.enum?.[0] ?? '';
      continue;
    }

    // Generate based on type
    switch (fieldSchema.type) {
      case 'string':
        if (fieldSchema.format === 'date') {
          testData[fieldName] = new Date().toISOString().split('T')[0];
        } else if (fieldSchema.format === 'date-time') {
          testData[fieldName] = new Date().toISOString();
        } else if (fieldSchema.format === 'email') {
          testData[fieldName] = faker.internet.email();
        } else if (fieldSchema.pattern) {
          testData[fieldName] = generateSmartValue(fieldName, fieldSchema);
        } else {
          testData[fieldName] = generateSmartValue(fieldName, fieldSchema);
        }
        break;

      case 'number':
        testData[fieldName] = fieldSchema.minimum ?? 0;
        break;

      case 'integer':
        testData[fieldName] = fieldSchema.minimum ?? 0;
        break;

      case 'boolean':
        testData[fieldName] = false;
        break;

      case 'array':
        testData[fieldName] = [];
        break;

      case 'object':
        if (fieldSchema.properties) {
          testData[fieldName] = generateTestData(fieldSchema);
        } else {
          testData[fieldName] = {};
        }
        break;

      default:
        testData[fieldName] = null;
    }
  }

  return testData;
}

/**
 * Generate smart test value based on field name semantics
 * Validates against pattern if present and retries with pattern generator if needed
 */
function generateSmartValue(fieldName: string, fieldSchema: any): string {
  console.log('[generateSmartValue] Field:', fieldName, 'Schema:', fieldSchema);
  const lowerFieldName = fieldName.toLowerCase();

  // If there's a pattern, use pattern generator directly
  if (fieldSchema.pattern) {
    return generateFromPattern(fieldSchema.pattern, fieldName);
  }

  // Semantic field name detection with appropriate Faker methods
  let value: string;

  if (lowerFieldName.includes('email')) {
    value = faker.internet.email();
  } else if (lowerFieldName.includes('phone') || lowerFieldName.includes('mobile') || lowerFieldName.includes('telephone')) {
    value = faker.phone.number();
  } else if (lowerFieldName.includes('firstname') || lowerFieldName === 'name' || lowerFieldName.includes('accountname')) {
    value = faker.person.fullName();
  } else if (lowerFieldName.includes('lastname') || lowerFieldName.includes('surname')) {
    value = faker.person.lastName();
  } else if (lowerFieldName.includes('address') || lowerFieldName.includes('street')) {
    value = faker.location.streetAddress();
  } else if (lowerFieldName.includes('city')) {
    value = faker.location.city();
  } else if (lowerFieldName.includes('country')) {
    value = faker.location.country();
  } else if (lowerFieldName.includes('zip') || lowerFieldName.includes('postal')) {
    value = faker.location.zipCode();
  } else if (lowerFieldName.includes('company') || lowerFieldName.includes('organization')) {
    value = faker.company.name();
  } else if (lowerFieldName.includes('username')) {
    value = faker.internet.userName();
  } else if (lowerFieldName.includes('url') || lowerFieldName.includes('website')) {
    value = faker.internet.url();
  } else if (lowerFieldName.includes('account') && lowerFieldName.includes('number')) {
    value = faker.finance.accountNumber();
  } else if (lowerFieldName.includes('amount') || lowerFieldName.includes('deposit') || lowerFieldName.includes('balance')) {
    const amount = faker.finance.amount();
    // Respect numeric constraints
    if (fieldSchema.minimum !== undefined && parseFloat(amount) < fieldSchema.minimum) {
      return fieldSchema.minimum.toString();
    }
    return amount;
  } else if (lowerFieldName.includes('code') || lowerFieldName.includes('id')) {
    value = faker.string.alphanumeric(8).toUpperCase();
  } else {
    // Default: generate a word or sentence respecting length constraints
    value = faker.lorem.words(2);
  }

  // Apply length constraints
  if (fieldSchema.minLength) {
    while (value.length < fieldSchema.minLength) {
      value += ' ' + faker.lorem.word();
    }
  }

  if (fieldSchema.maxLength) {
    value = value.substring(0, fieldSchema.maxLength);
  }

  return value;
}

/**
 * Generate test value from regex pattern using Faker
 * Retries multiple times if generated value doesn't match the pattern
 */
function generateFromPattern(pattern: string, fieldName: string, maxRetries: number = 5): string {
  console.log('[generateFromPattern] Input pattern:', pattern, 'for field:', fieldName);

  try {
    // Remove regex anchors ^ and $ before generating
    let cleanPattern = pattern;
    if (cleanPattern.startsWith('^')) {
      cleanPattern = cleanPattern.slice(1);
    }
    if (cleanPattern.endsWith('$')) {
      cleanPattern = cleanPattern.slice(0, -1);
    }

    console.log('[generateFromPattern] Cleaned pattern:', cleanPattern);

    // Create regex for validation (with anchors)
    const validationRegex = new RegExp(`^${cleanPattern}$`);

    // Try generating with Faker multiple times
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        let generated = faker.helpers.fromRegExp(cleanPattern);

        // Clean the generated output
        if (generated.startsWith('^')) {
          generated = generated.slice(1);
        }
        if (generated.endsWith('$')) {
          generated = generated.slice(0, -1);
        }

        // Validate against the pattern
        if (generated && generated !== cleanPattern && validationRegex.test(generated)) {
          console.log(`[generateFromPattern] Success on attempt ${attempt + 1}:`, generated);
          return generated;
        } else {
          console.log(`[generateFromPattern] Attempt ${attempt + 1} failed validation:`, generated);
        }
      } catch (err) {
        console.log(`[generateFromPattern] Attempt ${attempt + 1} threw error:`, err);
      }
    }

    // All attempts failed, use fallback
    console.warn(`[generateFromPattern] All ${maxRetries} attempts failed, using fallback`);
    return fallbackPatternGenerator(cleanPattern, fieldName);
  } catch (error) {
    // If Faker fails, use fallback generator
    console.warn(`[SchemaFormGenerator] Failed to generate from pattern: ${pattern}`, error);
    return fallbackPatternGenerator(pattern, fieldName);
  }
}

/**
 * Fallback pattern generator for simple common cases
 */
function fallbackPatternGenerator(pattern: string, fieldName: string): string {
  const cleanPattern = pattern.replace(/^\^/, '').replace(/\$$/, '');

  // Numeric patterns: [0-9]{n} or \d{n}
  const numericMatch = cleanPattern.match(/^\[0-9\]\{(\d+)\}$/) || cleanPattern.match(/^\\d\{(\d+)\}$/);
  if (numericMatch) {
    const length = parseInt(numericMatch[1]);
    return '1'.repeat(length);
  }

  // Alphanumeric patterns
  const alphanumericMatch = cleanPattern.match(/^\[a-zA-Z0-9\]\{(\d+),?(\d+)?\}$/);
  if (alphanumericMatch) {
    const minLength = parseInt(alphanumericMatch[1]);
    return 'A'.repeat(minLength);
  }

  // Default: simple test value
  return `test-${fieldName}`;
}
