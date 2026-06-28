import "dotenv/config";
import pg from "pg";
import { readFileSync, readdirSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const { Client } = pg;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const migrationsDir = path.join(repoRoot, "migrations");
const sharedSchemaPath = path.join(repoRoot, "shared", "schema.ts");
const jsonMode = process.argv.includes("--json");

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

function normalizeIdentifier(value) {
  return String(value ?? "").replace(/^"|"$/g, "").trim();
}

function isPublicSchema(schema) {
  return !schema || schema === "public";
}

function stripSqlComments(sql) {
  return sql
    .replace(/--.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "");
}

function findMatchingParen(text, openIndex) {
  let depth = 0;
  let quote = null;
  for (let i = openIndex; i < text.length; i += 1) {
    const char = text[i];
    const previous = text[i - 1];
    if (quote) {
      if (char === quote && previous !== "\\") quote = null;
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
      continue;
    }
    if (char === "(") depth += 1;
    if (char === ")") {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function splitSqlStatements(sql) {
  const statements = [];
  let start = 0;
  let quote = null;
  for (let i = 0; i < sql.length; i += 1) {
    const char = sql[i];
    const previous = sql[i - 1];
    if (quote) {
      if (char === quote && previous !== "\\") quote = null;
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
      continue;
    }
    if (char === ";") {
      const statement = sql.slice(start, i).trim();
      if (statement) statements.push(statement);
      start = i + 1;
    }
  }
  const tail = sql.slice(start).trim();
  if (tail) statements.push(tail);
  return statements;
}

function addColumn(expectedColumns, table, column) {
  const normalizedTable = normalizeIdentifier(table);
  const normalizedColumn = normalizeIdentifier(column);
  if (!normalizedTable || !normalizedColumn) return;
  if (!expectedColumns.has(normalizedTable)) expectedColumns.set(normalizedTable, new Set());
  expectedColumns.get(normalizedTable).add(normalizedColumn);
}

function addTable(expectedTables, table) {
  const normalized = normalizeIdentifier(table);
  if (normalized) expectedTables.add(normalized);
}

function collectMigrationExpectations() {
  const expectedTables = new Set();
  const expectedIndexes = new Set();
  const expectedColumns = new Map();
  const migrationFiles = readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort();

  for (const file of migrationFiles) {
    const sql = stripSqlComments(readFileSync(path.join(migrationsDir, file), "utf8"));

    const tableRegex = /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:(?<schema>"?[a-z_][\w]*"?)[.])?(?<table>"?[a-z_][\w]*"?)\s*\(/gi;
    for (const match of sql.matchAll(tableRegex)) {
      const schema = normalizeIdentifier(match.groups?.schema);
      const table = normalizeIdentifier(match.groups?.table);
      if (!isPublicSchema(schema)) continue;
      addTable(expectedTables, table);

      const openIndex = match.index + match[0].lastIndexOf("(");
      const closeIndex = findMatchingParen(sql, openIndex);
      if (closeIndex === -1) continue;
      const body = sql.slice(openIndex + 1, closeIndex);
      for (const rawLine of body.split("\n")) {
        const line = rawLine.trim().replace(/,$/, "");
        const columnMatch = line.match(/^"?(?<column>[a-z_][\w]*)"?\s+/i);
        const column = columnMatch?.groups?.column;
        if (!column || /^(constraint|primary|foreign|unique|check|exclude)$/i.test(column)) continue;
        addColumn(expectedColumns, table, column);
      }
    }

    for (const statement of splitSqlStatements(sql)) {
      const alterMatch = statement.match(/alter\s+table\s+(?:if\s+exists\s+)?(?:(?<schema>"?[a-z_][\w]*"?)[.])?(?<table>"?[a-z_][\w]*"?)/i);
      const schema = normalizeIdentifier(alterMatch?.groups?.schema);
      const table = normalizeIdentifier(alterMatch?.groups?.table);
      if (!alterMatch || !isPublicSchema(schema)) continue;
      addTable(expectedTables, table);

      const columnRegex = /add\s+column\s+(?:if\s+not\s+exists\s+)?"?(?<column>[a-z_][\w]*)"?/gi;
      for (const columnMatch of statement.matchAll(columnRegex)) {
        addColumn(expectedColumns, table, columnMatch.groups?.column);
      }
    }

    const indexRegex = /create\s+(?:unique\s+)?index\s+(?:concurrently\s+)?(?:if\s+not\s+exists\s+)?(?<index>"?[a-z_][\w]*"?)/gi;
    for (const match of sql.matchAll(indexRegex)) {
      expectedIndexes.add(normalizeIdentifier(match.groups?.index));
    }
  }

  return { expectedTables, expectedIndexes, expectedColumns };
}

function collectSharedSchemaTables() {
  const expectedTables = new Set();
  const schema = readFileSync(sharedSchemaPath, "utf8");
  const tableRegex = /pgTable\(\s*["'](?<table>[a-z_][\w]*)["']/g;
  for (const match of schema.matchAll(tableRegex)) {
    addTable(expectedTables, match.groups?.table);
  }
  return expectedTables;
}

function sorted(values) {
  return [...values].sort((a, b) => a.localeCompare(b));
}

const migrationExpectations = collectMigrationExpectations();
const expectedTables = new Set([
  ...migrationExpectations.expectedTables,
  ...collectSharedSchemaTables(),
]);
const expectedIndexes = migrationExpectations.expectedIndexes;
const expectedColumns = migrationExpectations.expectedColumns;

const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

try {
  const [tableResult, indexResult, columnResult] = await Promise.all([
    client.query(`
      select table_name
      from information_schema.tables
      where table_schema = 'public'
        and table_type = 'BASE TABLE'
    `),
    client.query(`
      select indexname
      from pg_indexes
      where schemaname = 'public'
    `),
    client.query(`
      select table_name, column_name
      from information_schema.columns
      where table_schema = 'public'
    `),
  ]);

  const existingTables = new Set(tableResult.rows.map((row) => row.table_name));
  const existingIndexes = new Set(indexResult.rows.map((row) => row.indexname));
  const existingColumns = new Map();
  for (const row of columnResult.rows) {
    if (!existingColumns.has(row.table_name)) existingColumns.set(row.table_name, new Set());
    existingColumns.get(row.table_name).add(row.column_name);
  }

  const missingTables = sorted([...expectedTables].filter((table) => !existingTables.has(table)));
  const missingIndexes = sorted([...expectedIndexes].filter((index) => !existingIndexes.has(index)));
  const missingColumns = {};
  for (const [table, columns] of expectedColumns.entries()) {
    if (!existingTables.has(table)) continue;
    const existing = existingColumns.get(table) ?? new Set();
    const missing = sorted([...columns].filter((column) => !existing.has(column)));
    if (missing.length > 0) missingColumns[table] = missing;
  }

  const result = {
    ok: missingTables.length === 0 && missingIndexes.length === 0 && Object.keys(missingColumns).length === 0,
    expectedTableCount: expectedTables.size,
    missingTableCount: missingTables.length,
    missingTables,
    expectedIndexCount: expectedIndexes.size,
    missingIndexCount: missingIndexes.length,
    missingIndexes,
    missingColumns,
  };

  if (jsonMode) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`Database audit: ${result.ok ? "OK" : "needs attention"}`);
    console.log(`Tables: ${expectedTables.size - missingTables.length}/${expectedTables.size} present`);
    console.log(`Indexes: ${expectedIndexes.size - missingIndexes.length}/${expectedIndexes.size} present`);
    console.log(`Missing tables: ${missingTables.length ? missingTables.join(", ") : "none"}`);
    console.log(`Missing indexes: ${missingIndexes.length ? missingIndexes.join(", ") : "none"}`);
    console.log(`Missing columns: ${Object.keys(missingColumns).length ? JSON.stringify(missingColumns, null, 2) : "none"}`);
  }

  process.exit(result.ok ? 0 : 1);
} finally {
  await client.end();
}
