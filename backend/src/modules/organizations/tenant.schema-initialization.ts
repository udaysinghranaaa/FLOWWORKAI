import type { TenantModels } from './tenant.models.js'
export async function tenantIndexesReady(models: TenantModels): Promise<boolean> {
  for (const model of Object.values(models)) {
    try {
      const indexes = await model.collection.listIndexes().toArray()
      for (const [keys, options] of model.schema.indexes()) {
        if (
          !indexes.some(
            (index) =>
              JSON.stringify(index.key) === JSON.stringify(keys) &&
              Boolean(index.unique) === Boolean(options.unique) &&
              JSON.stringify(index.partialFilterExpression) ===
                JSON.stringify(options.partialFilterExpression) &&
              (options.expireAfterSeconds === undefined ||
                index.expireAfterSeconds === options.expireAfterSeconds),
          )
        )
          return false
      }
    } catch {
      return false
    }
  }
  return true
}
