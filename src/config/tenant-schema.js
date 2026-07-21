const { pool } = require("./db");
const logger = require("../utils/logger");

let tenantSchemaPromise;

async function columnExists(tableName, columnName) {
  const [rows] = await pool.execute(
    `SELECT COUNT(*) AS column_count
     FROM information_schema.columns
     WHERE table_schema = DATABASE()
       AND table_name = ?
       AND column_name = ?`,
    [tableName, columnName]
  );

  return Number(rows[0].column_count) > 0;
}

async function addColumnIfMissing(tableName, columnName, definition) {
  if (await columnExists(tableName, columnName)) {
    return;
  }

  await pool.execute(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
}

async function uniqueIndexExists(tableName, indexName) {
  const [rows] = await pool.execute(
    `SELECT COUNT(*) AS index_count
     FROM information_schema.statistics
     WHERE table_schema = DATABASE()
       AND table_name = ?
       AND index_name = ?
       AND non_unique = 0`,
    [tableName, indexName]
  );

  return Number(rows[0].index_count) > 0;
}

async function convertProjectKeyToCompanyUnique() {
  if (!(await uniqueIndexExists("projects", "uq_projects_company_key"))) {
    try {
      await pool.execute("ALTER TABLE projects DROP INDEX project_key");
    } catch (error) {
      if (error.code !== "ER_CANT_DROP_FIELD_OR_KEY") {
        throw error;
      }
    }

    await pool.execute("CREATE UNIQUE INDEX uq_projects_company_key ON projects (company_id, project_key)");
  }
}

async function ensureTenantSchema() {
  if (!tenantSchemaPromise) {
    tenantSchemaPromise = (async () => {
      await pool.execute(
        `CREATE TABLE IF NOT EXISTS companies (
           id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
           name VARCHAR(150) NOT NULL,
           slug VARCHAR(80) NOT NULL UNIQUE,
           created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
           updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
         )`
      );

      await pool.execute(
        `INSERT IGNORE INTO companies (id, name, slug)
         VALUES (1, 'Default Workspace', 'default-workspace')`
      );

      const tenantTables = [
        "users",
        "projects",
        "sprints",
        "scrum_teams",
        "issues",
        "issue_comments",
        "issue_attachments",
        "issue_attachment_comments",
        "issue_attachment_analyses",
        "issue_activity"
      ];

      for (const tableName of tenantTables) {
        await addColumnIfMissing(tableName, "company_id", "BIGINT UNSIGNED NULL");
        await pool.execute(`UPDATE ${tableName} SET company_id = 1 WHERE company_id IS NULL`);
      }

      await convertProjectKeyToCompanyUnique();

      logger.info("tenant_schema_ready", {
        companyScope: "enabled"
      });
    })().catch((error) => {
      tenantSchemaPromise = null;
      throw error;
    });
  }

  return tenantSchemaPromise;
}

module.exports = {
  ensureTenantSchema
};
